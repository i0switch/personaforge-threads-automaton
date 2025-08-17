
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

    // 認証トークンの検証
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('認証が必要です');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('無効な認証形式です');
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token || token.length < 10) {
      throw new Error('無効なトークンです');
    }
    
    // セッション有効期限チェックを追加
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError) {
      console.error('Auth error details:', authError);
      console.error('Token length:', token.length);
      console.error('Token prefix:', token.substring(0, 20));
      throw new Error(`認証エラー: ${authError.message}`);
    }
    
    if (!user) {
      throw new Error('ユーザー情報を取得できません。再ログインしてください。');
    }

    console.log('User authenticated successfully:', user.id);

    const { keyName } = await req.json();

    if (!keyName) {
      throw new Error('キー名は必須です');
    }

    // データベースから暗号化されたキーを取得
    const { data: keyData, error: dbError } = await supabaseClient
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', user.id)
      .eq('key_name', keyName)
      .single();

    if (dbError || !keyData) {
      throw new Error('APIキーが見つかりません');
    }

    // Supabase Secretsから暗号化キーを取得
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('暗号化キーが設定されていません');
    }

    // 復号化処理
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        keyValue: decryptedKey,
        keyName: keyName
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('復号化エラー:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'APIキーの復号化に失敗しました' 
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
