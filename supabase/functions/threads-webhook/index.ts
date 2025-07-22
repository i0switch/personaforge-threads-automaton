
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

      // リプライデータの処理
      let repliesProcessed = 0
      
      console.log('Processing webhook payload structure:', {
        hasEntry: !!payload.entry,
        hasValues: !!payload.values,
        valuesLength: payload.values ? payload.values.length : 0,
        firstValue: payload.values ? payload.values[0] : null
      })
      
      // Threads Webhookの新しい構造（values配列）をチェック
      if (payload.values && Array.isArray(payload.values)) {
        for (const valueItem of payload.values) {
          console.log('Processing value item:', JSON.stringify(valueItem, null, 2))
          
          if (valueItem.field === 'replies' && valueItem.value) {
            console.log('Processing reply data for field:', valueItem.field, 'with value:', valueItem.value)
            const processed = await processReplyData(supabase, persona_id, [valueItem.value])
            repliesProcessed += processed
          }
        }
      }
      
      // 従来のentry構造もサポート（後方互換性）
      if (payload.entry && Array.isArray(payload.entry)) {
        for (const entry of payload.entry) {
          console.log('Processing entry:', JSON.stringify(entry, null, 2))
          if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              console.log('Processing change:', {
                field: change.field,
                hasValue: !!change.value,
                valueType: typeof change.value
              })
              
              if ((change.field === 'mentions' || change.field === 'replies' || change.field === 'comments') && change.value) {
                console.log('Processing reply data for field:', change.field, 'with value:', change.value)
                const processed = await processReplyData(supabase, persona_id, change.value)
                repliesProcessed += processed
              }
            }
          }
        }
      }

      await logSecurityEvent(supabase, {
        event_type: 'webhook_replies_processed',
        details: {
          persona_id,
          replies_processed: repliesProcessed,
          timestamp: new Date().toISOString()
        }
      })

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook processed successfully',
          timestamp: new Date().toISOString(),
          persona_id,
          replies_processed: repliesProcessed
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

// リプライデータ処理
async function processReplyData(supabase: any, persona_id: string, replyData: any): Promise<number> {
  try {
    console.log('Processing reply data:', replyData)
    
    // ペルソナ情報を取得
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('id, name, user_id, ai_auto_reply_enabled, threads_username, threads_access_token, threads_user_id')
      .eq('id', persona_id)
      .maybeSingle()

    if (personaError) {
      console.error('Database error fetching persona:', personaError)
      return 0
    }

    if (!persona) {
      console.error('Persona not found for ID:', persona_id)
      return 0
    }

    console.log('Processing replies for persona:', persona.name, 'username:', persona.threads_username)

    let repliesProcessed = 0

    // リプライデータの配列を処理
    const replies = Array.isArray(replyData) ? replyData : [replyData]
    
    for (const reply of replies) {
      console.log('Processing individual reply:', {
        replyId: reply.id,
        username: reply.username,
        text: reply.text,
        rootPostData: reply.root_post,
        repliedToData: reply.replied_to,
        fullReplyData: JSON.stringify(reply, null, 2)
      })

      // 自分自身のリプライをスキップ
      if (reply.username === persona.threads_username || reply.username === persona.name) {
        console.log(`Skipping self-reply from ${reply.username}`)
        continue
      }

      // このリプライが現在のペルソナ宛てかチェック
      // root_post.usernameまたはreplied_toで判定
      const isForThisPersona = reply.root_post?.username === persona.threads_username || 
                              reply.root_post?.username === persona.name

      if (!isForThisPersona) {
        console.log(`Reply not for this persona. Root post owner: ${reply.root_post?.username}, persona: ${persona.threads_username}/${persona.name}`)
        continue
      }

      console.log(`Processing reply for persona ${persona.name}:`, reply.text)

      // 重複チェック
      const { data: existingReply } = await supabase
        .from('thread_replies')
        .select('id')
        .eq('reply_id', reply.id)
        .maybeSingle()

      if (existingReply) {
        console.log(`Reply already exists: ${reply.id}`)
        continue
      }

      // リプライを保存
      const { error: insertError } = await supabase
        .from('thread_replies')
        .insert({
          user_id: persona.user_id,
          persona_id: persona.id,
          original_post_id: reply.replied_to?.id || reply.root_post?.id || 'unknown',
          reply_id: reply.id,
          reply_text: reply.text || '',
          reply_author_id: reply.username,
          reply_author_username: reply.username,
          reply_timestamp: new Date(reply.timestamp || Date.now()).toISOString(),
          auto_reply_sent: false
        })

      if (insertError) {
        console.error('Failed to insert reply:', insertError)
        continue
      }

      repliesProcessed++
      console.log(`Reply saved for persona ${persona.name}: ${reply.id}`)

      // アクティビティログを記録
      await supabase
        .from('activity_logs')
        .insert({
          user_id: persona.user_id,
          persona_id: persona.id,
          action_type: 'reply_received',
          description: `新しいリプライを受信: @${reply.username}`,
          metadata: {
            reply_id: reply.id,
            reply_text: reply.text?.substring(0, 100),
            author: reply.username
          }
        })

      // キーワードトリガー返信の処理
      await processKeywordTriggerReplies(supabase, persona, reply)

      // AI自動返信の処理
      if (persona.ai_auto_reply_enabled) {
        console.log(`Triggering AI auto-reply for reply: ${reply.id}`)
        
        // 元の投稿内容を取得
        let originalPostContent = ''
        try {
          if (reply.root_post?.id) {
            console.log(`Fetching original post content for post ID: ${reply.root_post.id}`)
            const postResponse = await fetch(`https://graph.threads.net/v1.0/${reply.root_post.id}?fields=text&access_token=${persona.threads_access_token}`)
            if (postResponse.ok) {
              const postData = await postResponse.json()
              originalPostContent = postData.text || ''
              console.log(`Original post content retrieved: "${originalPostContent.substring(0, 100)}..."`)
            } else {
              console.log(`Failed to fetch original post: ${postResponse.status}`)
            }
          } else {
            console.log('No root_post.id available for original post content fetch')
          }
        } catch (error) {
          console.error(`Error fetching original post content:`, error)
        }
        
        try {
          const { data: autoReplyResponse, error: autoReplyError } = await supabase.functions.invoke('threads-auto-reply', {
            body: {
              postContent: originalPostContent,
              replyContent: reply.text,
              replyId: reply.id,
              personaId: persona.id,
              userId: persona.user_id,
              replyAuthor: reply.username
            }
          })

          if (autoReplyError) {
            console.error(`Auto-reply error for ${reply.id}:`, autoReplyError)
          } else {
            console.log(`Auto-reply triggered for ${reply.id}`)
            
            // auto_reply_sentフラグを更新
            await supabase
              .from('thread_replies')
              .update({ auto_reply_sent: true })
              .eq('reply_id', reply.id)
          }
        } catch (autoReplyErr) {
          console.error(`Failed to trigger auto-reply for ${reply.id}:`, autoReplyErr)
        }
      }
    }

    return repliesProcessed
  } catch (error) {
    console.error('Error processing reply data:', error)
    return 0
  }
}

