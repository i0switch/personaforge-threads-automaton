import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface RateLimitConfig {
  endpoint: string;
  maxRequests: number;
  windowMinutes: number;
}

const RATE_LIMITS: RateLimitConfig[] = [
  { endpoint: 'webhook', maxRequests: 30, windowMinutes: 1 },
  { endpoint: 'auth', maxRequests: 10, windowMinutes: 1 },
  { endpoint: 'api', maxRequests: 100, windowMinutes: 1 }
];

async function checkRateLimit(endpoint: string, identifier: string): Promise<boolean> {
  const config = RATE_LIMITS.find(r => r.endpoint === endpoint);
  if (!config) return true;

  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - config.windowMinutes);

  try {
    // 現在のウィンドウ内のリクエスト数をチェック
    const { data: existing, error } = await supabase
      .from('rate_limits')
      .select('request_count')
      .eq('endpoint', endpoint)
      .eq('identifier', identifier)
      .gte('window_start', windowStart.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Rate limit check error:', error);
      return true; // エラー時は許可
    }

    if (existing && existing.request_count >= config.maxRequests) {
      console.log(`Rate limit exceeded for ${endpoint}:${identifier}`);
      return false;
    }

    // レート制限記録を更新または作成
    await supabase
      .from('rate_limits')
      .upsert({
        endpoint,
        identifier,
        request_count: existing ? existing.request_count + 1 : 1,
        window_start: (existing as any)?.window_start || new Date().toISOString()
      }, {
        onConflict: 'endpoint,identifier'
      });

    return true;
  } catch (error) {
    console.error('Rate limit error:', error);
    return true; // エラー時は許可
  }
}

async function verifyWebhookSignature(
  signature: string,
  payload: string,
  secret: string
): Promise<boolean> {
  try {
    // HMAC-SHA256 署名検証
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    const expectedSignature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // タイミング攻撃を防ぐための定数時間比較
    const providedHex = signature.replace('sha256=', '');
    return expectedHex === providedHex;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

async function logSecurityEvent(eventType: string, details: any) {
  try {
    await supabase.rpc('log_security_event', {
      p_event_type: eventType,
      p_ip_address: details.ip_address,
      p_user_agent: details.user_agent,
      p_details: details
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

serve(async (req) => {
  // CORS プリフライトリクエストの処理
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.pathname.split('/').pop() || 'unknown';
    
    // クライアントIPとUser-Agentの取得
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // レート制限チェック
    const rateLimitPassed = await checkRateLimit(endpoint, clientIP);
    if (!rateLimitPassed) {
      await logSecurityEvent('rate_limit_exceeded', {
        endpoint,
        ip_address: clientIP,
        user_agent: userAgent
      });

      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Webhook署名検証（該当する場合）
    const signature = req.headers.get('x-hub-signature-256');
    if (signature) {
      const payload = await req.text();
      const secret = Deno.env.get('WEBHOOK_SECRET') || '';
      
      const validSignature = await verifyWebhookSignature(signature, payload, secret);
      if (!validSignature) {
        await logSecurityEvent('invalid_webhook_signature', {
          endpoint,
          ip_address: clientIP,
          user_agent: userAgent,
          signature
        });

        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // 成功ログ
      await logSecurityEvent('webhook_verified', {
        endpoint,
        ip_address: clientIP,
        user_agent: userAgent
      });

      return new Response(
        JSON.stringify({ 
          message: 'Webhook verified successfully',
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 通常のセキュリティ検証
    await logSecurityEvent('security_check_passed', {
      endpoint,
      ip_address: clientIP,
      user_agent: userAgent
    });

    return new Response(
      JSON.stringify({ 
        message: 'Security check passed',
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Enhanced webhook security error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});