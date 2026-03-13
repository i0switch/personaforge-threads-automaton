import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decryptIfNeeded } from '../_shared/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://threads-genius-ai.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const keyNamePattern = /^[A-Za-z0-9_]{3,64}$/

type RetrieveSecretResponse = {
  success?: boolean
  secret?: string
  error?: string
}

async function retrieveSecretViaEdgeFunction(
  keyName: string,
  personaId: string,
  authHeader: string
): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !anonKey) {
      console.warn('⚠️ Missing SUPABASE_URL or SUPABASE_ANON_KEY, skipping retrieve-secret call')
      return null
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/retrieve-secret`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'apikey': anonKey,
      },
      body: JSON.stringify({ key: keyName, personaId }),
    })

    const payload = await response.json().catch(() => ({} as RetrieveSecretResponse)) as RetrieveSecretResponse

    if (!response.ok || !payload?.success || !payload?.secret) {
      console.warn(`⚠️ retrieve-secret lookup failed for key=${keyName}, status=${response.status}`)
      return null
    }

    return payload.secret
  } catch (error) {
    console.warn(`⚠️ retrieve-secret call error for key=${keyName}:`, error)
    return null
  }
}

async function resolveAppSecret(
  storedValue: string,
  personaId: string,
  authHeader: string
): Promise<string> {
  // 参照キー形式なら retrieve-secret で復号済みシークレットを取得
  if (keyNamePattern.test(storedValue)) {
    const retrieved = await retrieveSecretViaEdgeFunction(storedValue, personaId, authHeader)
    if (retrieved) {
      return retrieved
    }
  }

  // 旧データ（平文 / 直接暗号化値）にフォールバック
  const fallback = await decryptIfNeeded(storedValue, `app_secret:persona_${personaId}`)
  if (fallback) {
    return fallback
  }

  throw new Error('Failed to resolve App Secret. Please re-save it in persona settings.')
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

    console.log(`🔐 OAuth callback received for persona=${persona_id}, state_length=${String(state).length}`)

    // ペルソナからapp_idとapp_secretを取得
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('id, name, threads_app_id, threads_app_secret, user_id')
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

    const defaultCallback = `${Deno.env.get('ALLOWED_ORIGIN') ?? 'https://threads-genius-ai.lovable.app'}/auth/callback`
    const callbackUri = redirect_uri || Deno.env.get('THREADS_OAUTH_REDIRECT_URI') || defaultCallback

    // App Secret解決（参照キー or 旧形式）
    console.log(`🔓 [${persona.name}] Resolving App Secret...`)
    const resolvedAppSecret = await resolveAppSecret(persona.threads_app_secret, persona_id, authHeader)
    console.log(`✅ [${persona.name}] App Secret ready (length: ${resolvedAppSecret.length})`)

    // Step 1: 認証コードを短期トークンに交換
    console.log(`🔄 [${persona.name}] Exchanging auth code for short-lived token...`)
    const tokenParams = new URLSearchParams({
      client_id: persona.threads_app_id,
      client_secret: resolvedAppSecret,
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
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(resolvedAppSecret)}&access_token=${encodeURIComponent(shortToken)}`,
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
    const updateData: Record<string, string | boolean> = {
      threads_access_token: longToken,
      token_expires_at: expiresAt,
      token_refreshed_at: new Date().toISOString(),
      is_active: true,
    }
    if (threadsUserId) updateData.threads_user_id = threadsUserId
    if (threadsUsername) updateData.threads_username = threadsUsername

    const { data: updatedPersona, error: updateError } = await supabase
      .from('personas')
      .update(updateData)
      .eq('id', persona_id)
      .eq('user_id', user.id)
      .select('id')
      .single()

    if (updateError || !updatedPersona) {
      console.error(`❌ [${persona.name}] DB update failed:`, updateError)
      return new Response(JSON.stringify({ error: 'Failed to save token', details: updateError?.message }), {
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
