import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decryptIfNeeded } from '../_shared/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://threads-genius-ai.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 暗号化されたApp Secretを復号化する関数（共通モジュール使用）
async function decryptAppSecret(encryptedValue: string, personaId: string, _supabase: any): Promise<string> {
  const result = await decryptIfNeeded(encryptedValue, `app_secret:persona_${personaId}`);
  if (result) {
    return result;
  }
  throw new Error('Failed to decrypt App Secret. Please re-enter it in persona settings.');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { code, state, persona_id, redirect_uri } = await req.json()

    if (!code || !state || !persona_id) {
      return new Response(JSON.stringify({ error: 'code, state and persona_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } }
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ペルソナからapp_idとapp_secretを取得
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('id, name, threads_app_id, threads_app_secret, user_id, oauth_state, oauth_state_expires_at, oauth_redirect_uri')
      .eq('id', persona_id)
      .eq('user_id', user.id)
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

    if (!persona.oauth_state || !persona.oauth_state_expires_at) {
      return new Response(JSON.stringify({ error: 'OAuth state not initialized. Please restart OAuth flow.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const stateExpired = new Date(persona.oauth_state_expires_at).getTime() <= Date.now()
    if (stateExpired) {
      await supabase
        .from('personas')
        .update({ oauth_state: null, oauth_state_expires_at: null, oauth_redirect_uri: null })
        .eq('id', persona_id)
      return new Response(JSON.stringify({ error: 'OAuth state expired. Please restart OAuth flow.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (persona.oauth_state !== state) {
      return new Response(JSON.stringify({ error: 'Invalid OAuth state. Please restart OAuth flow.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const clearOAuthState = async () => {
      await supabase
        .from('personas')
        .update({ oauth_state: null, oauth_state_expires_at: null, oauth_redirect_uri: null })
        .eq('id', persona_id)
        .eq('oauth_state', state)
    }

    const defaultCallback = `${Deno.env.get('ALLOWED_ORIGIN') ?? 'https://threads-genius-ai.lovable.app'}/auth/callback`
    const callbackUri = persona.oauth_redirect_uri || redirect_uri || Deno.env.get('THREADS_OAUTH_REDIRECT_URI') || defaultCallback

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
      await clearOAuthState()
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
      await clearOAuthState()
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
      oauth_state: null,
      oauth_state_expires_at: null,
      oauth_redirect_uri: null,
    }
    if (threadsUserId) updateData.threads_user_id = threadsUserId
    if (threadsUsername) updateData.threads_username = threadsUsername

    const { data: updateRows, error: updateError } = await supabase
      .from('personas')
      .update(updateData)
      .eq('id', persona_id)
      .eq('oauth_state', state)
      .select('id')
      .limit(1)

    if (updateError) {
      console.error(`❌ [${persona.name}] DB update failed:`, updateError)
      await clearOAuthState()
      return new Response(JSON.stringify({ error: 'Failed to save token', details: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!updateRows || updateRows.length === 0) {
      return new Response(JSON.stringify({ error: 'OAuth state was already consumed. Please restart OAuth flow.' }), {
        status: 409,
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
