
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
        console.log(`🚀 リプライチェック開始 - persona: ${personaWithDecryptedToken.name} (ID: ${personaWithDecryptedToken.id})`);
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

