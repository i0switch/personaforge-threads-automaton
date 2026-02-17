import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 暗号化されたApp Secretを復号化する関数
async function decryptAppSecret(encryptedValue: string, personaId: string, supabase: any): Promise<string> {
  // THAAで始まる場合は非暗号化トークン
  if (encryptedValue.startsWith('THAA')) {
    return encryptedValue
  }

  // 32文字以下の場合は平文のApp Secretと判断
  if (encryptedValue.length <= 40) {
    return encryptedValue
  }

  // 暗号化されている場合はretrieve-secretと同じロジックで復号化
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')
  if (!encryptionKey) {
    console.error('❌ ENCRYPTION_KEY not set, cannot decrypt app_secret')
    throw new Error('Encryption key not configured')
  }

  try {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    // Base64デコード
    const encryptedData = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0))

    // IVと暗号化されたデータを分離
    const iv = encryptedData.slice(0, 12)
    const ciphertext = encryptedData.slice(12)

    // 暗号化キーをCryptoKeyに変換
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )

    // データを復号化
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      keyMaterial,
      ciphertext
    )

    const decrypted = decoder.decode(decryptedData)
    console.log(`✅ App Secret decrypted successfully for persona ${personaId}`)
    return decrypted
  } catch (err) {
    console.error(`❌ Failed to decrypt app_secret:`, err)
    throw new Error('Failed to decrypt App Secret. Please re-enter it in persona settings.')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { code, persona_id, redirect_uri } = await req.json()

    if (!code || !persona_id) {
      return new Response(JSON.stringify({ error: 'code and persona_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ペルソナからapp_idとapp_secretを取得
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('id, name, threads_app_id, threads_app_secret, user_id')
      .eq('id', persona_id)
      .single()

    if (personaError || !persona) {
      return new Response(JSON.stringify({ error: 'Persona not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!persona.threads_app_id || !persona.threads_app_secret) {
      return new Response(JSON.stringify({ error: 'App ID and App Secret must be set on the persona first' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const callbackUri = redirect_uri || 'https://threads-genius-ai.lovable.app/auth/callback'

    // App Secretを復号化（暗号化されている場合）
    console.log(`🔓 [${persona.name}] Decrypting App Secret (length: ${persona.threads_app_secret.length})...`)
    const decryptedAppSecret = await decryptAppSecret(persona.threads_app_secret, persona_id, supabase)
    console.log(`✅ [${persona.name}] App Secret ready (length: ${decryptedAppSecret.length})`)

    // Step 1: 認証コードを短期トークンに交換
    console.log(`🔄 [${persona.name}] Exchanging auth code for short-lived token...`)
    const tokenParams = new URLSearchParams({
      client_id: persona.threads_app_id,
      client_secret: decryptedAppSecret,
      grant_type: 'authorization_code',
      redirect_uri: callbackUri,
      code,
    })

    const shortTokenRes = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      body: tokenParams,
    })

    if (!shortTokenRes.ok) {
      const errText = await shortTokenRes.text()
      console.error(`❌ Short-lived token exchange failed: ${shortTokenRes.status} ${errText}`)
      return new Response(JSON.stringify({ error: 'Failed to exchange auth code', details: errText }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const shortTokenData = await shortTokenRes.json()
    const shortToken = shortTokenData.access_token
    console.log(`✅ [${persona.name}] Short-lived token obtained`)

    // Step 2: 短期トークンを長期トークンに交換
    console.log(`🔄 [${persona.name}] Exchanging for long-lived token...`)
    const longTokenRes = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(decryptedAppSecret)}&access_token=${encodeURIComponent(shortToken)}`,
      { method: 'GET' }
    )

    if (!longTokenRes.ok) {
      const errText = await longTokenRes.text()
      console.error(`❌ Long-lived token exchange failed: ${longTokenRes.status} ${errText}`)
      return new Response(JSON.stringify({ error: 'Failed to get long-lived token', details: errText }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const longTokenData = await longTokenRes.json()
    const longToken = longTokenData.access_token
    const expiresIn = longTokenData.expires_in || 5184000 // default 60 days
    console.log(`✅ [${persona.name}] Long-lived token obtained, expires in ${expiresIn}s`)

    // Step 3: Threads プロフィール取得
    const profileRes = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username`,
      { headers: { 'Authorization': `Bearer ${longToken}` } }
    )

    let threadsUserId: string | null = null
    let threadsUsername: string | null = null
    if (profileRes.ok) {
      const profile = await profileRes.json()
      threadsUserId = profile.id
      threadsUsername = profile.username
      console.log(`✅ [${persona.name}] Profile: id=${threadsUserId}, username=${threadsUsername}`)
    }

    // Step 4: ペルソナを更新
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    const updateData: Record<string, any> = {
      threads_access_token: longToken,
      token_expires_at: expiresAt,
      token_refreshed_at: new Date().toISOString(),
      is_active: true,
    }
    if (threadsUserId) updateData.threads_user_id = threadsUserId
    if (threadsUsername) updateData.threads_username = threadsUsername

    const { error: updateError } = await supabase
      .from('personas')
      .update(updateData)
      .eq('id', persona_id)

    if (updateError) {
      console.error(`❌ [${persona.name}] DB update failed:`, updateError)
      return new Response(JSON.stringify({ error: 'Failed to save token', details: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`🎉 [${persona.name}] OAuth flow complete! Token saved, expires at ${expiresAt}`)

    return new Response(JSON.stringify({
      success: true,
      persona_name: persona.name,
      threads_user_id: threadsUserId,
      threads_username: threadsUsername,
      token_expires_at: expiresAt,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('OAuth callback error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
