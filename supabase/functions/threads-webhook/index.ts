
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
      const personaId = url.searchParams.get('persona_id');

      console.log('Webhook verification request:', { mode, token, challenge, personaId });

      if (personaId) {
        const { data: persona } = await supabase
          .from('personas')
          .select('webhook_verify_token')
          .eq('id', personaId)
          .eq('is_active', true)
          .single();

        if (mode === 'subscribe' && persona?.webhook_verify_token === token) {
          console.log('Webhook verification successful for persona:', personaId);
          return new Response(challenge, { status: 200 });
        }
      } else {
        const { data: personas } = await supabase
          .from('personas')
          .select('webhook_verify_token')
          .eq('is_active', true)
          .not('webhook_verify_token', 'is', null);

        const isValidToken = personas?.some(persona => persona.webhook_verify_token === token);

        if (mode === 'subscribe' && isValidToken) {
          console.log('Webhook verification successful (legacy mode)');
          return new Response(challenge, { status: 200 });
        }
      }

      console.log('Webhook verification failed');
      return new Response('Verification failed', { status: 403 });
    }

    // POST requestはThreads eventデータ
    if (req.method === 'POST') {
      const rawBody = await req.text();
      console.log('Raw webhook body:', rawBody);

      const signature = req.headers.get('x-hub-signature-256');
      console.log('Webhook signature:', signature);

      if (!signature) {
        console.error('No signature provided');
        return new Response('Signature required', { status: 401 });
      }

      const webhookData = JSON.parse(rawBody);
      console.log('Webhook data received:', JSON.stringify(webhookData, null, 2));

      const url = new URL(req.url);
      const personaId = url.searchParams.get('persona_id');

      let validatedPersona = null;

      if (personaId) {
        const { data: persona } = await supabase
          .from('personas')
          .select('*')
          .eq('id', personaId)
          .eq('is_active', true)
          .not('threads_app_secret', 'is', null)
          .single();

        if (persona && await verifySignature(rawBody, signature, persona.threads_app_secret)) {
          validatedPersona = persona;
          console.log('Signature validated for specific persona:', persona.name);
        }
      } else {
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
      }

      if (!validatedPersona) {
        console.error('Invalid signature for persona(s)');
        return new Response('Invalid signature', { status: 401 });
      }

      // 新しいWebhookデータ形式を処理
      if (webhookData.values && Array.isArray(webhookData.values)) {
        for (const valueItem of webhookData.values) {
          if (valueItem.field === 'replies' && valueItem.value) {
            await processReplyData(valueItem.value, validatedPersona);
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

async function processReplyData(replyData: any, persona: any) {
  try {
    console.log('Processing reply data:', replyData);

    // 自分自身の返信かチェック（ユーザー名で判定）
    if (replyData.username === persona.name || replyData.username === 'mido_renai') {
      console.log('Skipping own reply:', replyData.id);
      return;
    }

    // 既存のリプライかチェック
    const { data: existingReply } = await supabase
      .from('thread_replies')
      .select('id')
      .eq('reply_id', replyData.id)
      .single();

    if (existingReply) {
      console.log('Reply already exists:', replyData.id);
      return;
    }

    // リプライをデータベースに保存
    const { error: insertError } = await supabase
      .from('thread_replies')
      .insert({
        user_id: persona.user_id,
        persona_id: persona.id,
        original_post_id: replyData.replied_to?.id || replyData.root_post?.id || '',
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

    console.log('Reply saved successfully:', replyData.id);

    // 自動返信が有効かチェック（ai_auto_reply_enabledを確認）
    const { data: profile } = await supabase
      .from('profiles')
      .select('auto_reply_enabled, ai_auto_reply_enabled')
      .eq('user_id', persona.user_id)
      .single();

    console.log('Profile auto-reply settings:', profile);

    // AI自動返信が有効でない場合は処理を停止
    if (!profile?.ai_auto_reply_enabled) {
      console.log('AI auto-reply is disabled for this user');
      return;
    }

    console.log('AI auto-reply is enabled, sending auto-reply...');
    
    // 元の投稿を取得してコンテキストを提供
    let originalPostContent = '';
    try {
      // Threads APIから元の投稿を取得
      const threadsResponse = await fetch(`https://graph.threads.net/v1.0/${replyData.replied_to?.id || replyData.root_post?.id}?fields=text&access_token=${persona.threads_access_token}`);
      if (threadsResponse.ok) {
        const originalPost = await threadsResponse.json();
        originalPostContent = originalPost.text || '';
        console.log('Original post content:', originalPostContent);
      }
    } catch (error) {
      console.log('Could not fetch original post content:', error);
      originalPostContent = '元の投稿の内容を取得できませんでした';
    }
    
    // 自動返信を送信（replyIdを追加）
    const { data: autoReplyResult, error: autoReplyError } = await supabase.functions.invoke('threads-auto-reply', {
      body: {
        postContent: originalPostContent,
        replyContent: replyData.text,
        replyId: replyData.id,
        personaId: persona.id,
        userId: persona.user_id
      }
    });

    if (autoReplyError) {
      console.error('Auto-reply error:', autoReplyError);
      
      // エラーログをactivity_logsに記録
      await supabase
        .from('activity_logs')
        .insert({
          user_id: persona.user_id,
          persona_id: persona.id,
          action_type: 'auto_reply_failed',
          description: 'AI自動返信の送信に失敗しました',
          metadata: {
            error: autoReplyError.message,
            reply_text: replyData.text,
            reply_id: replyData.id,
            original_post: originalPostContent
          }
        });
    } else {
      console.log('Auto-reply sent successfully:', autoReplyResult);
      
      // auto_reply_sentフラグを更新
      await supabase
        .from('thread_replies')
        .update({ auto_reply_sent: true })
        .eq('reply_id', replyData.id);
    }

  } catch (error) {
    console.error('Error in processReplyData:', error);
  }
}
