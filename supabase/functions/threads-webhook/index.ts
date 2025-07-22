
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
      .select('id, name, user_id, ai_auto_reply_enabled, threads_username, threads_access_token')
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

      // 自動返信処理（統合版）
      await processAutoReply(supabase, persona, reply);
    }

    return repliesProcessed
  } catch (error) {
    console.error('Error processing reply data:', error)
    return 0
  }
}

// 自動返信処理（統合版）
async function processAutoReply(supabase: any, persona: any, reply: any) {
  try {
    console.log(`🔍 自動返信処理開始: ${reply.text} (ID: ${reply.id})`);
    
    // ペルソナの詳細情報を取得（自動返信設定を含む）
    const { data: fullPersona, error: personaError } = await supabase
      .from('personas')
      .select(`
        id,
        name,
        user_id,
        auto_reply_enabled,
        ai_auto_reply_enabled,
        auto_reply_delay_minutes,
        threads_access_token,
        personality,
        tone_of_voice,
        expertise
      `)
      .eq('id', persona.id)
      .maybeSingle();

    if (personaError || !fullPersona) {
      console.error('❌ ペルソナ詳細取得エラー:', personaError);
      return;
    }

    // 自動返信設定がOFFの場合は終了
    if (!fullPersona.auto_reply_enabled && !fullPersona.ai_auto_reply_enabled) {
      console.log('⚠️ 自動返信設定がOFFです - スキップ');
      return;
    }

    let templateMatched = false;

    // 定型文による自動返信がONの場合
    if (fullPersona.auto_reply_enabled) {
      console.log('🎯 定型文返信処理開始');
      
      // このペルソナの定型文返信設定を取得
      const { data: autoReplies, error: autoReplyError } = await supabase
        .from('auto_replies')
        .select('*')
        .eq('user_id', fullPersona.user_id)
        .eq('is_active', true);

      if (autoReplyError) {
        console.error('❌ 定型文返信設定の取得エラー:', autoReplyError);
      } else if (autoReplies && autoReplies.length > 0) {
        console.log(`🎯 定型文返信設定: ${autoReplies.length}件`);

        // キーワードマッチングをチェック
        const replyText = (reply.text || '').toLowerCase().trim();

        for (const autoReply of autoReplies) {
          const keywords = autoReply.trigger_keywords || [];
      
          for (const keyword of keywords) {
            if (!keyword) continue;
        
            const keywordLower = keyword.toLowerCase().trim();
            
            // より確実な部分一致チェック
            const cleanReplyText = replyText.replace(/[「」『』\(\)（）\[\]【】<>《》]/g, '').trim();
            const cleanKeyword = keywordLower.replace(/[「」『』\(\)（）\[\]【】<>《》]/g, '').trim();
            
            const isMatch = cleanReplyText.includes(cleanKeyword) || 
                           replyText.includes(keywordLower) ||
                           cleanReplyText === cleanKeyword ||
                           replyText === keywordLower;

            if (isMatch) {
              console.log(`🎯 マッチしました！返信: "${autoReply.response_template}"`);
              
              try {
                // Threads APIで返信を送信
                await sendThreadsReply(fullPersona, reply, autoReply.response_template);
                
                // ステータスを更新
                await supabase
                  .from('thread_replies')
                  .update({
                    reply_status: 'sent',
                    auto_reply_sent: true,
                    updated_at: new Date().toISOString()
                  })
                  .eq('reply_id', reply.id);

                console.log('✅ 定型文返信送信完了');
                templateMatched = true;
                break;
            
              } catch (sendError) {
                console.error('❌ 定型文返信送信エラー:', sendError);
                
                // エラー状態を記録
                await supabase
                  .from('thread_replies')
                  .update({
                    reply_status: 'failed',
                    updated_at: new Date().toISOString()
                  })
                  .eq('reply_id', reply.id);
              }
            }
          }
          
          if (templateMatched) break;
        }
      }
    }

    // 定型文でマッチしなかった場合、AI自動返信を試す
    if (!templateMatched && fullPersona.ai_auto_reply_enabled) {
      console.log('🤖 AI自動返信処理開始');
      
      try {
        // 元の投稿内容を取得
        let originalPostContent = '';
        try {
          if (reply.root_post?.id) {
            const postResponse = await fetch(`https://graph.threads.net/v1.0/${reply.root_post.id}?fields=text&access_token=${fullPersona.threads_access_token}`);
            if (postResponse.ok) {
              const postData = await postResponse.json();
              originalPostContent = postData.text || '';
            }
          }
        } catch (error) {
          console.error('元投稿取得エラー:', error);
        }

        // AI返信を生成
        const aiResponse = await supabase.functions.invoke('generate-auto-reply', {
          body: {
            postContent: originalPostContent,
            replyContent: reply.text,
            persona: fullPersona
          }
        });

        if (aiResponse.error) {
          throw new Error(aiResponse.error.message);
        }

        const aiReplyText = aiResponse.data?.reply;
        
        if (aiReplyText) {
          // 遅延設定をチェック
          const delayMinutes = fullPersona.auto_reply_delay_minutes || 0;
          
          if (delayMinutes > 0) {
            // スケジュール返信として登録
            const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
            
            await supabase
              .from('thread_replies')
              .update({
                reply_status: 'scheduled',
                scheduled_reply_at: scheduledAt.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('reply_id', reply.id);

            console.log(`⏰ AI返信をスケジュール登録: ${delayMinutes}分後`);
          } else {
            // 即座に返信
            await sendThreadsReply(fullPersona, reply, aiReplyText);
            
            await supabase
              .from('thread_replies')
              .update({
                reply_status: 'sent',
                auto_reply_sent: true,
                updated_at: new Date().toISOString()
              })
              .eq('reply_id', reply.id);

            console.log('✅ AI自動返信送信完了');
          }
        }
        
      } catch (aiError) {
        console.error('❌ AI自動返信エラー:', aiError);
        
        await supabase
          .from('thread_replies')
          .update({
            reply_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('reply_id', reply.id);
      }
    }

    if (!templateMatched && !fullPersona.ai_auto_reply_enabled) {
      console.log('❌ マッチするキーワードがなく、AI返信も無効です');
    }

  } catch (error) {
    console.error('❌ 自動返信処理エラー:', error);
  }
}

// Threads APIで返信を送信する関数
async function sendThreadsReply(persona: any, thread: any, responseText: string) {
  console.log('📤 Threads返信送信開始...');
  
  // Step 1: Create the reply container
  const createResponse = await fetch(`https://graph.threads.net/v1.0/me/threads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      media_type: 'TEXT',
      text: responseText,
      reply_to_id: thread.root_post?.id || thread.replied_to?.id,
      access_token: persona.threads_access_token
    })
  });

  const createResult = await createResponse.json();
  console.log('📝 コンテナ作成:', createResponse.status, createResult);

  if (!createResponse.ok) {
    throw new Error(`Container creation failed: ${createResponse.status} - ${JSON.stringify(createResult)}`);
  }

  const containerId = createResult.id;

  // Step 2: Publish the reply
  const publishResponse = await fetch(`https://graph.threads.net/v1.0/${containerId}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      access_token: persona.threads_access_token
    })
  });

  const publishResult = await publishResponse.json();
  console.log('📢 返信公開:', publishResponse.status, publishResult);

  if (!publishResponse.ok) {
    throw new Error(`Publish failed: ${publishResponse.status} - ${JSON.stringify(publishResult)}`);
  }

  console.log('✅ 返信送信成功:', publishResult.id);
  return publishResult;
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
