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

    // threads_user_idが未設定でthreads_access_tokenがあるペルソナを取得
    const { data: personas, error } = await supabase
      .from('personas')
      .select('id, name, threads_access_token, threads_username')
      .is('threads_user_id', null)
      .not('threads_access_token', 'is', null)
      .not('threads_access_token', 'eq', '')

    if (error) throw error

    console.log(`対象ペルソナ数: ${personas?.length || 0}`)

    const results: Array<{ id: string; name: string; success: boolean; threads_user_id?: string; username?: string; error?: string }> = []

    for (const persona of (personas || [])) {
      const token = persona.threads_access_token?.trim()
      
      // 明らかにトークンでないもの（短すぎる、THAAで始まらない）をスキップ
      if (!token || token.length < 20 || !token.startsWith('THAA')) {
        results.push({ id: persona.id, name: persona.name, success: false, error: '無効なトークン形式' })
        continue
      }

      try {
        const res = await fetch(
          `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(token)}`
        )

        if (res.ok) {
          const profile = await res.json()
          console.log(`✅ ${persona.name}: threads_user_id=${profile.id}, username=${profile.username}`)

          const updateData: Record<string, string> = { threads_user_id: profile.id }
          if (profile.username && !persona.threads_username) {
            updateData.threads_username = profile.username
          }

          const { error: updateError } = await supabase
            .from('personas')
            .update(updateData)
            .eq('id', persona.id)

          if (updateError) {
            results.push({ id: persona.id, name: persona.name, success: false, error: updateError.message })
          } else {
            results.push({ id: persona.id, name: persona.name, success: true, threads_user_id: profile.id, username: profile.username })
          }
        } else {
          const errText = await res.text()
          console.warn(`❌ ${persona.name}: ${res.status} ${errText}`)
          results.push({ id: persona.id, name: persona.name, success: false, error: `API ${res.status}` })
        }

        // レート制限回避のため少し待機
        await new Promise(r => setTimeout(r, 500))
      } catch (fetchErr) {
        console.warn(`❌ ${persona.name}: ${fetchErr}`)
        results.push({ id: persona.id, name: persona.name, success: false, error: String(fetchErr) })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return new Response(JSON.stringify({
      success: true,
      summary: { total: results.length, success: successCount, failed: failCount },
      results
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
