import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    console.log('Starting webhook reply check...');
    
    // パフォーマンス最適化：バッチ処理でアクティブなペルソナとその設定を取得
    const { data: activeSettings, error } = await supabase
      .from('reply_check_settings')
      .select(`
        id,
        persona_id,
        user_id,
        check_interval_minutes,
        last_check_at,
        personas!inner (
          id,
          name,
          user_id,
          threads_username,
          ai_auto_reply_enabled,
          is_active
        )
      `)
      .eq('is_active', true)
      .eq('personas.is_active', true);

    if (error) {
      console.error('Failed to fetch reply check settings:', error);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    if (!activeSettings || activeSettings.length === 0) {
      console.log('No active reply check settings found');
      return new Response(JSON.stringify({ 
        message: 'No active settings found',
        checked_personas: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log(`Found ${activeSettings.length} active reply check settings`);
    let totalRepliesFound = 0;
    let checkedPersonas = 0;

    // 並列処理で複数のペルソナを同時にチェック
    const checkPromises = activeSettings.map(async (setting) => {
      const persona = setting.personas;
      
      try {
        console.log(`Checking replies for persona: ${persona.name} (${persona.id})`);
        
        // アクセストークンを個別に取得（復号化のため）
        const { data: personaWithToken } = await supabase
          .from('personas')
          .select('threads_access_token')
          .eq('id', persona.id)
          .maybeSingle();

        if (!personaWithToken?.threads_access_token) {
          console.log(`Skipping persona ${persona.id} - no access token`);
          return 0;
        }

        // 復号化されたアクセストークンを取得
        const { data: decryptedToken, error: decryptError } = await supabase
          .rpc('decrypt_access_token', { encrypted_token: personaWithToken.threads_access_token });

        if (decryptError || !decryptedToken) {
          console.log(`Skipping persona ${persona.id} - token decryption failed:`, decryptError);
          return 0;
        }

        // 最近の投稿を取得（過去24時間）
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentPosts } = await supabase
          .from('posts')
          .select('id, content, published_at')
          .eq('persona_id', persona.id)
          .eq('status', 'published')
          .not('published_at', 'is', null)
          .gte('published_at', twentyFourHoursAgo)
          .order('published_at', { ascending: false })
          .limit(5); // 最新5件のみチェック

        if (!recentPosts || recentPosts.length === 0) {
          console.log(`No recent posts found for persona ${persona.id}`);
          return 0;
        }

        let repliesFound = 0;
        
        // 各投稿のリプライをチェック
        for (const post of recentPosts) {
          try {
            const newReplies = await checkRepliesForPost(post, persona, decryptedToken);
            repliesFound += newReplies;
          } catch (error) {
            console.error(`Error checking post ${post.id}:`, error);
          }
        }

        // last_check_atを更新
        await supabase
          .from('reply_check_settings')
          .update({ last_check_at: new Date().toISOString() })
          .eq('id', setting.id);

        checkedPersonas++;
        return repliesFound;

      } catch (error) {
        console.error(`Error processing persona ${persona.id}:`, error);
        return 0;
      }
    });

    // 全ての並列処理の完了を待つ
    const results = await Promise.all(checkPromises);
    totalRepliesFound = results.reduce((sum, count) => sum + count, 0);

    console.log(`Reply check completed. Checked ${checkedPersonas} personas, found ${totalRepliesFound} new replies.`);

    return new Response(JSON.stringify({ 
      success: true,
      checked_personas: checkedPersonas,
      new_replies_found: totalRepliesFound,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Webhook reply check error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

async function checkRepliesForPost(post: any, persona: any, accessToken: string): Promise<number> {
  try {
    console.log(`Checking replies for post: ${post.id}`);
    
    // Threads APIから投稿のリプライを取得
    const threadsApiUrl = `https://graph.threads.net/v1.0/${post.id}/replies?fields=id,username,text,timestamp,media_type,permalink&access_token=${accessToken}`;
    
    const response = await fetch(threadsApiUrl);
    if (!response.ok) {
      console.error(`Failed to fetch replies for post ${post.id}: ${response.status}`);
      return 0;
    }

    const repliesData = await response.json();
    
    if (!repliesData.data || repliesData.data.length === 0) {
      return 0;
    }

    let newRepliesCount = 0;

    for (const reply of repliesData.data) {
      // 自分自身のリプライをスキップ
      if (reply.username === persona.threads_username) {
        continue;
      }

      // 既存のリプライかチェック
      const { data: existingReply } = await supabase
        .from('thread_replies')
        .select('id')
        .eq('reply_id', reply.id)
        .eq('persona_id', persona.id)
        .maybeSingle();

      if (existingReply) {
        continue; // 既に保存済み
      }

      // 新しいリプライを保存
      const { error: insertError } = await supabase
        .from('thread_replies')
        .insert({
          user_id: persona.user_id,
          persona_id: persona.id,
          original_post_id: post.id,
          reply_id: reply.id,
          reply_text: reply.text || '',
          reply_author_id: reply.username,
          reply_author_username: reply.username,
          reply_timestamp: new Date(reply.timestamp).toISOString(),
          auto_reply_sent: false,
          reply_status: 'pending'
        });

      if (insertError) {
        console.error('Failed to save reply:', insertError);
        continue;
      }

      console.log(`Saved new reply: ${reply.id} from ${reply.username}`);
      newRepliesCount++;

      // AI自動返信が有効な場合、threads-auto-replyを呼び出し
      if (persona.ai_auto_reply_enabled) {
        try {
          console.log(`Triggering auto-reply for persona ${persona.id}`);
          
          const autoReplyResponse = await supabase.functions.invoke('threads-auto-reply', {
            body: {
              postContent: post.content,
              replyContent: reply.text,
              replyId: reply.id,
              personaId: persona.id,
              userId: persona.user_id
            }
          });

          if (autoReplyResponse.error) {
            console.error('Auto-reply failed:', autoReplyResponse.error);
          } else {
            console.log('Auto-reply triggered successfully');
          }
        } catch (autoReplyError) {
          console.error('Error triggering auto-reply:', autoReplyError);
        }
      }
    }

    return newRepliesCount;

  } catch (error) {
    console.error(`Error checking replies for post ${post.id}:`, error);
    return 0;
  }
}