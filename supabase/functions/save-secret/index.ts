
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { encryptValue } from '../_shared/crypto.ts';

function getCorsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 認証トークンの検証
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('認証が必要です');
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('認証に失敗しました');
    }

    const { keyName, keyValue } = await req.json();

    if (!keyName || !keyValue) {
      throw new Error('キー名とキー値は必須です');
    }

    if (!/^[A-Z0-9_]{3,64}$/.test(keyName)) {
      throw new Error('無効なキー名です');
    }

    // Supabase Secretsから暗号化キーを取得
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('暗号化キーが設定されていません');
    }

    const encryptedKey = await encryptValue(keyValue, `save-secret:${keyName}`);
    if (!encryptedKey) {
      throw new Error('APIキーの暗号化に失敗しました');
    }

    // データベースに保存（upsertを使用して既存レコードを更新）
    const { error: dbError } = await supabaseAdmin
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
        error: (error instanceof Error ? error.message : String(error)) || 'APIキーの暗号化に失敗しました' 
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
