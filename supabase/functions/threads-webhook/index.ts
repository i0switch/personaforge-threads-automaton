
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

      // アクティブなペルソナでverify_tokenをチェック
      const { data: personas } = await supabase
        .from('personas')
        .select('webhook_verify_token')
        .eq('is_active', true)
        .not('webhook_verify_token', 'is', null);

      const isValidToken = personas?.some(persona => persona.webhook_verify_token === token);

      if (mode === 'subscribe' && isValidToken) {
        console.log('Webhook verification successful');
        return new Response(challenge, { status: 200 });
      } else {
        console.log('Webhook verification failed');
        return new Response('Verification failed', { status: 403 });
      }
    }

    // POST requestはThreads eventデータ
    if (req.method === 'POST') {
      const rawBody = await req.text();
      console.log('Raw webhook body:', rawBody);

      //署名検証のためにヘッダーを取得
      const signature = req.headers.get('x-hub-signature-256');
      console.log('Webhook signature:', signature);

      if (!signature) {
        console.error('No signature provided');
        return new Response('Signature required', { status: 401 });
      }

      const webhookData = JSON.parse(rawBody);
      console.log('Webhook data received:', JSON.stringify(webhookData, null, 2));

      // 署名検証は各ペルソナのApp Secretで試行
      let validatedPersona = null;
      const { data: personas } = await supabase
        .from('personas')
        .select('*')
        .eq('is_active', true)
        .not('threads_app_secret', 'is', null);

      for (const persona of personas || []) {
        if (await verifySignature(rawBody, signature, persona.threads_app_secret)) {
          validatedPersona = persona;
          console.log('Signature validated for persona:', persona.name);
          break;
        }
      }

      if (!validatedPersona) {
        console.error('Invalid signature for all personas');
        return new Response('Invalid signature', { status: 401 });
      }

      // Threads webhook eventを処理
      if (webhookData.object === 'page') {
        for (const entry of webhookData.entry) {
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.field === 'mentions' && change.value) {
                await processReplyMention(change.value, validatedPersona);
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

async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const sigHash = signature.replace('sha256=', '');
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedHex = Array.from(new Uint8Array(expectedSig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return sigHash === expectedHex;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

async function processReplyMention(mentionData: any, persona: any) {
  try {
    console.log('Processing reply mention:', mentionData);

    // Threads APIから詳細情報を取得
    const replyId = mentionData.media_id || mentionData.id;
    if (!replyId) {
      console.error('No reply ID found in mention data');
      return;
    }

    try {
      // Threads APIからリプライ詳細を取得
      const response = await fetch(`https://graph.threads.net/v1.0/${replyId}?fields=id,text,username,timestamp,media_type,reply_to_id&access_token=${persona.threads_access_token}`);
      
      if (!response.ok) {
        console.error(`Failed to fetch reply details for persona ${persona.id}:`, response.status);
        return;
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
        return;
      }

      console.log('Reply saved successfully');

      // 自動返信が有効かチェック
      const { data: profile } = await supabase
        .from('profiles')
        .select('auto_reply_enabled, ai_auto_reply_enabled')
        .eq('user_id', persona.user_id)
        .single();

      if (profile?.auto_reply_enabled || profile?.ai_auto_reply_enabled) {
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

  } catch (error) {
    console.error('Error in processReplyMention:', error);
  }
}
