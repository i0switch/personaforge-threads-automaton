
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-timestamp',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface WebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        from: {
          id: string;
          username: string;
        };
        id: string;
        text: string;
        timestamp: string;
        media?: {
          id: string;
          media_type: string;
          media_url: string;
        };
        reply_to_id?: string;
      };
      field: string;
    }>;
  }>;
}

// レート制限ストア（メモリベース）
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// 入力値のサニタイゼーション（強化版）
function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
}

// レート制限の検証
function validateRateLimit(identifier: string, maxRequests: number = 60, windowMs: number = 60000): boolean {
  const now = Date.now();
  const key = `webhook_${identifier}`;
  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    return true;
  }

  if (existing.count >= maxRequests) {
    return false;
  }

  existing.count++;
  rateLimitStore.set(key, existing);
  return true;
}

// タイムスタンプ検証（リプレイ攻撃対策）
function validateTimestamp(timestamp: string, toleranceSeconds: number = 300): boolean {
  const now = Math.floor(Date.now() / 1000);
  const webhookTime = parseInt(timestamp, 10);
  
  if (isNaN(webhookTime)) {
    return false;
  }

  const timeDiff = Math.abs(now - webhookTime);
  return timeDiff <= toleranceSeconds;
}

// 定数時間での文字列比較（タイミング攻撃対策）
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

// Webhook署名の検証（強化版）
async function verifyWebhookSignature(
  payload: string, 
  signature: string, 
  secret: string,
  timestamp?: string
): Promise<boolean> {
  try {
    // タイムスタンプ検証
    if (timestamp && !validateTimestamp(timestamp)) {
      console.error('Timestamp validation failed');
      return false;
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // タイムスタンプを含めた署名の生成
    const signaturePayload = timestamp ? `${timestamp}.${payload}` : payload;
    const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(signaturePayload));
    const expectedHex = 'sha256=' + Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // 定数時間比較
    return constantTimeCompare(expectedHex, signature);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// セキュリティログの生成
function logSecurityEvent(event: string, details: any): void {
  const sanitizedDetails = { ...details };
  
  // 機密情報をマスク
  if (sanitizedDetails.signature) sanitizedDetails.signature = '[REDACTED]';
  if (sanitizedDetails.secret) sanitizedDetails.secret = '[REDACTED]';
  if (sanitizedDetails.token) sanitizedDetails.token = '[REDACTED]';

  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details: sanitizedDetails,
    severity: getSeverity(event)
  };

  console.log('Security Event:', JSON.stringify(logEntry));
}

function getSeverity(event: string): string {
  const severityMap: Record<string, string> = {
    'signature_verification_failed': 'high',
    'rate_limit_exceeded': 'medium',
    'timestamp_validation_failed': 'medium',
    'request_size_exceeded': 'medium',
    'webhook_processed': 'low'
  };
  return severityMap[event] || 'low';
}

// 自動返信のトリガー
async function triggerAutoReply(replyData: any, supabase: any): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('generate-auto-reply', {
      body: { reply_data: replyData }
    });

    if (error) {
      console.error('Error triggering auto reply:', error);
      logSecurityEvent('auto_reply_trigger_failed', { error: error.message });
    }
  } catch (error) {
    console.error('Auto reply trigger error:', error);
    logSecurityEvent('auto_reply_trigger_error', { error: error.message });
  }
}

// ペルソナ用のリプライ処理関数（デバッグ強化版）
async function processReplyDataForPersona(replyData: any, supabase: any, personaId: string): Promise<void> {
  console.log('=== PROCESSING REPLY FOR PERSONA ===');
  console.log('Reply Data:', JSON.stringify(replyData, null, 2));
  console.log('Persona ID:', personaId);

  const sanitizedData = {
    reply_id: sanitizeInput(replyData.id, 100),
    original_post_id: sanitizeInput(replyData.reply_to_id, 100),
    reply_author_id: sanitizeInput(replyData.from.id, 100),
    reply_author_username: sanitizeInput(replyData.from.username, 50),
    reply_text: sanitizeInput(replyData.text, 2000),
    reply_timestamp: new Date(replyData.timestamp).toISOString()
  };

  console.log('Sanitized Data:', JSON.stringify(sanitizedData, null, 2));

  // 指定されたペルソナの情報を取得
  const { data: persona, error: personaError } = await supabase
    .from('personas')
    .select('id, name, user_id, threads_app_id, threads_username')
    .eq('id', personaId)
    .eq('is_active', true)
    .single();

  console.log('Persona Query Result:', { persona, error: personaError });

  if (personaError || !persona) {
    console.error('Error fetching persona:', personaError);
    logSecurityEvent('persona_fetch_failed', { error: personaError?.message, persona_id: personaId });
    return;
  }

  // 自分自身からの返信をスキップ（複数条件での判定）
  const isSelf = 
    sanitizedData.reply_author_username === persona.name ||
    sanitizedData.reply_author_username === persona.threads_username ||
    sanitizedData.reply_author_id === persona.user_id ||
    sanitizedData.reply_author_id === persona.threads_app_id;
  
  console.log('Self-reply check:', {
    reply_author_username: sanitizedData.reply_author_username,
    reply_author_id: sanitizedData.reply_author_id,
    persona_name: persona.name,
    persona_threads_username: persona.threads_username,
    persona_user_id: persona.user_id,
    persona_threads_app_id: persona.threads_app_id,
    is_self: isSelf
  });

  if (isSelf) {
    console.log(`Skipping self-reply from persona ${persona.name}`);
    return;
  }

  // 重複チェック
  const { data: existingReply } = await supabase
    .from('thread_replies')
    .select('id')
    .eq('reply_id', sanitizedData.reply_id)
    .single();

  if (existingReply) {
    console.log('Reply already exists, skipping:', sanitizedData.reply_id);
    return;
  }

  console.log('Inserting new reply to database...');
  const { error: insertError } = await supabase
    .from('thread_replies')
    .insert({
      ...sanitizedData,
      persona_id: persona.id,
      user_id: persona.user_id
    });

  if (insertError) {
    console.error('Error inserting reply:', insertError);
    logSecurityEvent('reply_insert_failed', { 
      error: insertError.message,
      persona_id: persona.id 
    });
  } else {
    console.log('Reply successfully inserted!');
  }
}

