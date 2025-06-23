
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
    console.log('Webhook received');

    // GET requestはThreads webhook verification用
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('Webhook verification request:', { mode, token, challenge });

      // Webhook設定をチェック
      const { data: webhookSettings } = await supabase
        .from('webhook_settings')
        .select('verify_token')
        .eq('is_active', true)
        .single();

      if (mode === 'subscribe' && token === webhookSettings?.verify_token) {
        console.log('Webhook verification successful');
        return new Response(challenge, { status: 200 });
      } else {
        console.log('Webhook verification failed');
        return new Response('Verification failed', { status: 403 });
      }
    }

    // POST requestはThreads eventデータ
    if (req.method === 'POST') {
      const webhookData = await req.json();
      console.log('Webhook data received:', JSON.stringify(webhookData, null, 2));

      // Threads webhook eventを処理
      if (webhookData.object === 'page') {
        for (const entry of webhookData.entry) {
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.field === 'mentions' && change.value) {
                await processReplyMention(change.value);
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ status: 'OK' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

async function processReplyMention(mentionData: any) {
  try {
    console.log('Processing reply mention:', mentionData);

    // Threads APIから詳細情報を取得
    const replyId = mentionData.media_id || mentionData.id;
    if (!replyId) {
      console.error('No reply ID found in mention data');
      return;
    }

    // ペルソナのThreadsアクセストークンを取得
    const { data: personas } = await supabase
      .from('personas')
      .select('*')
      .not('threads_access_token', 'is', null);

    for (const persona of personas || []) {
      try {
        // Threads APIからリプライ詳細を取得
        const response = await fetch(`https://graph.threads.net/v1.0/${replyId}?fields=id,text,username,timestamp,media_type,reply_to_id&access_token=${persona.threads_access_token}`);
        
        if (!response.ok) {
          console.error(`Failed to fetch reply details for persona ${persona.id}:`, response.status);
          continue;
        }

        const replyData = await response.json();
        console.log('Reply data from Threads API:', replyData);

        // リプライをデータベースに保存
        const { error: insertError } = await supabase
          .from('thread_replies')
          .insert({
            user_id: persona.user_id,
            persona_id: persona.id,
            original_post_id: replyData.reply_to_id || '',
            reply_id: replyData.id,
            reply_text: replyData.text || '',
            reply_author_id: replyData.username || '',
            reply_author_username: replyData.username,
            reply_timestamp: new Date(replyData.timestamp || Date.now()).toISOString()
          });

        if (insertError) {
          console.error('Failed to insert reply:', insertError);
          continue;
        }

        console.log('Reply saved successfully');

        // 自動返信が有効かチェック
        const { data: profile } = await supabase
          .from('profiles')
          .select('auto_reply_enabled')
          .eq('user_id', persona.user_id)
          .single();

        if (profile?.auto_reply_enabled) {
          // 自動返信を送信
          await supabase.functions.invoke('threads-auto-reply', {
            body: {
              postContent: '', // 元投稿の内容が必要な場合は取得
              replyContent: replyData.text,
              personaId: persona.id,
              userId: persona.user_id
            }
          });
        }

      } catch (error) {
        console.error(`Error processing reply for persona ${persona.id}:`, error);
      }
    }

  } catch (error) {
    console.error('Error in processReplyMention:', error);
  }
}
