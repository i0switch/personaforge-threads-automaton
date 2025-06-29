
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get request details for security logging
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown'
    const signature = req.headers.get('x-hub-signature-256')
    const contentType = req.headers.get('content-type')

    // Security checks
    if (!signature) {
      await logSecurityEvent(supabase, {
        event_type: 'webhook_verification_failed',
        ip_address: clientIP,
        user_agent: userAgent,
        details: {
          reason: 'missing_signature',
          timestamp: new Date().toISOString()
        }
      })

      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Rate limiting - check for excessive requests from same IP
    const isRateLimited = await checkRateLimit(supabase, clientIP)
    if (isRateLimited) {
      await logSecurityEvent(supabase, {
        event_type: 'rate_limit_exceeded',
        ip_address: clientIP,
        user_agent: userAgent,
        details: {
          reason: 'too_many_requests',
          timestamp: new Date().toISOString()
        }
      })

      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get request body
    const body = await req.text()
    
    // Verify webhook signature
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
    if (!webhookSecret) {
      await logSecurityEvent(supabase, {
        event_type: 'webhook_configuration_error',
        ip_address: clientIP,
        details: {
          reason: 'missing_webhook_secret',
          timestamp: new Date().toISOString()
        }
      })

      return new Response(
        JSON.stringify({ error: 'Webhook not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const isValidSignature = await verifyWebhookSignature(signature, body, webhookSecret)
    if (!isValidSignature) {
      await logSecurityEvent(supabase, {
        event_type: 'webhook_verification_failed',
        ip_address: clientIP,
        user_agent: userAgent,
        details: {
          reason: 'invalid_signature',
          timestamp: new Date().toISOString()
        }
      })

      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Log successful webhook verification
    await logSecurityEvent(supabase, {
      event_type: 'webhook_verified',
      ip_address: clientIP,
      user_agent: userAgent,
      details: {
        content_type: contentType,
        body_length: body.length,
        timestamp: new Date().toISOString()
      }
    })

    // Process the webhook payload
    const payload = JSON.parse(body)
    console.log('Processing webhook payload:', payload)

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed successfully' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function verifyWebhookSignature(signature: string, payload: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const data = encoder.encode(payload)
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const expectedSignature = await crypto.subtle.sign('HMAC', key, data)
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    const providedSignature = signature.replace('sha256=', '')
    return expectedHex === providedSignature
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

async function checkRateLimit(supabase: any, clientIP: string): Promise<boolean> {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
    
    const { data, error } = await supabase
      .from('security_events')
      .select('id')
      .eq('ip_address', clientIP)
      .gte('created_at', oneMinuteAgo.toISOString())
    
    if (error) {
      console.error('Rate limit check error:', error)
      return false
    }
    
    // Allow max 30 requests per minute per IP
    return (data?.length || 0) >= 30
  } catch (error) {
    console.error('Rate limiting error:', error)
    return false
  }
}

async function logSecurityEvent(supabase: any, event: any) {
  try {
    const { error } = await supabase
      .from('security_events')
      .insert(event)
    
    if (error) {
      console.error('Failed to log security event:', error)
    }
  } catch (error) {
    console.error('Security logging error:', error)
  }
}
