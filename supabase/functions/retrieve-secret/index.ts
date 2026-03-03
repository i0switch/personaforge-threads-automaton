import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { decryptValue } from '../_shared/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://threads-genius-ai.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // === 認証必須: JWT検証 ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('❌ Authorization header missing or invalid');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // anon keyでユーザー検証（RLS適用）
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      console.error('❌ JWT validation failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log('✅ ユーザー認証成功:', userId);

    // Service Roleクライアント（DB操作用）
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { key, personaId } = await req.json();

    if (!key) {
      return new Response(
        JSON.stringify({ error: 'キー名は必須です' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔑 シークレット取得リクエスト: ${key}, persona: ${personaId}`);

    // === IDOR対策: ペルソナの所有者チェック ===
    if (personaId) {
      const { data: persona, error: personaError } = await supabaseAdmin
        .from('personas')
        .select('user_id')
        .eq('id', personaId)
        .single();

      if (personaError || !persona) {
        console.error('❌ ペルソナが見つかりません:', personaId);
        return new Response(
          JSON.stringify({ error: 'Persona not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (persona.user_id !== userId) {
        console.error(`❌ IDOR検出: user ${userId} が persona ${personaId} (owner: ${persona.user_id}) にアクセス試行`);
        await supabaseAdmin.from('security_events').insert({
          event_type: 'idor_attempt',
          user_id: userId,
          details: { persona_id: personaId, key, timestamp: new Date().toISOString() }
        });
        return new Response(
          JSON.stringify({ error: 'Access denied: not your persona' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // データベースから暗号化されたキーを取得
    const { data: keyData, error: dbError } = await supabaseAdmin
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', userId)
      .eq('key_name', key)
      .single();

    if (dbError || !keyData) {
      console.log('🔄 APIキーが見つかりません:', key);
      return new Response(
        JSON.stringify({ success: false, error: 'Key not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 共通復号モジュールで復号
    const result = await decryptValue(keyData.encrypted_key, `retrieve-secret:${key}`);
    
    if (!result.success) {
      console.error(`❌ 復号失敗: ${key}, errorType: ${result.errorType}`);
      return new Response(
        JSON.stringify({ error: `Decryption failed: ${result.errorType}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const decryptedKey = result.value;
    console.log(`✅ 復号化成功: ${key} (method: ${result.method})`);

    return new Response(
      JSON.stringify({ success: true, secret: decryptedKey, source: 'decrypted' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ retrieve-secret error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
