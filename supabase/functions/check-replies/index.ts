
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
          ai_auto_reply_enabled,
          auto_reply_enabled
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

      console.log(`🚀 リプライチェック開始 - persona: ${persona.name} (ID: ${persona.id})`);
      
      // アクセストークンを取得
      let accessToken = null;
      try {
        // retrieve-secret関数を使用してアクセストークンを復号化
        const tokenResult = await supabase.functions.invoke('retrieve-secret', {
          body: {
            key: `threads_access_token_${persona.id}`,
            fallback: personaWithToken.threads_access_token
          }
        });
        
        if (tokenResult.data?.secret) {
          accessToken = tokenResult.data.secret;
          console.log(`✅ 暗号化トークン復号化成功 - persona: ${persona.name}`);
        } else if (personaWithToken.threads_access_token.startsWith('THAA')) {
          // 暗号化されていないトークンをそのまま使用
          accessToken = personaWithToken.threads_access_token;
          console.log(`✅ 非暗号化トークン使用 - persona: ${persona.name}`);
        } else {
          console.error(`❌ アクセストークン取得失敗 - persona: ${persona.name}`, {
            hasToken: !!personaWithToken.threads_access_token,
            tokenPrefix: personaWithToken.threads_access_token?.substring(0, 8) + '...',
            retrieveError: tokenResult.error
          });
          continue;
        }
      } catch (error) {
        console.error(`❌ アクセストークン処理エラー - persona: ${persona.name}:`, error);
        // フォールバック：暗号化されていないトークンを試す
        if (personaWithToken.threads_access_token?.startsWith('THAA')) {
          accessToken = personaWithToken.threads_access_token;
          console.log(`🔄 フォールバック成功 - persona: ${persona.name}`);
        } else {
          console.log(`Skipping persona ${persona.id} - token decryption failed`);
          continue;
        }
      }

      // ペルソナオブジェクトにアクセストークンを追加
      const personaWithDecryptedToken = {
        ...persona,
        threads_access_token: accessToken
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
    console.log(`🔍 Fetching threads for persona ${persona.id}`);
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
            .select('id, auto_reply_sent')
            .eq('reply_id', thread.id)
            .single();

           let shouldProcessAutoReply = false;

           if (!existingReply) {
             // 新しいリプライを保存
             console.log(`🆕 新しいリプライを保存中: ${thread.id} - "${thread.text}"`);
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
                 reply_timestamp: new Date(thread.timestamp || Date.now()).toISOString(),
                 auto_reply_sent: false
               });

             if (!insertError) {
               newRepliesCount++;
               shouldProcessAutoReply = true;
               console.log(`✅ 新しいリプライ保存完了: ${thread.id}`);
               
               // アクティビティログを記録
               await supabase
                 .from('activity_logs')
                 .insert({
                   user_id: persona.user_id,
                   persona_id: persona.id,
                   action_type: 'reply_received',
                   description: `新しいリプライを受信: @${thread.username}`,
                   metadata: {
                     author: thread.username,
                     reply_id: thread.id,
                     reply_text: thread.text
                   }
                 });
             } else {
               console.error(`❌ リプライ保存エラー: ${thread.id}`, insertError);
             }
           } else if (!existingReply.auto_reply_sent) {
             // 既存のリプライで、まだ自動返信が送信されていない場合
             shouldProcessAutoReply = true;
             console.log(`🔄 未送信自動返信を処理: ${thread.id}`);
           }

           // 自動返信の処理（キーワード自動返信 + AI自動返信）
           if (shouldProcessAutoReply) {
             console.log(`🤖 自動返信処理開始: ${thread.id} for persona ${persona.name}`);
             
             const replyObject = {
               id: thread.id,
               text: thread.text,
               username: thread.username,
               timestamp: thread.timestamp,
               replied_to: { id: thread.reply_to_id }
             };
             
             try {
               // キーワード自動返信をチェック
               if (persona.auto_reply_enabled) {
                 const templateResult = await processTemplateAutoReply(persona, replyObject);
                 if (templateResult.sent) {
                   console.log(`✅ 定型文自動返信成功 - reply: ${thread.id}`);
                   await updateAutoReplySentFlag(thread.id, true);
                   continue; // 定型文返信が送信されたら、AI返信はスキップ
                 }
               }

                // AI自動返信をチェック
                if (persona.ai_auto_reply_enabled) {
                  const autoReplyResult = await supabase.functions.invoke('threads-auto-reply', {
                    body: {
                      postContent: 'Original post content', // 必要に応じて実際の投稿内容を取得
                      replyContent: thread.text,
                      replyId: thread.id,
                      personaId: persona.id,
                      userId: persona.user_id
                    }
                  });

                  if (autoReplyResult.error) {
                    console.error(`❌ AI自動返信呼び出しエラー:`, autoReplyResult.error);
                  } else {
                    console.log(`✅ AI自動返信呼び出し成功: ${thread.id}`);
                  }
                }
              } catch (error) {
                console.error(`❌ 自動返信処理エラー:`, error);
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

  const replyText = (reply.text || '').trim().toLowerCase();
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
          const success = await sendThreadsReply(persona, reply.id, setting.response_template);
          
          if (success) {
            console.log(`✅ 定型文返信送信成功`);
            // アクティビティログを記録
            await logActivity(persona.user_id, persona.id, 'template_auto_reply_sent',
              `定型文自動返信を送信: "${setting.response_template.substring(0, 50)}..."`, {
                reply_id: reply.id,
                keyword_matched: keyword,
                response_sent: setting.response_template
              });

            return { sent: true, method: 'template' };
          } else {
            console.error(`❌ 定型文返信送信失敗`);
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

    // Step 1: 新しい方法でトークンを取得（キー名を統一）
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

