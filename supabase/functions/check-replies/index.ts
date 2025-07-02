
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
    console.log('Starting reply check process...');

    // アクティブなペルソナとリプライチェック設定を取得
    const { data: personas, error: personasError } = await supabase
      .from('personas')
      .select(`
        id,
        name,
        user_id,
        threads_access_token,
        threads_username,
        ai_auto_reply_enabled,
        reply_check_settings (
          id,
          check_interval_minutes,
          is_active,
          last_check_at
        )
      `)
      .eq('is_active', true)
      .not('threads_access_token', 'is', null);

    if (personasError) {
      console.error('Error fetching personas:', personasError);
      throw personasError;
    }

    if (!personas || personas.length === 0) {
      console.log('No active personas with access tokens found');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No active personas to check' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    let totalRepliesFound = 0;

    for (const persona of personas) {
      try {
        console.log(`Checking replies for persona: ${persona.name} (${persona.id})`);

        // 最近のリプライをチェック
        const repliesFound = await checkRepliesForPersona(persona);
        totalRepliesFound += repliesFound;

        // 最後のチェック時刻を更新
        if (persona.reply_check_settings && persona.reply_check_settings.length > 0) {
          const settingId = persona.reply_check_settings[0].id;
          await supabase
            .from('reply_check_settings')
            .update({ last_check_at: new Date().toISOString() })
            .eq('id', settingId);
        }

      } catch (error) {
        console.error(`Error checking replies for persona ${persona.id}:`, error);
      }
    }

    console.log(`Reply check completed. Found ${totalRepliesFound} new replies.`);

    return new Response(JSON.stringify({ 
      success: true,
      repliesFound: totalRepliesFound,
      message: 'Reply check completed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in reply check function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

async function checkRepliesForPersona(persona: any): Promise<number> {
  try {
    console.log(`Fetching threads for persona: ${persona.name}`);

    // Threads APIを使用してメンションとリプライを取得
    const threadsUrl = `https://graph.threads.net/v1.0/me/threads?fields=id,text,username,timestamp,reply_to_id,media_type&access_token=${persona.threads_access_token}`;
    
    const response = await fetch(threadsUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch threads for persona ${persona.id}:`, response.status, errorText);
      return 0;
    }

    const data = await response.json();
    let newRepliesCount = 0;

    console.log(`Fetched ${data.data?.length || 0} threads for persona ${persona.name}`);

    if (data.data && Array.isArray(data.data)) {
      for (const thread of data.data) {
        try {
          // リプライかどうかを判定（reply_to_idがある場合）
          if (thread.reply_to_id) {
            console.log(`Found reply: ${thread.id} -> ${thread.reply_to_id}`);

            // 自分自身のリプライかチェック
            if (thread.username === persona.threads_username || 
                thread.username === persona.name) {
              console.log(`Skipping self-reply from ${thread.username}`);
              continue;
            }

            // すでに保存されているかチェック
            const { data: existingReply } = await supabase
              .from('thread_replies')
              .select('id')
              .eq('reply_id', thread.id)
              .single();

            if (!existingReply) {
              console.log(`Saving new reply: ${thread.id}`);

              // 新しいリプライを保存
              const { error: insertError } = await supabase
                .from('thread_replies')
                .insert({
                  user_id: persona.user_id,
                  persona_id: persona.id,
                  original_post_id: thread.reply_to_id,
                  reply_id: thread.id,
                  reply_text: thread.text || '',
                  reply_author_id: thread.username || 'unknown',
                  reply_author_username: thread.username || 'unknown',
                  reply_timestamp: new Date(thread.timestamp || Date.now()).toISOString()
                });

              if (insertError) {
                console.error('Failed to save reply:', insertError);
              } else {
                newRepliesCount++;
                console.log(`Successfully saved reply: ${thread.id}`);

                // AI自動返信が有効な場合
                if (persona.ai_auto_reply_enabled) {
                  console.log(`Triggering AI auto-reply for persona ${persona.name}`);
                  await triggerAutoReply(persona, thread);
                }
              }
            } else {
              console.log(`Reply ${thread.id} already exists, skipping`);
            }
          }
        } catch (threadError) {
          console.error(`Error processing thread ${thread.id}:`, threadError);
        }
      }
    }

    console.log(`Found ${newRepliesCount} new replies for persona ${persona.name}`);
    return newRepliesCount;
  } catch (error) {
    console.error(`Error checking replies for persona ${persona.id}:`, error);
    return 0;
  }
}

async function triggerAutoReply(persona: any, replyThread: any) {
  try {
    console.log(`Invoking auto-reply function for reply ${replyThread.id}`);
    
    const { data, error } = await supabase.functions.invoke('threads-auto-reply', {
      body: {
        postContent: '', // 元投稿の内容（必要に応じて取得）
        replyContent: replyThread.text || '',
        replyId: replyThread.id,
        personaId: persona.id,
        userId: persona.user_id
      }
    });

    if (error) {
      console.error(`Auto-reply error for ${replyThread.id}:`, error);
    } else {
      console.log(`Auto-reply triggered successfully for ${replyThread.id}`);
    }
  } catch (error) {
    console.error(`Failed to trigger auto-reply for ${replyThread.id}:`, error);
  }
}
