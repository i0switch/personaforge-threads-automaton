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

// レート制限のためのメモリストア（本番環境ではRedis等を使用）
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1分
const RATE_LIMIT_MAX = 100; // 1分あたり最大100リクエスト

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // IPアドレス取得（レート制限用）
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    // レート制限チェック
    if (!checkRateLimit(clientIP)) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Webhook received from IP: ${clientIP}`);

    // GET requestはThreads webhook verification用
    if (req.method === 'GET') {
      return handleVerification(req);
    }

    // POST requestはThreads eventデータ
    if (req.method === 'POST') {
      return await handleWebhookEvent(req);
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (error) {
    console.error('Webhook error:', error);
    
    // セキュリティログを記録
    await logSecurityEvent('webhook_error', {
      error: error.message,
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown'
    });

    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = `rate_limit_${ip}`;
  const current = rateLimitStore.get(key);

  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX) {
    return false;
  }

  current.count++;
  return true;
}

function handleVerification(req: Request): Response {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const personaId = url.searchParams.get('persona_id');

  // 入力値の検証
  if (!mode || !token || !challenge) {
    console.warn('Invalid verification request: missing parameters');
    return new Response('Invalid verification request', { status: 400 });
  }

  // SQLインジェクション防止のためのUUID検証
  if (personaId && !isValidUUID(personaId)) {
    console.warn('Invalid persona_id format');
    return new Response('Invalid persona_id format', { status: 400 });
  }

  console.log('Webhook verification request:', { mode, personaId });

  return verifyWebhookToken(mode, token, challenge, personaId);
}

async function verifyWebhookToken(mode: string, token: string, challenge: string, personaId?: string): Promise<Response> {
  try {
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

    // 不正な検証試行をログ記録
    await logSecurityEvent('webhook_verification_failed', {
      mode,
      personaId,
      token: token.substring(0, 8) + '...' // トークンの一部のみログ
    });

    console.log('Webhook verification failed');
    return new Response('Verification failed', { status: 403 });
  } catch (error) {
    console.error('Verification error:', error);
    return new Response('Verification error', { status: 500 });
  }
}

async function handleWebhookEvent(req: Request): Promise<Response> {
  const rawBody = await req.text();
  
  // リクエストサイズ制限
  if (rawBody.length > 1048576) { // 1MB制限
    console.warn('Request body too large');
    return new Response('Request body too large', { status: 413 });
  }

  console.log('Raw webhook body:', rawBody.substring(0, 500) + '...');

  const signature = req.headers.get('x-hub-signature-256');
  console.log('Webhook signature provided:', !!signature);

  if (!signature) {
    await logSecurityEvent('webhook_no_signature', {
      bodyLength: rawBody.length,
      headers: Object.fromEntries(req.headers.entries())
    });
    console.error('No signature provided');
    return new Response('Signature required', { status: 401 });
  }

  let webhookData;
  try {
    webhookData = JSON.parse(rawBody);
  } catch (error) {
    console.error('Invalid JSON in webhook body');
    return new Response('Invalid JSON', { status: 400 });
  }

  console.log('Webhook data received:', JSON.stringify(webhookData, null, 2));

  const url = new URL(req.url);
  const personaId = url.searchParams.get('persona_id');
  
  // SQLインジェクション防止
  if (personaId && !isValidUUID(personaId)) {
    return new Response('Invalid persona_id format', { status: 400 });
  }

  let validatedPersona = null;

  if (personaId) {
    validatedPersona = await validatePersonaSignature(rawBody, signature, personaId);
  } else {
    validatedPersona = await validateAnyPersonaSignature(rawBody, signature);
  }

  if (!validatedPersona) {
    await logSecurityEvent('webhook_invalid_signature', {
      personaId,
      signature: signature.substring(0, 16) + '...',
      bodyLength: rawBody.length
    });
    console.error('Invalid signature for persona(s)');
    return new Response('Invalid signature', { status: 401 });
  }

  // Webhookデータ処理
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

async function validatePersonaSignature(rawBody: string, signature: string, personaId: string) {
  const { data: persona } = await supabase
    .from('personas')
    .select('*')
    .eq('id', personaId)
    .eq('is_active', true)
    .not('threads_app_secret', 'is', null)
    .single();

  if (persona && await verifySignature(rawBody, signature, persona.threads_app_secret)) {
    console.log('Signature validated for specific persona:', persona.name);
    return persona;
  }
  return null;
}

async function validateAnyPersonaSignature(rawBody: string, signature: string) {
  const { data: personas } = await supabase
    .from('personas')
    .select('*')
    .eq('is_active', true)
    .not('threads_app_secret', 'is', null);

  for (const persona of personas || []) {
    if (await verifySignature(rawBody, signature, persona.threads_app_secret)) {
      console.log('Signature validated for persona:', persona.name);
      return persona;
    }
  }
  return null;
}

async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    if (!signature.startsWith('sha256=')) {
      return false;
    }
    
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

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

async function logSecurityEvent(eventType: string, details: any) {
  try {
    await supabase
      .from('activity_logs')
      .insert({
        user_id: 'system',
        action_type: eventType,
        description: `Security event: ${eventType}`,
        metadata: details
      });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

async function processReplyData(replyData: any, persona: any) {
  try {
    console.log('Processing reply data:', replyData);

    // XSS防止のための入力サニタイゼーション
    if (typeof replyData.text === 'string') {
      replyData.text = replyData.text.substring(0, 2000); // 長さ制限
    }
    if (typeof replyData.username === 'string') {
      replyData.username = replyData.username.substring(0, 100); // 長さ制限
    }

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

    // ユーザーの自動返信設定を取得
    const { data: profile } = await supabase
      .from('profiles')
      .select('auto_reply_enabled, ai_auto_reply_enabled')
      .eq('user_id', persona.user_id)
      .single();

    console.log('Profile auto-reply settings:', profile);

    // 自動返信処理
    await handleAutoReply(replyData, persona, profile);

  } catch (error) {
    console.error('Error in processReplyData:', error);
    await logSecurityEvent('reply_processing_error', {
      error: error.message,
      replyId: replyData?.id,
      personaId: persona?.id
    });
  }
}

async function handleAutoReply(replyData: any, persona: any, profile: any) {
  // キーワード自動返信が有効な場合
  if (profile?.auto_reply_enabled && !profile?.ai_auto_reply_enabled) {
    console.log('Keyword auto-reply is enabled, checking for matching rules...');
    
    const { data: autoReplyRules } = await supabase
      .from('auto_replies')
      .select('*')
      .eq('user_id', persona.user_id)
      .eq('persona_id', persona.id)
      .eq('is_active', true);

    console.log('Auto-reply rules found:', autoReplyRules?.length || 0);

    if (autoReplyRules && autoReplyRules.length > 0) {
      const replyText = replyData.text || '';
      
      for (const rule of autoReplyRules) {
        const keywords = rule.trigger_keywords || [];
        console.log('Checking keywords:', keywords, 'against reply:', replyText);
        
        const hasMatchingKeyword = keywords.some((keyword: string) => 
          replyText.toLowerCase().includes(keyword.toLowerCase())
        );

        if (hasMatchingKeyword) {
          console.log('Keyword match found, sending auto-reply...');
          
          try {
            await sendKeywordAutoReply(replyData.id, rule.response_template, persona);
            
            await supabase
              .from('thread_replies')
              .update({ auto_reply_sent: true })
              .eq('reply_id', replyData.id);

            await supabase
              .from('activity_logs')
              .insert({
                user_id: persona.user_id,
                persona_id: persona.id,
                action_type: 'auto_reply_sent',
                description: 'キーワード自動返信を送信しました',
                metadata: {
                  reply_text: replyText,
                  reply_id: replyData.id,
                  matched_keywords: keywords.filter((k: string) => 
                    replyText.toLowerCase().includes(k.toLowerCase())
                  ),
                  response_template: rule.response_template
                }
              });

            break;
          } catch (error) {
            console.error('Error sending keyword auto-reply:', error);
            
            await supabase
              .from('activity_logs')
              .insert({
                user_id: persona.user_id,
                persona_id: persona.id,
                action_type: 'auto_reply_failed',
                description: 'キーワード自動返信の送信に失敗しました',
                metadata: {
                  error: error.message,
                  reply_text: replyText,
                  reply_id: replyData.id
                }
              });
          }
        }
      }
    }
  }
  // AI自動返信が有効な場合
  else if (profile?.ai_auto_reply_enabled && !profile?.auto_reply_enabled) {
    console.log('AI auto-reply is enabled, sending auto-reply...');
    
    let originalPostContent = '';
    try {
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
      
      await supabase
        .from('thread_replies')
        .update({ auto_reply_sent: true })
        .eq('reply_id', replyData.id);
    }
  } else {
    console.log('Auto-reply is disabled for this user');
  }
}

async function sendKeywordAutoReply(replyToId: string, responseText: string, persona: any) {
  console.log('Sending keyword auto-reply to:', replyToId, 'with text:', responseText);

  // レスポンステキストのサニタイゼーション
  const sanitizedResponse = responseText.substring(0, 500); // 長さ制限

  console.log('Creating Threads reply container...');
  const createContainerResponse = await fetch('https://graph.threads.net/v1.0/me/threads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      media_type: 'TEXT_POST',
      text: sanitizedResponse,
      reply_to_id: replyToId,
      access_token: persona.threads_access_token
    }),
  });

  if (!createContainerResponse.ok) {
    const errorText = await createContainerResponse.text();
    console.error('Threads create container error:', errorText);
    throw new Error(`Failed to create Threads container: ${createContainerResponse.status} - ${errorText}`);
  }

  const containerData = await createContainerResponse.json();
  console.log('Reply container created:', containerData.id);

  if (!containerData.id) {
    throw new Error('No container ID returned from Threads API');
  }

  console.log('Waiting before publish...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('Publishing reply to Threads...');
  const publishResponse = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      creation_id: containerData.id,
      access_token: persona.threads_access_token
    }),
  });

  if (!publishResponse.ok) {
    const errorText = await publishResponse.text();
    console.error('Threads publish error:', errorText);
    throw new Error(`Failed to publish to Threads: ${publishResponse.status} - ${errorText}`);
  }

  const publishData = await publishResponse.json();
  console.log('Keyword auto-reply published:', publishData.id);

  return publishData;
}
