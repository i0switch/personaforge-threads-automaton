
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
                 reply_timestamp: new Date(thread.timestamp || Date.now()).toISOString()
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
           } else if (!existingReply.auto_reply_sent && persona.ai_auto_reply_enabled) {
             // 既存のリプライで、まだAI自動返信が送信されていない場合
             shouldProcessAutoReply = true;
             console.log(`🔄 未送信AI自動返信を処理: ${thread.id}`);
           }

           // AI自動返信の処理
           if (shouldProcessAutoReply && persona.ai_auto_reply_enabled) {
             console.log(`🤖 AI自動返信処理開始: ${thread.id} for persona ${persona.name}`);
             try {
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
             } catch (error) {
               console.error(`❌ AI自動返信処理エラー:`, error);
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

