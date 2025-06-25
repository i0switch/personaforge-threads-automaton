
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
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

// 入力値のサニタイゼーション
function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') return '';
  return input.slice(0, maxLength).replace(/[<>]/g, '');
}

// Webhook署名の検証
async function verifyWebhookSignature(
  payload: string, 
  signature: string, 
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedHex = 'sha256=' + Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return expectedHex === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// リプライデータの処理
async function processReplyData(replyData: any, supabase: any): Promise<void> {
  const sanitizedData = {
    reply_id: sanitizeInput(replyData.id, 100),
    original_post_id: sanitizeInput(replyData.reply_to_id, 100),
    reply_author_id: sanitizeInput(replyData.from.id, 100),
    reply_author_username: sanitizeInput(replyData.from.username, 50),
    reply_text: sanitizeInput(replyData.text, 2000),
    reply_timestamp: new Date(replyData.timestamp).toISOString()
  };

  // ペルソナの取得とレコード保存を分離
  const { data: personas, error: personaError } = await supabase
    .from('personas')
    .select('id, name, user_id')
    .eq('is_active', true);

  if (personaError) {
    console.error('Error fetching personas:', personaError);
    return;
  }

  // 各ペルソナに対してリプライレコードを保存
  for (const persona of personas) {
    // 自分自身からの返信をスキップ（改善版）
    const isSelf = 
      sanitizedData.reply_author_username === persona.name ||
      sanitizedData.reply_author_id === persona.user_id;
    
    if (isSelf) {
      console.log(`Skipping self-reply from persona ${persona.name}`);
      continue;
    }

    const { error: insertError } = await supabase
      .from('thread_replies')
      .insert({
        ...sanitizedData,
        persona_id: persona.id,
        user_id: persona.user_id
      });

    if (insertError) {
      console.error('Error inserting reply:', insertError);
    }
  }
}

// 自動返信のトリガー
async function triggerAutoReply(replyData: any, supabase: any): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('generate-auto-reply', {
      body: {
        reply_data: replyData
      }
    });

    if (error) {
      console.error('Error triggering auto reply:', error);
    }
  } catch (error) {
    console.error('Auto reply trigger error:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe') {
        // Verify tokenの検証（実際の実装では、ペルソナごとのトークンと照合）
        return new Response(challenge, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

    if (req.method === 'POST') {
      const rawBody = await req.text();
      const signature = req.headers.get('x-hub-signature-256');

      // 署名検証（実際の実装では適切なシークレットを使用）
      if (signature) {
        const appSecret = Deno.env.get('THREADS_APP_SECRET');
        if (appSecret && !await verifyWebhookSignature(rawBody, signature, appSecret)) {
          return new Response('Unauthorized', { status: 401, headers: corsHeaders });
        }
      }

      const webhookData: WebhookPayload = JSON.parse(rawBody);

      if (webhookData.object === 'threads') {
        for (const entry of webhookData.entry) {
          for (const change of entry.changes) {
            if (change.field === 'mentions' && change.value) {
              await processReplyData(change.value, supabase);
              await triggerAutoReply(change.value, supabase);
            }
          }
        }
      }

      return new Response('OK', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal Server Error', {
      status: 500,
      headers: corsHeaders
    });
  }
});