// キーワードトリガー返信の処理
async function processKeywordTriggerReplies(supabase: any, persona: any, reply: any) {
  try {
    console.log(`\n🔍 処理中: "${reply.text}" (ID: ${reply.id})`)
    console.log(`📋 ペルソナ: ${persona.name}`)
    
    // このユーザーのすべてのアクティブなトリガー返信設定を取得
    const { data: triggerSettings, error } = await supabase
      .from('auto_replies')
      .select('*, personas!inner(id, name, threads_access_token, threads_user_id)')
      .eq('user_id', persona.user_id)
      .eq('is_active', true)

    if (error) {
      console.error('トリガー返信設定の取得エラー:', error)
      return
    }

    if (!triggerSettings || triggerSettings.length === 0) {
      console.log('❌ アクティブなトリガー返信設定がありません')
      return
    }

    console.log(`🎯 定型文返信設定: ${triggerSettings.length}件`)

    const replyText = reply.text?.trim().toLowerCase() || ''
    
    // 各トリガー設定をチェック
    for (const setting of triggerSettings) {
      const keywords = setting.trigger_keywords || []
      let matched = false

      for (const keyword of keywords) {
        const cleanKeyword = keyword.trim().toLowerCase()
        const cleanReplyText = replyText
        
        console.log(`🔍 クリーンテキスト: "${cleanReplyText}" vs "${cleanKeyword}"`)
        console.log(`🔍 キーワード "${keyword}" vs "${reply.text}" → ${cleanReplyText.includes(cleanKeyword)}`)
        
        if (cleanReplyText.includes(cleanKeyword)) {
          matched = true
          console.log(`✅ キーワード "${keyword}" がマッチしました！`)
          break
        }
      }

      if (matched) {
        console.log(`🚀 トリガー返信を送信中: "${setting.response_template}"`)
        console.log(`使用するペルソナ: ${setting.personas.name} (ID: ${setting.personas.id})`)
        
        // トリガー返信を送信（設定のペルソナを使用）
        await sendThreadsReply(supabase, setting.personas, reply.id, setting.response_template)
        
        // アクティビティログを記録
        await supabase
          .from('activity_logs')
          .insert({
            user_id: persona.user_id,
            persona_id: setting.persona_id,
            action_type: 'keyword_auto_reply_sent',
            description: `キーワード自動返信を送信: "${setting.response_template.substring(0, 50)}..."`,
            metadata: {
              reply_id: reply.id,
              keyword_matched: keywords.find(k => replyText.includes(k.trim().toLowerCase())),
              response_sent: setting.response_template,
              triggered_persona: setting.personas.name
            }
          })
        
        // 一つでもマッチしたら終了（複数のトリガーが同時に発動しないようにする）
        return
      }
    }

    console.log('❌ マッチするキーワードがなく、AI返信も無効です')
  } catch (error) {
    console.error('キーワードトリガー返信処理エラー:', error)
  }
}

// Threads API を使用して返信を送信
async function sendThreadsReply(supabase: any, persona: any, replyToId: string, responseText: string) {
  try {
    if (!persona.threads_access_token) {
      console.error('Threads access token not found for persona:', persona.id)
      return
    }

    console.log(`📤 Threads返信送信中: "${responseText}" (Reply to: ${replyToId})`)

    // コンテナを作成
    const createResponse = await fetch(`https://graph.threads.net/v1.0/${persona.threads_user_id}/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT_POST',
        text: responseText,
        reply_to_id: replyToId,
        access_token: persona.threads_access_token
      })
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('Threads container creation failed:', errorText)
      return
    }

    const containerData = await createResponse.json()
    console.log('🎯 Container created:', containerData.id)

    // 少し待機してから投稿
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 投稿を公開
    const publishResponse = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: persona.threads_access_token
      })
    })

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text()
      console.error('Threads publish failed:', errorText)
      return
    }

    const publishData = await publishResponse.json()
    console.log('✅ キーワード返信投稿成功:', publishData.id)

  } catch (error) {
    console.error('Threads返信送信エラー:', error)
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
