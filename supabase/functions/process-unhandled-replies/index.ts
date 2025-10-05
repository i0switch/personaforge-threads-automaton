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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 未処理リプライの再処理開始...');

    // 未処理のリプライを取得（auto_reply_sent=false かつ該当ペルソナ）
    const { data: unprocessedReplies } = await supabase
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
      .eq('auto_reply_sent', false)
      .in('personas.name', ['令和ギャル占い師@レイカさん', '守護霊鑑定OL🦊みさき'])
      .order('created_at', { ascending: false })
      .limit(100); // 一度に100件まで処理

    if (!unprocessedReplies || unprocessedReplies.length === 0) {
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

    console.log(`📋 処理対象リプライ数: ${unprocessedReplies.length}`);

    let processedCount = 0;
    let successCount = 0;

    for (const reply of unprocessedReplies) {
      try {
        const persona = reply.personas;
        console.log(`\n🔄 処理中: ${reply.id} - "${reply.reply_text}" (Persona: ${persona.name})`);

        processedCount++;

        // 🔒 処理開始前に即座にステータスを更新（楽観的ロック）
        const { error: lockError } = await supabase
          .from('thread_replies')
          .update({ 
            auto_reply_sent: true,
            reply_status: 'processing'
          })
          .eq('reply_id', reply.reply_id)
          .eq('auto_reply_sent', false); // 既に処理済みでないことを確認
        
        if (lockError) {
          console.error(`❌ リプライロック失敗（既に処理中の可能性）: ${reply.reply_id}`, lockError);
          continue; // 既に他の処理が走っている可能性があるのでスキップ
        }
        
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
              // エラー時はステータスを更新
              await supabase
                .from('thread_replies')
                .update({ 
                  reply_status: 'failed',
                  auto_reply_sent: false // リトライ可能にする
                })
                .eq('reply_id', reply.reply_id);
            } else {
              console.log(`✅ AI自動返信呼び出し成功: ${reply.id}`);
              replySent = true;
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
            .update({ reply_status: 'pending' })
            .eq('reply_id', reply.reply_id);
        }
        
        if (replySent) {
          successCount++;
        }

      } catch (error) {
        console.error(`❌ リプライ処理エラー ${reply.id}:`, error);
        // エラー時はロックを解除
        await supabase
          .from('thread_replies')
          .update({ 
            reply_status: 'failed',
            auto_reply_sent: false
          })
          .eq('reply_id', reply.reply_id);
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
          const success = await sendThreadsReply(persona, reply.reply_id, setting.response_template);
          
          if (success) {
            console.log(`✅ 定型文返信送信成功`);
            // 送信成功時にステータスを更新
            await supabase
              .from('thread_replies')
              .update({ reply_status: 'sent' })
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
            // 送信失敗時はステータスを更新
            await supabase
              .from('thread_replies')
              .update({ reply_status: 'failed' })
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

// Threads返信を送信
async function sendThreadsReply(persona: any, replyToId: string, responseText: string): Promise<boolean> {
  try {
    console.log(`📤 Threads返信送信開始: "${responseText}" (Reply to: ${replyToId})`);

    // アクセストークンを取得
    const accessToken = await getAccessToken(persona);
    if (!accessToken) {
      console.error('❌ アクセストークン取得失敗');
      return false;
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
      return false;
    }

    const containerData = await containerResponse.json();
    console.log(`✅ コンテナ作成成功: ${containerData.id}`);

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
      return false;
    }

    const publishData = await publishResponse.json();
    console.log(`🎉 返信送信成功: ${publishData.id}`);
    return true;

  } catch (error) {
    console.error('❌ Threads返信送信エラー:', error);
    return false;
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