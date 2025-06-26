
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('認証に失敗しました');
    }

    const { keyName, keyValue } = await req.json();

    if (!keyName || !keyValue) {
      throw new Error('キー名とキー値は必須です');
    }

    // Supabase Secretsから暗号化キーを取得
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('暗号化キーが設定されていません');
    }

    // 暗号化処理（AES-GCM）
    const encoder = new TextEncoder();
    const data = encoder.encode(keyValue);
    
    // 暗号化キーをCryptoKeyに変換
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // ランダムなIVを生成
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // データを暗号化
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      keyMaterial,
      data
    );

    // IVと暗号化されたデータを結合してBase64エンコード
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);
    const encryptedKey = btoa(String.fromCharCode(...combined));

    // データベースに保存（upsertを使用して既存レコードを更新）
    const { error: dbError } = await supabaseClient
      .from('user_api_keys')
      .upsert({
        user_id: user.id,
        key_name: keyName,
        encrypted_key: encryptedKey,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,key_name'
      });

    if (dbError) {
      console.error('データベースエラー:', dbError);
      throw new Error('APIキーの保存に失敗しました');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'APIキーが安全に保存されました',
        encrypted_key: encryptedKey,
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
    console.error('暗号化エラー:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'APIキーの暗号化に失敗しました' 
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
