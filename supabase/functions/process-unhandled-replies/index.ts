import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// レート制限設定
const RATE_LIMITS = {
  MAX_REPLIES_PER_PERSONA_PER_HOUR: 15, // 1時間あたり最大15件のリプライ
  REPLY_DELAY_SECONDS: 10, // リプライ間隔10秒
  RETRY_DELAY_MINUTES: 60 // 制限時の再試行まで60分
};

// ペルソナごとのリプライレート制限をチェック
async function checkPersonaReplyRateLimit(personaId: string): Promise<{ allowed: boolean; count: number; nextRetryAt?: Date }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  // 過去1時間のリプライ数をカウント（reply_status='sent'のもののみ）
  const { data: recentReplies, error } = await supabase
    .from('thread_replies')
    .select('id')
    .eq('persona_id', personaId)
    .eq('reply_status', 'sent')
    .gte('created_at', oneHourAgo.toISOString());
  
  if (error) {
    console.error('❌ レート制限チェック失敗:', error);
    return { allowed: false, count: 0 };
  }
  
  const count = recentReplies?.length || 0;
  const allowed = count < RATE_LIMITS.MAX_REPLIES_PER_PERSONA_PER_HOUR;
  
  if (!allowed) {
    // 制限に達した場合、次回再試行時刻を設定
    const nextRetryAt = new Date(Date.now() + RATE_LIMITS.RETRY_DELAY_MINUTES * 60 * 1000);
    console.log(`⚠️ レート制限到達: Persona ${personaId} - ${count}/${RATE_LIMITS.MAX_REPLIES_PER_PERSONA_PER_HOUR} (次回: ${nextRetryAt.toISOString()})`);
    return { allowed: false, count, nextRetryAt };
  }
  
  console.log(`✅ レート制限内: Persona ${personaId} - ${count}/${RATE_LIMITS.MAX_REPLIES_PER_PERSONA_PER_HOUR}`);
  return { allowed: true, count };
}

// 古いprocessing状態をクリーンアップ（10分以上経過したもの）
// CRITICAL: auto_reply_sentの状態に関わらずクリーンアップ
async function cleanupStuckProcessing(): Promise<number> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  const { data: stuckReplies, error: fetchError } = await supabase
    .from('thread_replies')
    .select('id, reply_text, persona_id, auto_reply_sent')
    .eq('reply_status', 'processing')
    .lt('updated_at', tenMinutesAgo);
  
  if (fetchError || !stuckReplies || stuckReplies.length === 0) {
    return 0;
  }
  
  console.log(`⚠️ ${stuckReplies.length}件のスタックしたprocessing状態を発見（10分以上経過）`);
  
  // failedに変更（auto_reply_sentは既存の状態を維持）
  const { error: updateError } = await supabase
    .from('thread_replies')
    .update({ 
      reply_status: 'failed',
      error_details: { 
        error: 'Processing timeout',
        message: 'Reply stuck in processing state for more than 10 minutes',
        cleanup_timestamp: new Date().toISOString()
      }
    })
    .eq('reply_status', 'processing')
    .lt('updated_at', tenMinutesAgo);
  
  if (!updateError) {
    console.log(`🔧 ${stuckReplies.length}件のスタックしたprocessing状態をクリーンアップ完了`);
  } else {
    console.error(`❌ クリーンアップエラー:`, updateError);
  }
  
  return stuckReplies.length;
}

