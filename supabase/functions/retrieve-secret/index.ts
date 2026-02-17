import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
      .eq('key_name', key.replace(/^threads_access_token_/, 'threads_access_token'))
      .single();

    if (dbError || !keyData) {
      console.log('🔄 APIキーが見つかりません:', key);
      return new Response(
        JSON.stringify({ success: false, error: 'Key not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase Secretsから暗号化キーを取得
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      console.error('❌ ENCRYPTION_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 復号化処理
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const encryptedData = Uint8Array.from(atob(keyData.encrypted_key), c => c.charCodeAt(0));
    const iv = encryptedData.slice(0, 12);
    const ciphertext = encryptedData.slice(12);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      keyMaterial,
      ciphertext
    );

    const decryptedKey = decoder.decode(decryptedData);
    console.log('✅ 復号化成功:', key);

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
