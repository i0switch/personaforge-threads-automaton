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

    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // Step 1: token_expires_atがnullのペルソナを先にマーク
    // 無効なトークンを持つものは期限切れとしてマークし、次回以降スキップ
    const { data: nullExpiryPersonas } = await supabase
      .from('personas')
      .select('id, name, threads_access_token')
      .eq('is_active', true)
      .not('threads_access_token', 'is', null)
      .not('threads_access_token', 'eq', '')
      .is('token_expires_at', null)

    let nullFixedCount = 0
    if (nullExpiryPersonas && nullExpiryPersonas.length > 0) {
      console.log(`🔍 token_expires_at未設定: ${nullExpiryPersonas.length}件を検証中...`)
      
      for (const p of nullExpiryPersonas) {
        const token = p.threads_access_token?.trim()
        
        // THAAで始まらない→無効トークン、即座に期限切れマーク
        if (!token || !token.startsWith('THAA')) {
          await supabase
            .from('personas')
            .update({ token_expires_at: new Date(0).toISOString() })
            .eq('id', p.id)
          nullFixedCount++
          continue
        }

        // 有効な形式のトークン→1件だけリフレッシュ試行
        try {
          const refreshRes = await fetch(
            `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(token)}`,
            { method: 'GET' }
          )

          if (refreshRes.ok) {
            const data = await refreshRes.json()
            const expiresAt = new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString()
            await supabase
              .from('personas')
              .update({
                threads_access_token: data.access_token,
                token_expires_at: expiresAt,
                token_refreshed_at: new Date().toISOString(),
              })
              .eq('id', p.id)
            console.log(`✅ ${p.name}: トークン更新+期限設定成功 (${expiresAt})`)
          } else {
            await refreshRes.text() // consume body
            await supabase
              .from('personas')
              .update({ token_expires_at: new Date(0).toISOString() })
              .eq('id', p.id)
            nullFixedCount++
          }
        } catch {
          await supabase
            .from('personas')
            .update({ token_expires_at: new Date(0).toISOString() })
            .eq('id', p.id)
          nullFixedCount++
        }

        await new Promise(r => setTimeout(r, 300))
      }

      if (nullFixedCount > 0) {
        console.log(`📌 ${nullFixedCount}件の期限切れペルソナをマーク済み（次回以降スキップ）`)
      }
    }

    // Step 2: 期限が7日以内でまだ有効なトークンをリフレッシュ
    const { data: expiringPersonas, error } = await supabase
      .from('personas')
      .select('id, name, threads_access_token, token_expires_at')
      .eq('is_active', true)
      .not('threads_access_token', 'is', null)
      .not('threads_access_token', 'eq', '')
      .gt('token_expires_at', now.toISOString())
      .lte('token_expires_at', sevenDaysFromNow)

    if (error) throw error

    // 統計情報
    const { count: expiredCount } = await supabase
      .from('personas')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .not('threads_access_token', 'is', null)
      .lt('token_expires_at', now.toISOString())

    const { count: healthyCount } = await supabase
      .from('personas')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .not('threads_access_token', 'is', null)
      .gt('token_expires_at', sevenDaysFromNow)

    console.log(`📊 ステータス: 正常=${healthyCount || 0}, 更新対象=${expiringPersonas?.length || 0}, 期限切れ=${expiredCount || 0}`)

    const results: Array<{
      id: string; name: string; success: boolean;
      new_expires_at?: string; error?: string
    }> = []

    for (const persona of (expiringPersonas || [])) {
      const token = persona.threads_access_token?.trim()
      if (!token || !token.startsWith('THAA')) {
        results.push({ id: persona.id, name: persona.name, success: false, error: '無効なトークン形式' })
        continue
      }

      try {
        const refreshRes = await fetch(
          `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(token)}`,
          { method: 'GET' }
        )

        if (refreshRes.ok) {
          const data = await refreshRes.json()
          const expiresAt = new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString()

          const { error: updateError } = await supabase
            .from('personas')
            .update({
              threads_access_token: data.access_token,
              token_expires_at: expiresAt,
              token_refreshed_at: new Date().toISOString(),
            })
            .eq('id', persona.id)

          if (updateError) {
            results.push({ id: persona.id, name: persona.name, success: false, error: updateError.message })
          } else {
            console.log(`✅ ${persona.name}: トークン更新成功, 新期限: ${expiresAt}`)
            results.push({ id: persona.id, name: persona.name, success: true, new_expires_at: expiresAt })
          }
        } else {
          const errText = await refreshRes.text()
          console.warn(`❌ ${persona.name}: リフレッシュ失敗 ${refreshRes.status}`)
          results.push({ id: persona.id, name: persona.name, success: false, error: `API ${refreshRes.status}` })
        }

        await new Promise(r => setTimeout(r, 300))
      } catch (fetchErr) {
        console.warn(`❌ ${persona.name}: ${fetchErr}`)
        results.push({ id: persona.id, name: persona.name, success: false, error: String(fetchErr) })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log(`📊 リフレッシュ結果: 成功=${successCount}, 失敗=${failCount}`)

    return new Response(JSON.stringify({
      success: true,
      summary: { 
        total: results.length, 
        success: successCount, 
        failed: failCount, 
        expired_count: expiredCount || 0,
        healthy_count: healthyCount || 0,
        null_fixed: nullFixedCount
      },
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
