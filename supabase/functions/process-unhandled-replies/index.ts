import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { decryptIfNeeded, getUserApiKeyDecrypted } from '../_shared/crypto.ts';
import { normalizeEmojiAndText, matchKeywords } from '../_shared/keyword-matcher.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// レート制限設定
const RATE_LIMITS = {
  MAX_REPLIES_PER_PERSONA_PER_HOUR: 15, // 1時間あたり最大15件のリプライ
  REPLY_DELAY_SECONDS: 2, // リプライ間隔（固定10秒待機を短縮）
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
      auto_reply_sent: false,  // ★ リトライ可能にするためfalseに戻す
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
  
  // CRITICAL FIX: JOINを使わず個別クエリ（重複FK回避）
  const { data: failedReplies, error } = await supabase
    .from('thread_replies')
    .select('*')
    .eq('reply_status', 'failed')
    .eq('auto_reply_sent', false)  // ★ auto_reply_sent=false のみ（trueはmax_retries到達済み）
    .gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString());
  
  if (error || !failedReplies) {
    return [];
  }
  
  // max_retriesを超えていないもののみフィルタ
  const underMaxRetries = failedReplies.filter(r => (r.retry_count || 0) < (r.max_retries || 3));
  
  // 指数バックオフでリトライ時刻をチェック
  const retryable = underMaxRetries.filter(reply => {
    if (!reply.last_retry_at) return true;
    
    const retryCount = reply.retry_count || 0;
    const backoffMinutes = Math.pow(2, retryCount) * 5;
    const nextRetryTime = new Date(reply.last_retry_at).getTime() + backoffMinutes * 60 * 1000;
    
    return now >= nextRetryTime;
  });
  
  // バッチ処理のため上限を厳格化
  const targetReplies = retryable.slice(0, 5);
  const personaIds = Array.from(new Set(targetReplies.map(r => r.persona_id).filter(Boolean)));

  const { data: personaRows } = await supabase
    .from('personas')
    .select('id, name, user_id, auto_reply_enabled, ai_auto_reply_enabled, threads_access_token')
    .in('id', personaIds);

  const personaMap = new Map((personaRows || []).map((p: any) => [p.id, p]));
  const withPersonas = targetReplies
    .map((reply: any) => ({ ...reply, personas: personaMap.get(reply.persona_id) }))
    .filter((reply: any) => Boolean(reply.personas));
  
  if (withPersonas.length > 0) {
    console.log(`🔄 リトライ可能な失敗リプライ: ${withPersonas.length}件`);
  }
  
  return withPersonas;
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
    // pending: auto_reply_sent=false のみ（24時間以内）
    // scheduled: scheduled_reply_atが過去なら作成日時に関係なく取得（古いscheduledも処理する）
    // completed: scheduled_reply_atが過去かつ auto_reply_sent=false のみ
    const now = new Date().toISOString();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // pending/completedは2時間以内、scheduledは期限切れならいつでも処理
    const [unprocessedResult, scheduledResult] = await Promise.all([
      supabase
        .from('thread_replies')
        .select('*')
        .or(`and(reply_status.eq.pending,auto_reply_sent.eq.false),and(reply_status.eq.completed,auto_reply_sent.eq.false,scheduled_reply_at.lte.${now})`)
        .gte('created_at', twoHoursAgo)
        .order('created_at', { ascending: true })
        .limit(10),
      // ★ CRITICAL FIX: scheduled は created_at 制限を完全撤廃
      // 以前は24時間制限があり、遅延送信のスケジュール済みリプライが期限切れで処理されなかった
      supabase
        .from('thread_replies')
        .select('*')
        .eq('reply_status', 'scheduled')
        .eq('auto_reply_sent', false)
        .or(`scheduled_reply_at.lte.${now},scheduled_reply_at.is.null`)
        .order('scheduled_reply_at', { ascending: true, nullsFirst: false })
        .limit(10) // 上限を10に拡大（溜まったスケジュール済みを処理するため）
    ]);

    const fetchError = unprocessedResult.error || scheduledResult.error;
    const unprocessedReplies = [
      ...(unprocessedResult.data || []),
      ...(scheduledResult.data || [])
    ];

    if (fetchError) {
      console.error('❌ リプライ取得エラー:', fetchError);
      throw fetchError;
    }

    // ペルソナ情報を個別に取得（重複FK回避）
    const repliesWithPersonas = [];
    const personaCache = new Map<string, any>();
    
    for (const reply of (unprocessedReplies || [])) {
      if (!reply.persona_id) continue;
      
      let persona = personaCache.get(reply.persona_id);
      if (!persona) {
        const { data: p } = await supabase
          .from('personas')
          .select('id, name, user_id, is_active, auto_reply_enabled, ai_auto_reply_enabled, threads_access_token')
          .eq('id', reply.persona_id)
          .maybeSingle();
        if (p) {
          personaCache.set(reply.persona_id, p);
          persona = p;
        }
      }
      
      if (persona) {
        repliesWithPersonas.push({ ...reply, personas: persona });
      }
    }

    // ステップ3: リトライリプライと未処理リプライを統合
    const allReplies = [...repliesWithPersonas, ...retryableReplies];
    
    // 重複を削除
    const uniqueReplies = Array.from(
      new Map(allReplies.map(r => [r.reply_id, r])).values()
    );

    // ペルソナの有効性でフィルタリング
    const filteredReplies = uniqueReplies.filter(reply => {
      const persona = reply.personas;
      if (!persona) return false;
      
      const isActive = persona.is_active === true;
      const hasAutoReply = persona.auto_reply_enabled === true;
      const hasAIReply = persona.ai_auto_reply_enabled === true;
      
      console.log(`🔍 フィルタチェック: persona=${persona.name}, active=${isActive}, auto=${hasAutoReply}, ai=${hasAIReply}`);
      
      return isActive;
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

        // 🔒 アトミックロック: reply_status + auto_reply_sent を同時に更新
        // auto_reply_sent=false かつ 対象ステータスのみロック取得可能
        // → threads-webhook / threads-auto-reply との二重送信を防止
        const { data: lockResult, error: lockError } = await supabase
          .from('thread_replies')
          .update({ 
            reply_status: 'processing',
            auto_reply_sent: true,  // ★ 同時にtrueに設定（二重送信防止の核心）
            updated_at: new Date().toISOString()
          })
          .eq('reply_id', reply.reply_id)
          .eq('auto_reply_sent', false)  // ★ auto_reply_sent=falseのみロック可能
          .in('reply_status', ['pending', 'scheduled', 'completed'])
          .select('id');
        
        if (lockError) {
          console.error(`❌ リプライロック失敗: ${reply.reply_id}`, lockError);
          continue;
        }
        
        if (!lockResult || lockResult.length === 0) {
          console.log(`⏭️ 既に他プロセスが処理中（重複スキップ） - reply: ${reply.reply_id}`);
          continue;
        }
        
        console.log(`🔒 アトミックロック取得成功: ${reply.id} (${reply.reply_status} → processing, auto_reply_sent: false→true)`)
        
        let replySent = false;

        // キーワード自動返信をチェック（auto_repliesテーブルのis_activeで判断）
        const templateResult = await processTemplateAutoReply(persona, reply);
        if (templateResult.sent) {
          console.log(`✅ 定型文自動返信成功 - reply: ${reply.id}`);
          replySent = true;
        }

        // AI自動返信をチェック（定型文が送信されなかった場合のみ、AI自動返信ONの場合のみ）
        // auto_reply_enabled=trueでもai_auto_reply_enabled=falseならAIフォールバックしない
        if (!replySent && persona.ai_auto_reply_enabled) {
          console.log(`🔄 AI自動返信実行 (ai=${persona.ai_auto_reply_enabled}, keyword=${persona.auto_reply_enabled})`);
          try {
            // 既にAI返信が生成済みかチェック
            if (reply.ai_response) {
              console.log(`📤 保存済みのAI返信を送信: "${reply.ai_response}"`);
              // 既に生成済みの返信を使って送信
              const sendResult = await sendThreadsReply(persona, reply.reply_id, reply.ai_response);
              
              if (sendResult.success) {
                console.log(`✅ 保存済みAI返信送信成功: ${reply.id}`);
                
                // 送信成功時にステータスを'sent'に更新（auto_reply_sentは既にtrueなのでそのまま）
                await supabase
                  .from('thread_replies')
                  .update({ 
                    reply_status: 'sent'
                  })
                  .eq('reply_id', reply.reply_id);
                
                replySent = true;
              } else {
                console.error(`❌ 保存済みAI返信送信失敗: ${reply.id}`, sendResult.errorDetails);
                
                // 無効な投稿IDの場合は最大リトライに設定（リトライ不要）
                const isInvalidPost = sendResult.errorDetails?.error?.error_subcode === 4279009;
                const newRetryCount = isInvalidPost ? 999 : ((reply.retry_count || 0) + 1);
                const maxRetries = reply.max_retries || 3;
                
                // CRITICAL: エラー詳細を必ず記録（詳細がない場合もエラー情報を残す）
                const errorDetails = sendResult.errorDetails ? {
                  ...sendResult.errorDetails,
                  retry_count: newRetryCount,
                  invalid_post: isInvalidPost,
                  timestamp: new Date().toISOString()
                } : {
                  error: 'Reply Send Failed',
                  message: 'Failed to send saved AI reply without detailed error info',
                  retry_count: newRetryCount,
                  invalid_post: isInvalidPost,
                  timestamp: new Date().toISOString()
                };
                
                // ★ 送信失敗時はauto_reply_sentをfalseに戻してリトライ可能にする
                await supabase
                  .from('thread_replies')
                  .update({ 
                    reply_status: 'failed',
                    auto_reply_sent: false,  // ★ ロール解放（リトライ可能に）
                    retry_count: newRetryCount,
                    last_retry_at: new Date().toISOString(),
                    error_details: errorDetails
                  })
                  .eq('reply_id', reply.reply_id);
                  
                if (isInvalidPost) {
                  console.log(`⚠️ 無効な投稿IDのためリトライスキップ: ${reply.reply_id}`);
                } else {
                  console.log(`🔄 リトライ記録: ${newRetryCount}/${maxRetries}回目 - reply: ${reply.id}`);
                }
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
                
                // CRITICAL: エラー詳細を必ず記録
                await supabase
                  .from('thread_replies')
                  .update({ 
                    reply_status: 'failed',
                    auto_reply_sent: false,
                    retry_count: newRetryCount,
                    last_retry_at: new Date().toISOString(),
                    error_details: {
                      error: 'AI Reply Generation Failed',
                      message: autoReplyResult.error.message || autoReplyResult.error.toString() || 'Unknown error during AI reply generation',
                      error_code: autoReplyResult.error.code,
                      retry_count: newRetryCount,
                      timestamp: new Date().toISOString(),
                      context: 'threads-auto-reply invocation'
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
            const newRetryCount = (reply.retry_count || 0) + 1;
            const maxRetries = reply.max_retries || 3;
            
            // CRITICAL: エラー詳細を必ず記録
            await supabase
              .from('thread_replies')
              .update({ 
                reply_status: 'failed',
                auto_reply_sent: false,
                retry_count: newRetryCount,
                last_retry_at: new Date().toISOString(),
                error_details: {
                  error: error instanceof Error ? error.name : 'Unexpected Error',
                  message: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined,
                  retry_count: newRetryCount,
                  timestamp: new Date().toISOString(),
                  context: 'AI auto-reply processing exception'
                }
              })
              .eq('reply_id', reply.reply_id);
          }
        }

        // 処理されなかった場合（自動返信無効など）
        // ★ CRITICAL FIX: skipped + auto_reply_sent=true で完全に再トリガーを防止
        if (!replySent && !persona.auto_reply_enabled && !persona.ai_auto_reply_enabled) {
          console.log(`ℹ️ 自動返信無効のためスキップ（再トリガーなし）: ${reply.id}`);
          await supabase
            .from('thread_replies')
            .update({ 
              reply_status: 'skipped',
              auto_reply_sent: true,  // ★ trueにして二度と拾わない
              error_details: {
                error: 'Auto Reply Disabled',
                message: 'Both template and AI auto-reply are disabled for this persona',
                timestamp: new Date().toISOString(),
                context: 'auto-reply disabled check'
              }
            })
            .eq('reply_id', reply.reply_id);
        } else if (!replySent) {
          // 自動返信は有効だが送信されなかった場合
          // キーワードのみ有効でAI無効 → キーワード不一致は「条件不一致」であり再試行不要
          const isKeywordOnlyNoMatch = persona.auto_reply_enabled && !persona.ai_auto_reply_enabled;
          
          if (isKeywordOnlyNoMatch) {
            console.log(`⚠️ キーワード不一致（AIフォールバック無効）→ スキップ: ${reply.id}`);
            await supabase
              .from('thread_replies')
              .update({ 
                reply_status: 'skipped',
                auto_reply_sent: true,  // ★ 再トリガー防止
                error_details: {
                  error: 'No Keyword Match',
                  message: 'Keyword auto-reply enabled but no keywords matched. AI fallback is disabled.',
                  timestamp: new Date().toISOString(),
                  context: 'keyword-only no match'
                }
              })
              .eq('reply_id', reply.reply_id);
          } else {
            // AI有効だが何らかの理由で送信されなかった → failedでリトライ
            console.log(`⚠️ 自動返信有効だが送信されず（リトライ対象）: ${reply.id}`);
            const newRetryCount = (reply.retry_count || 0) + 1;
            const maxRetries = reply.max_retries || 3;
            
            await supabase
              .from('thread_replies')
              .update({ 
                reply_status: 'failed',
                auto_reply_sent: newRetryCount >= maxRetries,  // ★ max_retries到達時はtrueにして永久リトライ防止
                retry_count: newRetryCount,
                last_retry_at: new Date().toISOString(),
                error_details: {
                  error: 'Reply Not Sent',
                  message: 'Auto-reply enabled but reply was not sent',
                  retry_count: newRetryCount,
                  max_retries_reached: newRetryCount >= maxRetries,
                  timestamp: new Date().toISOString(),
                  context: 'reply not sent despite auto-reply enabled'
                }
              })
              .eq('reply_id', reply.reply_id);
          }
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
        
        // CRITICAL: エラー時は必ず詳細を記録
        await supabase
          .from('thread_replies')
          .update({ 
                reply_status: 'failed',
            auto_reply_sent: false,
            retry_count: newRetryCount,
            last_retry_at: new Date().toISOString(),
            error_details: {
              error: error instanceof Error ? error.name : 'Unknown Error',
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              retry_count: newRetryCount,
              timestamp: new Date().toISOString(),
              context: 'reply processing top-level catch'
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

// 🔧 絵文字とテキストの正規化（threads-webhookと同じロジック）


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

  const replyText = reply.reply_text || '';
  console.log(`🔍 リプライテキスト: "${replyText}"`);

  for (const setting of autoRepliesSettings) {
    const keywords = setting.trigger_keywords || [];
    console.log(`🔑 チェック中のキーワード:`, keywords);

    const matchResult = matchKeywords(replyText, keywords);
    
    if (matchResult.matched) {
      console.log(`🎉 キーワードマッチ: "${matchResult.keyword}" → 返信: "${setting.response_template}"`);
      
      // CRITICAL: ai_responseに定型文を保存（threads-webhookと同じ処理）
      await supabase
        .from('thread_replies')
        .update({ 
          ai_response: setting.response_template
        })
        .eq('reply_id', reply.reply_id);
      
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
              keyword_matched: matchResult.keyword,
              response_sent: setting.response_template
            });

          return { sent: true, method: 'template' };
        } else {
          console.error(`❌ 定型文返信送信失敗`);
          
          // 無効な投稿IDの場合は最大リトライに設定（リトライ不要）
          const isInvalidPost = sendResult.errorDetails?.error?.error_subcode === 4279009;
          const newRetryCount = isInvalidPost ? 999 : ((reply.retry_count || 0) + 1);
          const maxRetries = reply.max_retries || 3;
          
          // CRITICAL: エラー詳細を必ず記録
          const errorDetails = sendResult.errorDetails ? {
            ...sendResult.errorDetails,
            reply_type: 'template',
            retry_count: newRetryCount,
            invalid_post: isInvalidPost,
            timestamp: new Date().toISOString()
          } : {
            error: 'Template Reply Send Failed',
            message: 'Failed to send template reply without detailed error info',
            reply_type: 'template',
            retry_count: newRetryCount,
            invalid_post: isInvalidPost,
            timestamp: new Date().toISOString()
          };
          
          await supabase
            .from('thread_replies')
            .update({ 
              reply_status: 'failed',
              retry_count: newRetryCount,
              last_retry_at: new Date().toISOString(),
              error_details: errorDetails
            })
            .eq('reply_id', reply.reply_id);
            
          if (isInvalidPost) {
            console.log(`⚠️ 無効な投稿IDのためリトライスキップ: ${reply.reply_id}`);
          }
        }
      } catch (error) {
        console.error(`❌ 定型文返信送信エラー:`, error);
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

// アクセストークンを取得（直接復号 - cryptoモジュール使用）
async function getAccessToken(persona: any): Promise<string | null> {
  try {
    console.log('🔑 アクセストークン取得開始（直接復号方式）');

    // Step 1: user_api_keysから暗号化キーを取得して直接復号
    const decryptedFromDb = await getUserApiKeyDecrypted(
      supabase, persona.user_id, 'threads_access_token'
    );
    
    if (decryptedFromDb) {
      console.log('✅ user_api_keysから復号成功');
      return decryptedFromDb;
    }

    // Step 2: personasテーブルのトークンを直接復号
    const { data: personaWithToken } = await supabase
      .from('personas')
      .select('threads_access_token')
      .eq('id', persona.id)
      .maybeSingle();

    if (!personaWithToken?.threads_access_token) {
      console.error('❌ アクセストークンが見つかりません');
      return null;
    }

    const token = await decryptIfNeeded(
      personaWithToken.threads_access_token,
      `process-unhandled:getAccessToken:${persona.id}`
    );
    
    if (token) {
      console.log('✅ personasテーブルから復号成功');
      return token;
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