// リトライ可能な失敗リプライを取得（指数バックオフ）
async function getRetryableFailedReplies(): Promise<any[]> {
  const now = Date.now();
  
  const { data: failedReplies, error } = await supabase
    .from('thread_replies')
    .select(`
      *,
      personas!inner (
        id,
        name,
        user_id,
        auto_reply_enabled,
        ai_auto_reply_enabled,
        threads_access_token
      )
    `)
    .eq('reply_status', 'failed')
    .eq('auto_reply_sent', false)
    .lt('retry_count', supabase.rpc('COALESCE(max_retries, 3)'))
    .gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString()); // 24時間以内
  
  if (error || !failedReplies) {
    return [];
  }
  
  // 指数バックオフでリトライ時刻をチェック（2^retry_count * 5分）
  const retryable = failedReplies.filter(reply => {
    if (!reply.last_retry_at) return true; // 初回リトライ
    
    const retryCount = reply.retry_count || 0;
    const backoffMinutes = Math.pow(2, retryCount) * 5; // 5分, 10分, 20分, 40分...
    const nextRetryTime = new Date(reply.last_retry_at).getTime() + backoffMinutes * 60 * 1000;
    
    return now >= nextRetryTime;
  });
  
  if (retryable.length > 0) {
    console.log(`🔄 リトライ可能な失敗リプライ: ${retryable.length}件`);
  }
  
  return retryable;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 未処理リプライの再処理開始...');
    
    // ステップ1: 古いprocessing状態をクリーンアップ
    await cleanupStuckProcessing();
    
    // ステップ2: リトライ可能な失敗リプライを追加
    const retryableReplies = await getRetryableFailedReplies();

    // 未処理のリプライを取得
    // pending: auto_reply_sent=false のみ
    // scheduled: scheduled_reply_atが過去なら auto_reply_sent に関係なく取得
    // completed: scheduled_reply_atが過去かつ auto_reply_sent=false のみ
    const now = new Date().toISOString();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { data: unprocessedReplies, error: fetchError } = await supabase
      .from('thread_replies')
      .select(`
        *,
        ai_response,
        personas!inner (
          id,
          name,
          user_id,
          auto_reply_enabled,
          ai_auto_reply_enabled,
          threads_access_token
        )
      `)
      .or(`and(reply_status.eq.pending,auto_reply_sent.eq.false),and(reply_status.eq.scheduled,scheduled_reply_at.lte.${now}),and(reply_status.eq.completed,auto_reply_sent.eq.false,scheduled_reply_at.lte.${now})`)
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('❌ リプライ取得エラー:', fetchError);
      throw fetchError;
    }

    // ステップ3: リトライリプライと未処理リプライを統合
    const allReplies = [...(unprocessedReplies || []), ...retryableReplies];
    
    // 重複を削除（同じreply_idのものは1つだけ）
    const uniqueReplies = Array.from(
      new Map(allReplies.map(r => [r.reply_id, r])).values()
    );

    // ペルソナの自動返信設定でフィルタリング
    const filteredReplies = uniqueReplies.filter(reply => {
      const persona = reply.personas;
      
      // デバッグ: personaオブジェクトの構造を確認
      if (!persona) {
        console.log(`⚠️ personaがnull: reply.id=${reply.id}`);
        return false;
      }
      
      const hasAutoReply = persona.auto_reply_enabled === true;
      const hasAIReply = persona.ai_auto_reply_enabled === true;
      
      console.log(`🔍 フィルタチェック: persona=${persona.name}, auto=${hasAutoReply}, ai=${hasAIReply}`);
      
      return hasAutoReply || hasAIReply;
    });

    console.log(`📋 取得件数: ${unprocessedReplies?.length || 0}, リトライ: ${retryableReplies.length}, フィルタ後: ${filteredReplies.length}`);

    if (!filteredReplies || filteredReplies.length === 0) {
      console.log('✅ 未処理リプライなし');
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0,
        message: '未処理リプライはありませんでした' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log(`📋 処理対象リプライ数: ${filteredReplies.length}`);

    let processedCount = 0;
    let successCount = 0;

    for (const reply of filteredReplies) {
      try {
        const persona = reply.personas;
        console.log(`\n🔄 処理中: ${reply.id} - "${reply.reply_text}" (Persona: ${persona.name})`);

        // 🔍 レート制限チェック（既存処理に影響を与えない追加機能）
        const rateLimitCheck = await checkPersonaReplyRateLimit(persona.id);
        if (!rateLimitCheck.allowed) {
          console.log(`⏸️ レート制限により遅延処理: ${reply.id}`);
          // 制限に達した場合、scheduled_reply_atを設定して遅延処理
          await supabase
            .from('thread_replies')
            .update({ 
              scheduled_reply_at: rateLimitCheck.nextRetryAt?.toISOString(),
              reply_status: 'scheduled' // 遅延処理用の新ステータス
            })
            .eq('reply_id', reply.reply_id);
          continue; // 次のリプライへ
        }

        // Threads API制限対策: 各リプライ処理の間に10秒待機
        if (processedCount > 0) {
          console.log(`⏳ API制限対策: ${RATE_LIMITS.REPLY_DELAY_SECONDS}秒待機中...`);
          await new Promise(resolve => setTimeout(resolve, RATE_LIMITS.REPLY_DELAY_SECONDS * 1000));
        }

        processedCount++;

        // 🔒 処理開始時にステータスを'processing'に更新（楽観的ロック）
        // scheduled状態からの処理: auto_reply_sentに関係なくロック可能
        // その他の状態: auto_reply_sent=falseのみロック可能
        const { error: lockError } = await supabase
          .from('thread_replies')
          .update({ 
            reply_status: 'processing'
          })
          .eq('reply_id', reply.reply_id)
          .in('reply_status', ['pending', 'scheduled', 'completed']);
        
        if (lockError) {
          console.error(`❌ リプライロック失敗: ${reply.reply_id}`, lockError);
          continue;
        }
        
        console.log(`🔒 ロック成功: ${reply.id} (${reply.reply_status} → processing, auto_reply_sent=${reply.auto_reply_sent})`)
        
        let replySent = false;

        // キーワード自動返信をチェック
        if (persona.auto_reply_enabled) {
          const templateResult = await processTemplateAutoReply(persona, reply);
          if (templateResult.sent) {
            console.log(`✅ 定型文自動返信成功 - reply: ${reply.id}`);
            replySent = true;
          }
        }

        // AI自動返信をチェック（定型文が送信されなかった場合のみ）
        if (!replySent && persona.ai_auto_reply_enabled) {
          try {
            // 既にAI返信が生成済みかチェック
            if (reply.ai_response) {
              console.log(`📤 保存済みのAI返信を送信: "${reply.ai_response}"`);
              // 既に生成済みの返信を使って送信
              const sendResult = await sendThreadsReply(persona, reply.reply_id, reply.ai_response);
              
              if (sendResult.success) {
                console.log(`✅ 保存済みAI返信送信成功: ${reply.id}`);
                
                // 送信成功時にステータスを'sent'に更新
                await supabase
                  .from('thread_replies')
                  .update({ 
                    reply_status: 'sent',
                    auto_reply_sent: true
                  })
                  .eq('reply_id', reply.reply_id);
                
                replySent = true;
              } else {
                console.error(`❌ 保存済みAI返信送信失敗: ${reply.id}`);
                // リトライカウントを更新
                const newRetryCount = (reply.retry_count || 0) + 1;
                const maxRetries = reply.max_retries || 3;
                
                await supabase
                  .from('thread_replies')
                  .update({ 
                    reply_status: newRetryCount >= maxRetries ? 'failed' : 'failed',
                    auto_reply_sent: false,
                    retry_count: newRetryCount,
                    last_retry_at: new Date().toISOString(),
                    error_details: {
                      ...sendResult.errorDetails,
                      retry_count: newRetryCount,
                      timestamp: new Date().toISOString()
                    }
                  })
                  .eq('reply_id', reply.reply_id);
                  
                console.log(`🔄 リトライ記録: ${newRetryCount}/${maxRetries}回目 - reply: ${reply.id}`);
              }
            } else {
              // AI返信が未生成の場合は新規生成
              console.log(`🤖 AI返信を新規生成: ${reply.id}`);
              const autoReplyResult = await supabase.functions.invoke('threads-auto-reply', {
                body: {
                  postContent: 'Original post content',
                  replyContent: reply.reply_text,
                  replyId: reply.reply_id,
                  personaId: persona.id,
                  userId: persona.user_id
                }
              });

              if (autoReplyResult.error) {
                console.error(`❌ AI自動返信呼び出しエラー:`, autoReplyResult.error);
                // リトライカウントを更新
                const newRetryCount = (reply.retry_count || 0) + 1;
                const maxRetries = reply.max_retries || 3;
                
                await supabase
                  .from('thread_replies')
                  .update({ 
                    reply_status: newRetryCount >= maxRetries ? 'failed' : 'failed',
                    auto_reply_sent: false,
                    retry_count: newRetryCount,
                    last_retry_at: new Date().toISOString(),
                    error_details: {
                      error: 'AI Reply Generation Failed',
                      message: autoReplyResult.error.message || 'Unknown error',
                      retry_count: newRetryCount,
                      timestamp: new Date().toISOString()
                    }
                  })
                  .eq('reply_id', reply.reply_id);
                  
                console.log(`🔄 リトライ記録: ${newRetryCount}/${maxRetries}回目 - reply: ${reply.id}`);
              } else {
                console.log(`✅ AI自動返信呼び出し成功: ${reply.id}`);
                replySent = true;
              }
            }
          } catch (error) {
            console.error(`❌ AI自動返信処理エラー:`, error);
            await supabase
              .from('thread_replies')
              .update({ 
                reply_status: 'failed',
                auto_reply_sent: false
              })
              .eq('reply_id', reply.reply_id);
          }
        }

        // 処理されなかった場合（自動返信無効など）
        if (!replySent && !persona.auto_reply_enabled && !persona.ai_auto_reply_enabled) {
          console.log(`ℹ️ 自動返信無効のためスキップ: ${reply.id}`);
          await supabase
            .from('thread_replies')
            .update({ 
              reply_status: 'pending',
              auto_reply_sent: false  // 処理されなかったのでfalse
            })
            .eq('reply_id', reply.reply_id);
        }
        
        // 送信失敗の場合はエラーハンドリングで処理されているのでここでは何もしない
        
        if (replySent) {
          successCount++;
        }

      } catch (error) {
        console.error(`❌ リプライ処理エラー ${reply.id}:`, error);
        // リトライカウントを更新
        const newRetryCount = (reply.retry_count || 0) + 1;
        const maxRetries = reply.max_retries || 3;
        
        // エラー時はロックを解除＋リトライ情報を記録
        await supabase
          .from('thread_replies')
          .update({ 
            reply_status: newRetryCount >= maxRetries ? 'failed' : 'failed',
            auto_reply_sent: false,
            retry_count: newRetryCount,
            last_retry_at: new Date().toISOString(),
            error_details: {
              error: error instanceof Error ? error.name : 'Unknown Error',
              message: error instanceof Error ? error.message : String(error),
              retry_count: newRetryCount,
              timestamp: new Date().toISOString()
            }
          })
          .eq('reply_id', reply.reply_id);
          
        console.log(`🔄 エラー記録: ${newRetryCount}/${maxRetries}回目 - reply: ${reply.id}`);
      }
    }

    console.log(`\n📊 処理完了 - 処理数: ${processedCount}, 成功数: ${successCount}`);

    return new Response(JSON.stringify({ 
      success: true,
      processed: processedCount,
      successful: successCount,
      message: `${processedCount}件のリプライを処理し、${successCount}件の自動返信を送信しました`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ 未処理リプライ再処理エラー:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// トリガー自動返信（定型文）を処理
async function processTemplateAutoReply(persona: any, reply: any): Promise<{ sent: boolean, method?: string }> {
  console.log(`🎯 定型文自動返信チェック開始`);

  // 自動返信設定を取得
  const { data: autoRepliesSettings } = await supabase
    .from('auto_replies')
    .select('*')
    .eq('persona_id', persona.id)
    .eq('is_active', true);

  if (!autoRepliesSettings || autoRepliesSettings.length === 0) {
    console.log(`❌ 定型文自動返信設定なし - persona: ${persona.name}`);
    return { sent: false };
  }

  console.log(`✅ 定型文自動返信設定が有効 - persona: ${persona.name}, 設定数: ${autoRepliesSettings.length}`);

  const replyText = (reply.reply_text || '').trim().toLowerCase();
  console.log(`🔍 リプライテキスト: "${replyText}"`);

  for (const setting of autoRepliesSettings) {
    const keywords = setting.trigger_keywords || [];
    console.log(`🔑 チェック中のキーワード:`, keywords);

    for (const keyword of keywords) {
      const cleanKeyword = keyword.trim().toLowerCase();
      console.log(`🔍 キーワード "${cleanKeyword}" をテキスト "${replyText}" と照合中`);
      
      if (replyText.includes(cleanKeyword)) {
        console.log(`🎉 キーワードマッチ: "${keyword}" → 返信: "${setting.response_template}"`);
        
        try {
          // 定型文返信を送信
          const sendResult = await sendThreadsReply(persona, reply.reply_id, setting.response_template);
          
          if (sendResult.success) {
            console.log(`✅ 定型文返信送信成功`);
            // 送信成功時にステータスを更新
            await supabase
              .from('thread_replies')
              .update({ 
                reply_status: 'sent',
                auto_reply_sent: true
              })
              .eq('reply_id', reply.reply_id);
            
            // アクティビティログを記録
            await logActivity(persona.user_id, persona.id, 'template_auto_reply_sent',
              `定型文自動返信を送信: "${setting.response_template.substring(0, 50)}..."`, {
                reply_id: reply.reply_id,
                keyword_matched: keyword,
                response_sent: setting.response_template
              });

            return { sent: true, method: 'template' };
          } else {
            console.error(`❌ 定型文返信送信失敗`);
            // 送信失敗時はリトライ情報を記録
            const newRetryCount = (reply.retry_count || 0) + 1;
            const maxRetries = reply.max_retries || 3;
            
            await supabase
              .from('thread_replies')
              .update({ 
                reply_status: newRetryCount >= maxRetries ? 'failed' : 'failed',
                retry_count: newRetryCount,
                last_retry_at: new Date().toISOString(),
                error_details: {
                  ...sendResult.errorDetails,
                  reply_type: 'template',
                  retry_count: newRetryCount,
                  timestamp: new Date().toISOString()
                }
              })
              .eq('reply_id', reply.reply_id);
          }
        } catch (error) {
          console.error(`❌ 定型文返信送信エラー:`, error);
        }
      }
    }
  }

  console.log(`❌ マッチするキーワードなし`);
  return { sent: false };
}

// Threads返信を送信（エラー詳細も返す）
async function sendThreadsReply(persona: any, replyToId: string, responseText: string): Promise<{ success: boolean; errorDetails?: any }> {
  try {
    console.log(`📤 Threads返信送信開始: "${responseText}" (Reply to: ${replyToId})`);

    // アクセストークンを取得
    const accessToken = await getAccessToken(persona);
    if (!accessToken) {
      console.error('❌ アクセストークン取得失敗');
      return { 
        success: false, 
        errorDetails: { error: 'Token Error', message: 'Failed to retrieve access token' }
      };
    }

    // Step 1: コンテナを作成
    const containerResponse = await fetch('https://graph.threads.net/v1.0/me/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: responseText,
        reply_to_id: replyToId,
        access_token: accessToken
      })
    });

    if (!containerResponse.ok) {
      const errorText = await containerResponse.text();
      console.error('❌ Threads コンテナ作成失敗:', errorText);
      
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { error: 'Container Error', message: errorText };
      }
      
      return { success: false, errorDetails };
    }

    const containerData = await containerResponse.json();
    console.log(`✅ コンテナ作成成功: ${containerData.id}`);

    // コンテナが準備されるまで待機（Threads APIの制約とレート制限対策）
    console.log('⏳ コンテナ準備を待機中（5秒）...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒待機（API制限対策）

    // Step 2: コンテナを公開
    const publishResponse = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: accessToken
      })
    });

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      console.error('❌ Threads 投稿公開失敗:', errorText);
      
      let errorDetails;
      // エラー詳細を解析
      try {
        errorDetails = JSON.parse(errorText);
        if (errorDetails?.error?.error_subcode === 2207051) {
          console.error('🚫 Threads APIアクションブロック: アカウント制限またはスパム防止による拒否');
          console.error('💡 対策: 投稿頻度を下げる、異なるコンテンツを投稿する、時間をおいて再試行する');
          errorDetails.spam_detection = true;
          
          // ⚠️ NEW: ペルソナのレート制限状態を記録
          const estimatedLiftTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間後を推定
          await supabase
            .from('personas')
            .update({
              is_rate_limited: true,
              rate_limit_detected_at: new Date().toISOString(),
              rate_limit_reason: errorDetails.error.error_user_msg || 'スパム検出により一時的に制限されています',
              rate_limit_until: estimatedLiftTime.toISOString()
            })
            .eq('id', persona.id);
          
          console.log(`⚠️ ペルソナ ${persona.name} のレート制限を記録しました`);
        }
      } catch (parseError) {
        console.error('⚠️ エラー詳細の解析失敗:', parseError);
        errorDetails = { error: 'Publish Error', message: errorText };
      }
      
      return { success: false, errorDetails };
    }

    const publishData = await publishResponse.json();
    console.log(`🎉 返信送信成功: ${publishData.id}`);
    
    // ✅ NEW: 成功時、レート制限が解除された可能性があるのでフラグをクリア
    await supabase
      .from('personas')
      .update({
        is_rate_limited: false,
        rate_limit_detected_at: null,
        rate_limit_reason: null,
        rate_limit_until: null
      })
      .eq('id', persona.id)
      .eq('is_rate_limited', true); // 制限中の場合のみ更新
    
    return { success: true };

  } catch (error) {
    console.error('❌ Threads返信送信エラー:', error);
    return { 
      success: false, 
      errorDetails: { 
        error: error instanceof Error ? error.name : 'Unknown Error',
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

// アクセストークンを取得
async function getAccessToken(persona: any): Promise<string | null> {
  try {
    console.log('🔑 アクセストークン取得開始');

    // Step 1: 新しい方法でトークンを取得
    try {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('retrieve-secret', {
        body: { 
          key: `threads_access_token_${persona.id}`,
          fallback: persona.threads_access_token
        }
      });

      if (tokenData?.value && !tokenError) {
        console.log('✅ トークン取得成功（新方式）');
        return tokenData.value;
      }
      console.log('🔄 新方式でトークン取得失敗、従来方式を試行');
    } catch (error) {
      console.log('🔄 新方式エラー、従来方式を試行:', error);
    }

    // Step 2: 従来方式のフォールバック
    const { data: personaWithToken } = await supabase
      .from('personas')
      .select('threads_access_token')
      .eq('id', persona.id)
      .maybeSingle();

    if (!personaWithToken?.threads_access_token) {
      console.error('❌ アクセストークンが見つかりません');
      return null;
    }

    // Step 3: retrieve-secret関数を使用してトークンを取得
    try {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('retrieve-secret', {
        body: { 
          key: `threads_access_token_${persona.id}`,
          fallback: personaWithToken.threads_access_token
        }
      });

      if (tokenData?.secret && !tokenError) {
        console.log('✅ トークン取得成功（retrieve-secret）');
        return tokenData.secret;
      }
    } catch (error) {
      console.log('🔄 retrieve-secret方式エラー:', error);
    }

    // Step 4: 暗号化されていないトークンかチェック
    if (personaWithToken.threads_access_token.startsWith('THAA')) {
      console.log('✅ 非暗号化トークン使用');
      return personaWithToken.threads_access_token;
    }

    // Step 5: 従来の復号化方式を試行
    try {
      const { data: decryptedToken, error: decryptError } = await supabase
        .rpc('decrypt_access_token', { encrypted_token: personaWithToken.threads_access_token });

      if (decryptedToken && !decryptError) {
        console.log('✅ トークン復号化成功（従来方式）');
        return decryptedToken;
      }
    } catch (error) {
      console.error('❌ 復号化処理エラー:', error);
    }

    console.error('❌ 全ての方式でアクセストークン取得失敗');
    return null;

  } catch (error) {
    console.error('❌ トークン取得エラー:', error);
    return null;
  }
}

// auto_reply_sentフラグを更新
async function updateAutoReplySentFlag(replyId: string, sent: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('thread_replies')
      .update({ auto_reply_sent: sent })
      .eq('reply_id', replyId);
    
    if (error) {
      console.error('❌ auto_reply_sentフラグ更新エラー:', error);
    } else {
      console.log(`✅ auto_reply_sentフラグ更新完了: ${replyId} -> ${sent}`);
    }
  } catch (error) {
    console.error('❌ auto_reply_sentフラグ更新エラー:', error);
  }
}

// アクティビティログを記録
async function logActivity(userId: string, personaId: string, actionType: string, description: string, metadata?: any): Promise<void> {
  try {
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        persona_id: personaId,
        action_type: actionType,
        description: description,
        metadata: metadata || {}
      });
    
    console.log(`📝 アクティビティログ記録: ${actionType}`);
  } catch (error) {
    console.error('❌ アクティビティログ記録エラー:', error);
  }
}