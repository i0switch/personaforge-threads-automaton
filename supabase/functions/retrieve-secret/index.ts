
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { key, fallback } = await req.json();
    console.log(`🔑 シークレット取得リクエスト: ${key}`);

    if (!key) {
      throw new Error('キー名は必須です');
    }

    // fallbackが非暗号化トークン（THAAで開始）の場合はそのまま返す
    if (fallback && typeof fallback === 'string' && fallback.startsWith('THAA')) {
      console.log('✅ 非暗号化トークンをそのまま使用:', key);
      return new Response(
        JSON.stringify({ 
          success: true, 
          secret: fallback,
          source: 'fallback_unencrypted'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // 認証トークンの検証（オプション）
    let user = null;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(token);
        
        if (!authError && authUser) {
          user = authUser;
          console.log('✅ ユーザー認証成功:', user.id);
        }
      } catch (authErr) {
        console.log('⚠️ 認証をスキップ（内部呼び出し）:', authErr.message);
      }
    }

    // ユーザーIDの決定（認証成功時またはfallbackから推定）
    let userId = user?.id;
    if (!userId && fallback) {
      // fallbackからユーザーを特定する試行
      try {
        const { data: personas } = await supabaseClient
          .from('personas')
          .select('user_id')
          .eq('threads_access_token', fallback)
          .limit(1)
          .single();
        
        if (personas?.user_id) {
          userId = personas.user_id;
          console.log('📍 ユーザーIDをfallbackから特定:', userId);
        }
      } catch (err) {
        console.log('⚠️ fallbackからのユーザー特定失敗:', err.message);
      }
    }

    if (!userId) {
      console.log('❌ ユーザーIDが特定できないため、fallbackを返します');
      return new Response(
        JSON.stringify({ 
          success: true, 
          secret: fallback || null,
          source: 'fallback_no_auth'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // データベースから暗号化されたキーを取得
    const { data: keyData, error: dbError } = await supabaseClient
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', userId)
      .eq('key_name', key.replace(/^threads_access_token_/, 'threads_access_token'))
      .single();

    if (dbError || !keyData) {
      console.log('🔄 APIキーが見つからないため、fallbackを返します:', key);
      return new Response(
        JSON.stringify({ 
          success: true, 
          secret: fallback || null,
          source: 'fallback_no_key'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Supabase Secretsから暗号化キーを取得
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      console.log('🔄 暗号化キーが設定されていないため、fallbackを返します');
      return new Response(
        JSON.stringify({ 
          success: true, 
          secret: fallback || null,
          source: 'fallback_no_encryption_key'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // 復号化処理
    try {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      // Base64デコード
      const encryptedData = Uint8Array.from(atob(keyData.encrypted_key), c => c.charCodeAt(0));
      
      // IVと暗号化されたデータを分離
      const iv = encryptedData.slice(0, 12);
      const ciphertext = encryptedData.slice(12);

      // 暗号化キーをCryptoKeyに変換
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      // データを復号化
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        keyMaterial,
        ciphertext
      );

      const decryptedKey = decoder.decode(decryptedData);
      console.log('✅ 復号化成功:', key);

      return new Response(
        JSON.stringify({ 
          success: true, 
          secret: decryptedKey,
          source: 'decrypted'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );

    } catch (decryptError) {
      console.error('❌ 復号化失敗:', decryptError.message);
      console.log('🔄 復号化失敗のためfallbackを返します');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          secret: fallback || null,
          source: 'fallback_decrypt_error'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

  } catch (error) {
    console.error('❌ 全体エラー:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'APIキーの取得に失敗しました' 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
