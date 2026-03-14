import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 認証チェック（getClaims使用でネットワーク呼び出し不要）
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('認証が必要です');
    }

    const token = authHeader.replace('Bearer ', '');
    
    // anonKeyでクライアント作成し、ユーザートークンで認証
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      throw new Error('認証に失敗しました');
    }
    
    const userId = claimsData.claims.sub as string;

    const { keyName } = await req.json();

    if (!keyName) {
      throw new Error('keyNameが必要です');
    }

    console.log(`🔑 Testing API key: ${keyName}`);

    // データベースから暗号化されたキーを取得
    const { data: keyData, error: keyError } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', userId)
      .eq('key_name', keyName)
      .single();

    if (keyError || !keyData) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'not_found',
          message: 'APIキーが見つかりません'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 復号化（retrieve-secretを使用）
    const { data: secretData, error: secretError } = await supabase.functions.invoke(
      'retrieve-secret',
      {
        body: { key: keyName, fallback: keyData.encrypted_key },
        headers: { Authorization: authHeader }
      }
    );

    if (secretError || !secretData?.secret) {
      throw new Error('APIキーの復号化に失敗しました');
    }

    const apiKey = secretData.secret;

    // Gemini APIにテストリクエストを送信
    console.log('📡 Sending test request to Gemini API...');
    
    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Hello'
            }]
          }]
        })
      }
    );

    const responseText = await geminiResponse.text();
    console.log(`📊 Gemini API Response Status: ${geminiResponse.status}`);
    console.log(`📊 Gemini API Response: ${responseText.substring(0, 200)}...`);

    if (!geminiResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { message: responseText };
      }

      // クォータ枯渇のチェック
      if (geminiResponse.status === 429 || 
          responseText.includes('RESOURCE_EXHAUSTED') ||
          responseText.includes('quota')) {
        return new Response(
          JSON.stringify({
            success: false,
            status: 'quota_exceeded',
            message: 'クォータ制限に達しています',
            details: errorData
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }

      // 無効なAPIキー
      if (geminiResponse.status === 400 || geminiResponse.status === 403) {
        return new Response(
          JSON.stringify({
            success: false,
            status: 'invalid_key',
            message: '無効なAPIキーです',
            details: errorData
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }

      // その他のエラー
      return new Response(
        JSON.stringify({
          success: false,
          status: 'error',
          message: `APIエラー: ${geminiResponse.status}`,
          details: errorData
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // 成功
    console.log('✅ API Key test successful');
    return new Response(
      JSON.stringify({
        success: true,
        status: 'ok',
        message: 'APIキーは正常に動作しています'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Test error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        status: 'error',
        message: error.message || '予期しないエラーが発生しました',
        details: error
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});
