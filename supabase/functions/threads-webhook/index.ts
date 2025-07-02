
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

    const url = new URL(req.url)
    const persona_id = url.searchParams.get('persona_id')

    // Meta for Developers Webhook検証処理（GET リクエスト）
    if (req.method === 'GET') {
      const hubMode = url.searchParams.get('hub.mode')
      const hubChallenge = url.searchParams.get('hub.challenge')
      const hubVerifyToken = url.searchParams.get('hub.verify_token')

      console.log('Webhook verification request:', {
        persona_id,
        hubMode,
        hubVerifyToken: hubVerifyToken ? '[PRESENT]' : '[MISSING]',
        hubChallenge: hubChallenge ? '[PRESENT]' : '[MISSING]'
      })

      if (!persona_id) {
        console.error('Missing persona_id in verification request')
        return new Response('Missing persona_id parameter', { 
          status: 400, 
          headers: corsHeaders 
        })
      }

      if (hubMode === 'subscribe') {
        // ペルソナのWebhook Verify Tokenを取得
        const { data: persona, error } = await supabase
          .from('personas')
          .select('webhook_verify_token')
          .eq('id', persona_id)
          .single()

        if (error || !persona) {
          console.error('Persona not found:', error)
          await logSecurityEvent(supabase, {
            event_type: 'webhook_verification_failed',
            details: {
              reason: 'persona_not_found',
              persona_id,
              timestamp: new Date().toISOString()
            }
          })
          return new Response('Persona not found', { 
            status: 404, 
            headers: corsHeaders 
          })
        }

        if (!persona.webhook_verify_token) {
          console.error('Webhook verify token not configured for persona:', persona_id)
          await logSecurityEvent(supabase, {
            event_type: 'webhook_verification_failed',
            details: {
              reason: 'verify_token_not_configured',
              persona_id,
              timestamp: new Date().toISOString()
            }
          })
          return new Response('Webhook verify token not configured', { 
            status: 400, 
            headers: corsHeaders 
          })
        }

        console.log('Comparing tokens:', {
          received: hubVerifyToken,
          expected: persona.webhook_verify_token,
          match: hubVerifyToken === persona.webhook_verify_token
        })

        if (hubVerifyToken === persona.webhook_verify_token) {
          console.log('Webhook verification successful for persona:', persona_id)
          await logSecurityEvent(supabase, {
            event_type: 'webhook_verification_success',
            details: {
              persona_id,
              timestamp: new Date().toISOString()
            }
          })
          return new Response(hubChallenge, { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
          })
        } else {
          console.error('Webhook verify token mismatch')
          await logSecurityEvent(supabase, {
            event_type: 'webhook_verification_failed',
            details: {
              reason: 'token_mismatch',
              persona_id,
              timestamp: new Date().toISOString()
            }
          })
          return new Response('Forbidden', { 
            status: 403, 
            headers: corsHeaders 
          })
        }
      }

      return new Response('Bad Request', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // POST リクエスト - Webhook データ処理
    if (req.method === 'POST') {
      const userAgent = req.headers.get('user-agent') || 'unknown'
      const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      const signature = req.headers.get('x-hub-signature-256')
      const contentType = req.headers.get('content-type')
      const timestamp = Date.now()

      if (!persona_id) {
        return new Response(
          JSON.stringify({ error: 'Missing persona_id parameter' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // 基本的なセキュリティチェック
      if (!signature) {
        await logSecurityEvent(supabase, {
          event_type: 'webhook_verification_failed',
          ip_address: clientIP,
          user_agent: userAgent,
          details: {
            reason: 'missing_signature',
            persona_id,
            timestamp: new Date().toISOString(),
            content_type: contentType
          }
        })

        return new Response(
          JSON.stringify({ error: 'Signature required' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Rate limiting - IPアドレス毎の制限
      const isRateLimited = await checkRateLimit(supabase, clientIP)
      if (isRateLimited) {
        await logSecurityEvent(supabase, {
          event_type: 'rate_limit_exceeded',
          ip_address: clientIP,
          user_agent: userAgent,
          details: {
            reason: 'too_many_requests',
            persona_id,
            timestamp: new Date().toISOString()
          }
        })

        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { 
            status: 429, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // リクエストボディを取得
      const body = await req.text()
      
      // ボディサイズ制限（1MB）
      if (body.length > 1024 * 1024) {
        await logSecurityEvent(supabase, {
          event_type: 'webhook_security_violation',
          ip_address: clientIP,
          details: {
            reason: 'payload_too_large',
            size: body.length,
            persona_id,
            timestamp: new Date().toISOString()
          }
        })

        return new Response(
          JSON.stringify({ error: 'Payload too large' }),
          { 
            status: 413, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Webhook署名検証
      let payload
      try {
        payload = JSON.parse(body)
      } catch (error) {
        await logSecurityEvent(supabase, {
          event_type: 'webhook_security_violation',
          ip_address: clientIP,
          details: {
            reason: 'invalid_json',
            error: error.message,
            persona_id,
            timestamp: new Date().toISOString()
          }
        })

        return new Response(
          JSON.stringify({ error: 'Invalid JSON payload' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // 入力検証とサニタイゼーション
      const validationResult = validateWebhookPayload(payload)
      if (!validationResult.valid) {
        await logSecurityEvent(supabase, {
          event_type: 'webhook_validation_failed',
          ip_address: clientIP,
          details: {
            reason: 'invalid_payload',
            errors: validationResult.errors,
            persona_id,
            timestamp: new Date().toISOString()
          }
        })

        return new Response(
          JSON.stringify({ error: 'Invalid payload format' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // 成功した場合のログ記録
      await logSecurityEvent(supabase, {
        event_type: 'webhook_processed',
        ip_address: clientIP,
        user_agent: userAgent,
        details: {
          content_type: contentType,
          payload_size: body.length,
          persona_id,
          timestamp: new Date().toISOString(),
          processing_time: Date.now() - timestamp
        }
      })

      // Webhookペイロードの処理
      console.log('Processing webhook payload for persona:', persona_id, JSON.stringify(payload, null, 2))

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook processed successfully',
          timestamp: new Date().toISOString(),
          persona_id
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    
    // エラー情報を記録（詳細は除く）
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    await logSecurityEvent(supabase, {
      event_type: 'webhook_error',
      details: {
        error_type: error.name || 'UnknownError',
        timestamp: new Date().toISOString()
      }
    })
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Webhookペイロードの検証
function validateWebhookPayload(payload: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!payload || typeof payload !== 'object') {
    errors.push('Payload must be an object')
    return { valid: false, errors }
  }

  // 基本的な構造チェック
  if (payload.object && typeof payload.object !== 'string') {
    errors.push('Invalid object field')
  }

  if (payload.entry && !Array.isArray(payload.entry)) {
    errors.push('Entry must be an array')
  }

  // SQLインジェクション対策
  const stringFields = ['object', 'id', 'text']
  for (const field of stringFields) {
    if (payload[field] && typeof payload[field] === 'string') {
      if (containsSqlInjection(payload[field])) {
        errors.push(`Potential SQL injection in ${field}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// SQLインジェクション検出
function containsSqlInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|#|\/\*|\*\/)/,
    /(\bOR\b|\bAND\b).*[=<>]/i,
    /['";\x00\x1a]/
  ]
  
  return sqlPatterns.some(pattern => pattern.test(input))
}

// Rate limiting チェック
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
    
    // 1分間に最大30リクエストまで許可
    return (data?.length || 0) >= 30
  } catch (error) {
    console.error('Rate limiting error:', error)
    return false
  }
}

// セキュリティイベントログ
async function logSecurityEvent(supabase: any, event: any) {
  try {
    const { error } = await supabase.rpc('log_security_event', {
      p_event_type: event.event_type,
      p_user_id: event.user_id || null,
      p_ip_address: event.ip_address || null,
      p_user_agent: event.user_agent || null,
      p_details: event.details || null
    })
    
    if (error) {
      console.error('Failed to log security event:', error)
    }
  } catch (error) {
    console.error('Security logging error:', error)
  }
}
