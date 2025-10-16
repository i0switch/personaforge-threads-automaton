import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Gemini API Key Test Request');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 認証チェック
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('認証が必要です');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('認証に失敗しました');
    }

    const { keyName } = await req.json();

    if (!keyName) {
      throw new Error('keyNameが必要です');
    }

    console.log(`🔑 Testing API key: ${keyName}`);

    // データベースから暗号化されたキーを取得
    const { data: keyData, error: keyError } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', user.id)
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
