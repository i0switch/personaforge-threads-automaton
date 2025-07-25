
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
    console.log('Starting reply check...');

    // アクティブなリプライチェック設定を取得
    const { data: checkSettings } = await supabase
      .from('reply_check_settings')
      .select(`
        *,
        personas (
          id,
          name,
          user_id,
          threads_username,
          ai_auto_reply_enabled
        )
      `)
      .eq('is_active', true);

    if (!checkSettings || checkSettings.length === 0) {
      console.log('No active reply check settings found');
      return new Response(JSON.stringify({ message: 'No active settings' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    let totalRepliesFound = 0;

    for (const setting of checkSettings) {
      const persona = setting.personas;
      if (!persona?.id) {
        console.log(`Skipping invalid persona`);
        continue;
      }

      // アクセストークンを個別に取得（復号化のため）
      const { data: personaWithToken } = await supabase
        .from('personas')
        .select('threads_access_token')
        .eq('id', persona.id)
        .maybeSingle();

      if (!personaWithToken?.threads_access_token) {
        console.log(`Skipping persona ${persona.id} - no access token`);
        continue;
      }

      // 復号化されたアクセストークンを取得
      const { data: decryptedToken, error: decryptError } = await supabase
        .rpc('decrypt_access_token', { encrypted_token: personaWithToken.threads_access_token });

      if (decryptError || !decryptedToken) {
        console.log(`Skipping persona ${persona.id} - token decryption failed`);
        continue;
      }

      // ペルソナオブジェクトにアクセストークンを追加
      const personaWithDecryptedToken = {
        ...persona,
        threads_access_token: decryptedToken
      };

      try {
        console.log(`Checking replies for persona: ${personaWithDecryptedToken.name}`);

        // 最近投稿された投稿のIDを取得
        const { data: recentPosts } = await supabase
          .from('posts')
          .select('id, content, published_at')
          .eq('persona_id', personaWithDecryptedToken.id)
          .eq('status', 'published')
          .not('published_at', 'is', null)
          .order('published_at', { ascending: false })
          .limit(10);

        if (!recentPosts || recentPosts.length === 0) {
          console.log(`No recent posts found for persona ${personaWithDecryptedToken.id}`);
          continue;
        }

        // 各投稿のリプライをチェック
        for (const post of recentPosts) {
          const repliesFound = await checkRepliesForPost(personaWithDecryptedToken, post.id);
          totalRepliesFound += repliesFound;
        }

        // 最後のチェック時刻を更新
        await supabase
          .from('reply_check_settings')
          .update({ last_check_at: new Date().toISOString() })
          .eq('id', setting.id);

      } catch (error) {
        console.error(`Error checking replies for persona ${persona?.id}:`, error);
      }
    }

    console.log(`Reply check completed. Found ${totalRepliesFound} new replies.`);

    return new Response(JSON.stringify({ 
      success: true,
      repliesFound: totalRepliesFound,
      message: 'Reply check completed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in reply check:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

async function checkRepliesForPost(persona: any, postId: string): Promise<number> {
  try {
    // Threads APIを使用してメンション・リプライを検索
    // Note: Threads APIの実際のエンドポイントは公式ドキュメントを確認してください
    const response = await fetch(`https://graph.threads.net/v1.0/me/threads?fields=id,text,username,timestamp,reply_to_id&access_token=${persona.threads_access_token}`);
    
    if (!response.ok) {
      console.error(`Failed to fetch threads for persona ${persona.id}:`, response.status);
      return 0;
    }

    const data = await response.json();
    let newRepliesCount = 0;

    if (data.data) {
      for (const thread of data.data) {
        // リプライかどうかを判定
        if (thread.reply_to_id) {
          // 自分自身のリプライをスキップ（強化版フィルタ）
          const isSelf = 
            thread.username === persona.name ||
            thread.username === persona.threads_username ||
            thread.owner_id === persona.user_id ||
            thread.author_id === persona.user_id;
          
          if (isSelf) {
            console.log(`Skipping self-reply ${thread.id} from persona ${persona.name}`);
            continue;
          }

          // すでに保存されているかチェック
          const { data: existingReply } = await supabase
            .from('thread_replies')
            .select('id')
            .eq('reply_id', thread.id)
            .single();

          if (!existingReply) {
            // 新しいリプライを保存
            const { error: insertError } = await supabase
              .from('thread_replies')
              .insert({
                user_id: persona.user_id,
                persona_id: persona.id,
                original_post_id: thread.reply_to_id,
                reply_id: thread.id,
                reply_text: thread.text || '',
                reply_author_id: thread.username || '',
                reply_author_username: thread.username,
                reply_timestamp: new Date(thread.timestamp || Date.now()).toISOString()
              });

            if (!insertError) {
              newRepliesCount++;
              console.log(`New reply saved: ${thread.id}`);

              // ペルソナの自動返信設定を取得
              const { data: autoRepliesSettings } = await supabase
                .from('auto_replies')
                .select('*')
                .eq('persona_id', persona.id)
                .eq('is_active', true);
              
              console.log(`🎯 自動返信設定の取得結果 - persona: ${persona.name}, 設定数: ${autoRepliesSettings?.length || 0}`);

              // 自動返信設定の確認
              if (!autoRepliesSettings || autoRepliesSettings.length === 0) {
                console.log(`自動返信設定がOFFになっています - persona: ${persona.name}`);
              } else {
                console.log(`自動返信設定が有効 - persona: ${persona.name}`);

                // トリガー自動返信（定型文）の処理
                const templateReplySent = await processKeywordTriggerReplies(supabase, persona, {
                  id: thread.id,
                  text: thread.text,
                  username: thread.username
                });

                if (templateReplySent) {
                  console.log(`定型文返信を送信したため、AI返信はスキップします`);
                } else if (persona.ai_auto_reply_enabled) {
                  // AI自動返信チェック
                  console.log(`Triggering AI auto-reply for persona ${persona.name}`);
                  try {
                    const { data: autoReplyResponse, error: autoReplyError } = await supabase.functions.invoke('threads-auto-reply', {
                      body: {
                        postContent: '', // 元投稿の内容
                        replyContent: thread.text,
                        replyId: thread.id,
                        personaId: persona.id,
                        userId: persona.user_id
                      }
                    });

                    if (autoReplyError) {
                      console.error(`Auto-reply error for ${thread.id}:`, autoReplyError);
                    } else {
                      console.log(`Auto-reply sent for ${thread.id}:`, autoReplyResponse);
                    }
                  } catch (autoReplyErr) {
                    console.error(`Failed to send auto-reply for ${thread.id}:`, autoReplyErr);
                  }
                }
              }
            }
          }
        }
      }
    }

    return newRepliesCount;
  } catch (error) {
    console.error(`Error checking replies for post ${postId}:`, error);
    return 0;
  }
}

// キーワードトリガー返信の処理
async function processKeywordTriggerReplies(supabase: any, persona: any, reply: any): Promise<boolean> {
  try {
    console.log(`\n🔍 処理中: "${reply.text}" (ID: ${reply.id})`)
    
    // このペルソナのトリガー返信設定を取得
    const { data: triggerSettings, error } = await supabase
      .from('auto_replies')
      .select('*')
      .eq('persona_id', persona.id)
      .eq('is_active', true)

    if (error) {
      console.error('トリガー返信設定の取得エラー:', error)
      return false
    }

    if (!triggerSettings || triggerSettings.length === 0) {
      console.log('❌ アクティブなトリガー返信設定がありません')
      return false
    }

    console.log(`🎯 定型文返信設定: ${triggerSettings.length}件`)

    const replyText = reply.text?.trim().toLowerCase() || ''
    
    // 各トリガー設定をチェック
    for (const setting of triggerSettings) {
      const keywords = setting.trigger_keywords || []
      let matched = false

      for (const keyword of keywords) {
        const cleanKeyword = keyword.trim().toLowerCase()
        const cleanReplyText = replyText
        
        console.log(`🔍 クリーンテキスト: "${cleanReplyText}" vs "${cleanKeyword}"`)
        console.log(`🔍 キーワード "${keyword}" vs "${reply.text}" → ${cleanReplyText.includes(cleanKeyword)}`)
        
        if (cleanReplyText.includes(cleanKeyword)) {
          matched = true
          console.log(`✅ キーワード "${keyword}" がマッチしました！`)
          break
        }
      }

      if (matched) {
        console.log(`🚀 トリガー返信を送信中: "${setting.response_template}"`)
        
        // トリガー返信を送信
        const success = await sendThreadsReply(supabase, persona, reply.id, setting.response_template)
        
        if (success) {
          // アクティビティログを記録
          await supabase
            .from('activity_logs')
            .insert({
              user_id: persona.user_id,
              persona_id: persona.id,
              action_type: 'keyword_auto_reply_sent',
              description: `キーワード自動返信を送信: "${setting.response_template.substring(0, 50)}..."`,
              metadata: {
                reply_id: reply.id,
                keyword_matched: keywords.find(k => replyText.includes(k.trim().toLowerCase())),
                response_sent: setting.response_template
              }
            })
          
          // 一つでもマッチしたら true を返す（複数のトリガーが同時に発動しないようにする）
          return true
        }
      }
    }

    console.log('❌ マッチするキーワードがありませんでした')
    return false
  } catch (error) {
    console.error('キーワードトリガー返信処理エラー:', error)
    return false
  }
}

// Threads API を使用して返信を送信
async function sendThreadsReply(supabase: any, persona: any, replyToId: string, responseText: string): Promise<boolean> {
  try {
    console.log('🔧 sendThreadsReply started:', { personaId: persona.id, replyToId, responseText })
    
    // アクセストークンを取得・復号化（新しい方法）
    let decryptedToken = null;
    
    console.log('🔑 Attempting to retrieve token via edge function...')
    try {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('retrieve-secret', {
        body: { 
          key: `persona_${persona.id}_threads_token`,
          user_id: persona.user_id
        }
      });
      
      console.log('🔑 Edge function response:', { data: tokenData, error: tokenError })
      
      if (tokenData?.value && !tokenError) {
        decryptedToken = tokenData.value;
        console.log('✅ Token retrieved via edge function successfully');
      } else {
        console.log('❌ Edge function token retrieval failed:', tokenError);
      }
    } catch (edgeFunctionError) {
      console.log('❌ Edge function retrieval failed with exception:', edgeFunctionError);
    }
    
    // フォールバック: 旧式の復号化方法
    if (!decryptedToken) {
      console.log('🔄 Trying legacy token retrieval method...')
      const { data: personaWithToken } = await supabase
        .from('personas')
        .select('threads_access_token')
        .eq('id', persona.id)
        .maybeSingle();

      console.log('🔄 Legacy token query result:', { hasToken: !!personaWithToken?.threads_access_token })

      if (!personaWithToken?.threads_access_token) {
        console.error('❌ No threads access token found for persona:', persona.id)
        return false
      }

      const { data: legacyDecryptedToken, error: decryptError } = await supabase
        .rpc('decrypt_access_token', { encrypted_token: personaWithToken.threads_access_token });

      console.log('🔄 Legacy decryption result:', { hasToken: !!legacyDecryptedToken, error: decryptError })

      if (decryptError || !legacyDecryptedToken) {
        console.error('❌ Token decryption failed for persona:', persona.id, decryptError)
        return false
      }
      
      decryptedToken = legacyDecryptedToken;
      console.log('✅ Legacy token retrieval successful')
    }

    if (!decryptedToken) {
      console.error('❌ No valid access token found for persona:', persona.id)
      return false
    }

    console.log(`📤 Threads返信送信中: "${responseText}" (Reply to: ${replyToId})`)

    // threads_user_idが無い場合は「me」を使用
    const userId = persona.threads_user_id || 'me'
    
    console.log(`📤 Using user ID: ${userId} for persona: ${persona.name}`)

    // コンテナを作成
    const createResponse = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT_POST',
        text: responseText,
        reply_to_id: replyToId,
        access_token: decryptedToken
      })
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('Threads container creation failed:', errorText)
      return false
    }

    const containerData = await createResponse.json()
    console.log('🎯 Container created:', containerData.id)

    // 少し待機してから投稿
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 投稿を公開
    const publishResponse = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: decryptedToken
      })
    })

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text()
      console.error('Threads publish failed:', errorText)
      return false
    }

    const publishData = await publishResponse.json()
    console.log('✅ キーワード返信投稿成功:', publishData.id)
    return true

  } catch (error) {
    console.error('Threads返信送信エラー:', error)
    return false
  }
}