serve(async (req) => {
  console.log('Webhook request received:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const personaId = url.searchParams.get('persona_id');
    console.log('Persona ID from URL:', personaId);

    // ペルソナIDが必須
    if (!personaId) {
      console.error('Persona ID is required');
      return new Response('Persona ID is required', { status: 400, headers: corsHeaders });
    }

    // リクエストサイズの検証
    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    if (contentLength > 1024 * 1024) { // 1MB制限
      logSecurityEvent('request_size_exceeded', { size: contentLength });
      return new Response('Request too large', { status: 413, headers: corsHeaders });
    }

    // レート制限の検証
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    if (!validateRateLimit(clientIp)) {
      logSecurityEvent('rate_limit_exceeded', { ip: clientIp });
      return new Response('Rate limit exceeded', { status: 429, headers: corsHeaders });
    }

    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('GET request params:', { mode, token, challenge, personaId });

      if (mode === 'subscribe' && token && challenge) {
        console.log('Verifying persona webhook token for persona:', personaId);
        
        const { data: persona, error } = await supabase
          .from('personas')
          .select('webhook_verify_token')
          .eq('id', personaId)
          .eq('is_active', true)
          .single();

        console.log('Persona data:', persona, 'Error:', error);

        if (error || !persona) {
          console.error('Persona not found:', error);
          logSecurityEvent('persona_not_found', { persona_id: personaId });
          return new Response('Persona not found', { status: 404, headers: corsHeaders });
        }

        if (persona.webhook_verify_token === token) {
          console.log('Token verification successful, returning challenge:', challenge);
          logSecurityEvent('webhook_verification', { 
            mode, 
            persona_id: personaId,
            token: '[VERIFIED]' 
          });
          return new Response(challenge, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        } else {
          console.error('Token verification failed. Expected:', persona.webhook_verify_token, 'Received:', token);
          logSecurityEvent('webhook_verification_failed', { 
            mode, 
            persona_id: personaId,
            token: '[INVALID]' 
          });
          return new Response('Forbidden', { status: 403, headers: corsHeaders });
        }
      }

      console.log('GET request conditions not met');
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

    if (req.method === 'POST') {
      const rawBody = await req.text();
      const signature = req.headers.get('x-hub-signature-256');
      const timestamp = req.headers.get('x-timestamp');

      console.log('POST request received:');
      console.log('Body length:', rawBody.length);
      console.log('Signature present:', !!signature);
      console.log('Timestamp present:', !!timestamp);

      // 署名検証（ペルソナ専用のapp_secretを使用）
      if (signature) {
        const { data: persona, error } = await supabase
          .from('personas')
          .select('threads_app_secret')
          .eq('id', personaId)
          .single();

        if (error || !persona || !persona.threads_app_secret) {
          logSecurityEvent('persona_not_found', { persona_id: personaId });
          return new Response('Unauthorized', { status: 401, headers: corsHeaders });
        }

        // 暗号化されたapp_secretを復号化
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          try {
            const response = await supabase.functions.invoke('retrieve-secret', {
              body: {
                keyName: `threads_app_secret_${personaId}`
              },
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });

            if (response.data?.keyValue) {
              const isValid = await verifyWebhookSignature(rawBody, signature, response.data.keyValue, timestamp);
              if (!isValid) {
                logSecurityEvent('signature_verification_failed', { 
                  signature_present: true,
                  timestamp_present: !!timestamp,
                  persona_id: personaId,
                  ip: clientIp 
                });
                return new Response('Unauthorized', { status: 401, headers: corsHeaders });
              }
            }
          } catch (decryptError) {
            console.error('Failed to decrypt app secret:', decryptError);
            return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
          }
        }
      }

      const webhookData: WebhookPayload = JSON.parse(rawBody);
      
      console.log('Parsed webhook data:', JSON.stringify(webhookData, null, 2));

      if (webhookData.object === 'threads') {
        console.log('Processing threads webhook...');
        for (const entry of webhookData.entry) {
          console.log('Processing entry:', JSON.stringify(entry, null, 2));
          for (const change of entry.changes) {
            console.log('Processing change:', JSON.stringify(change, null, 2));
            if (change.field === 'mentions' && change.value) {
              console.log('Found mention, processing reply...');
              // ペルソナ指定で処理
              await processReplyDataForPersona(change.value, supabase, personaId);
              await triggerAutoReply(change.value, supabase);
            } else {
              console.log('Change field:', change.field, 'Value present:', !!change.value);
            }
          }
        }
      } else {
        console.log('Webhook object type:', webhookData.object);
      }

      logSecurityEvent('webhook_processed', { 
        object: webhookData.object,
        entries: webhookData.entry?.length || 0,
        persona_id: personaId
      });

      return new Response('OK', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error('Webhook error:', error);
    logSecurityEvent('webhook_error', { error: error.message });
    return new Response('Internal Server Error', {
      status: 500,
      headers: corsHeaders
    });
  }
});
