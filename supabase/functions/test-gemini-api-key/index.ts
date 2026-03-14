import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { decryptValue } from '../_shared/crypto.ts';

function getCorsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (Deno.env.get('ENABLE_TEST_FUNCTIONS') !== 'true') {
    return new Response(JSON.stringify({ success: false, error: 'Disabled in production' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('🧪 Gemini API Key Test Request');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ユーザー認証
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false, status: 'auth_error', message: '認証が必要です'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({
        success: false, status: 'auth_error', message: '認証に失敗しました'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }
    
    const userId = user.id;
    const { keyName } = await req.json();

    if (!keyName) {
      return new Response(JSON.stringify({
        success: false, status: 'error', message: 'keyNameが必要です'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    console.log(`🔑 Testing API key: ${keyName} for user: ${userId}`);

    // Service Roleクライアントで暗号化キーをDBから取得
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: keyData, error: keyError } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', userId)
      .eq('key_name', keyName)
      .single();

    if (keyError || !keyData) {
      console.error(`❌ Key not found: ${keyName} for user: ${userId}`);
      return new Response(JSON.stringify({
        success: false, status: 'not_found', message: 'APIキーが見つかりません'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // _shared/crypto.ts で直接復号（retrieve-secret を経由しない）
    const decryptResult = await decryptValue(keyData.encrypted_key, `test-gemini:${keyName}`);

    if (!decryptResult.success) {
      console.error(`❌ Decryption failed: ${keyName}, errorType: ${decryptResult.errorType}`);
      return new Response(JSON.stringify({
        success: false,
        status: 'decrypt_error',
        message: decryptResult.errorType === 'no_encryption_key'
          ? 'ENCRYPTION_KEYが未設定です'
          : 'APIキーの復号化に失敗しました',
        errorType: decryptResult.errorType,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = decryptResult.value;

    // Gemini APIにテストリクエスト
    console.log('📡 Sending test request to Gemini API...');
    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello' }] }]
        })
      }
    );

    const responseText = await geminiResponse.text();
    console.log(`📊 Gemini API Response Status: ${geminiResponse.status}`);

    if (!geminiResponse.ok) {
      let errorData;
      try { errorData = JSON.parse(responseText); } catch { errorData = { message: responseText }; }

      if (geminiResponse.status === 429 || responseText.includes('RESOURCE_EXHAUSTED') || responseText.includes('quota')) {
        return new Response(JSON.stringify({
          success: false, status: 'quota_exceeded', message: 'クォータ制限に達しています', details: errorData
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (geminiResponse.status === 400 || geminiResponse.status === 403) {
        return new Response(JSON.stringify({
          success: false, status: 'invalid_key', message: '無効なAPIキーです', details: errorData
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({
        success: false, status: 'error', message: `APIエラー: ${geminiResponse.status}`, details: errorData
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('✅ API Key test successful');
    return new Response(JSON.stringify({
      success: true, status: 'ok', message: 'APIキーは正常に動作しています'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('❌ Test error:', error);
    return new Response(JSON.stringify({
      success: false, status: 'error',
      message: (error instanceof Error ? error.message : String(error)) || '予期しないエラーが発生しました',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  }
});
