import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 期限が7日以内のトークンを持つアクティブなペルソナを取得
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: personas, error } = await supabase
      .from('personas')
      .select('id, name, threads_access_token, token_expires_at, threads_app_secret')
      .eq('is_active', true)
      .not('threads_access_token', 'is', null)
      .not('threads_access_token', 'eq', '')
      .or(`token_expires_at.is.null,token_expires_at.lte.${sevenDaysFromNow}`)

    if (error) throw error

    console.log(`🔄 対象ペルソナ数: ${personas?.length || 0}`)

    const results: Array<{
      id: string; name: string; success: boolean;
      new_expires_at?: string; error?: string
    }> = []

    for (const persona of (personas || [])) {
      const token = persona.threads_access_token?.trim()
      if (!token || !token.startsWith('THAA')) {
        results.push({ id: persona.id, name: persona.name, success: false, error: '無効なトークン形式' })
        continue
      }

      try {
        // Threads APIのリフレッシュエンドポイントを使用
        const refreshRes = await fetch(
          `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(token)}`,
          { method: 'GET' }
        )

        if (refreshRes.ok) {
          const data = await refreshRes.json()
          const newToken = data.access_token
          const expiresIn = data.expires_in || 5184000
          const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

          const { error: updateError } = await supabase
            .from('personas')
            .update({
              threads_access_token: newToken,
              token_expires_at: expiresAt,
              token_refreshed_at: new Date().toISOString(),
            })
            .eq('id', persona.id)

          if (updateError) {
            results.push({ id: persona.id, name: persona.name, success: false, error: updateError.message })
          } else {
            console.log(`✅ ${persona.name}: トークン更新成功, 期限: ${expiresAt}`)
            results.push({ id: persona.id, name: persona.name, success: true, new_expires_at: expiresAt })
          }
        } else {
          const errText = await refreshRes.text()
          console.warn(`❌ ${persona.name}: リフレッシュ失敗 ${refreshRes.status} ${errText}`)
          results.push({ id: persona.id, name: persona.name, success: false, error: `API ${refreshRes.status}: ${errText}` })
        }

        await new Promise(r => setTimeout(r, 500))
      } catch (fetchErr) {
        console.warn(`❌ ${persona.name}: ${fetchErr}`)
        results.push({ id: persona.id, name: persona.name, success: false, error: String(fetchErr) })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log(`📊 結果: 成功=${successCount}, 失敗=${failCount}`)

    return new Response(JSON.stringify({
      success: true,
      summary: { total: results.length, success: successCount, failed: failCount },
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Token refresh error:', err)
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
