
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getUserApiKey(userId: string, keyName: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', userId)
      .eq('key_name', keyName)
      .single();

    if (error || !data) {
      return null;
    }

    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) return null;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const encryptedData = Uint8Array.from(atob(data.encrypted_key), c => c.charCodeAt(0));
    const iv = encryptedData.slice(0, 12);
    const ciphertext = encryptedData.slice(12);

    // Try current AES-GCM first
    try {
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        keyMaterial,
        ciphertext
      );
      return decoder.decode(decrypted);
    } catch (_e) {
      // Fallback to legacy PBKDF2-derived AES-GCM
      try {
        const baseKey = await crypto.subtle.importKey(
          'raw',
          encoder.encode(encryptionKey),
          { name: 'PBKDF2' },
          false,
          ['deriveKey']
        );
        const derivedKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: encoder.encode('salt'),
            iterations: 100000,
            hash: 'SHA-256',
          },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          derivedKey,
          ciphertext
        );
        console.log('Legacy key decryption succeeded (PBKDF2 fallback).');
        return decoder.decode(decrypted);
      } catch (e2) {
        console.error('Failed to decrypt user API key with both methods:', e2);
        return null;
      }
    }
  } catch (error) {
    console.error('Error retrieving user API key:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting image prompt generation...');

    // JWT トークンから認証情報を取得
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    const { postContent } = await req.json()

    if (!postContent) {
      return new Response(
        JSON.stringify({ error: 'Post content is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // ユーザーのGemini APIキーを取得（個人APIキー必須）
    const userGeminiApiKey = await getUserApiKey(user.id, 'GEMINI_API_KEY');

    if (!userGeminiApiKey) {
      throw new Error('GEMINI_API_KEY_REQUIRED: Gemini API key is not configured. Please set your API key in Settings.');
    }

    const geminiApiKey = userGeminiApiKey;

    console.log('Generating image prompt for post using user API key:', postContent)

    const prompt = `【命令】

次の Twitter 投稿内容を分析し、投稿者本人がスマホのフロントカメラで自撮りした写真をBRAv7で生成するための**英語プロンプト**を出力せよ。

投稿内容：
"${postContent}"

【出力仕様】
Positive prompt
カンマ区切り・改行以外の余計な文字は不要
Compelを使用するためトークン数は気にしなくてよい

【Positiveの雛形】
Cinematic photo, (best quality:1.1), ultra-realistic, photorealistic of [DESCRIPTORS], natural skin texture, bokeh, standing, front view, full body shot, Canon EOS R5, 85 mm, f/1.4, ISO 200, 1/160 s, RAW

【[DESCRIPTORS] 生成ルール】
- 先頭に**selfie**を必ず置く
- 人物属性 → 行動／小物 → 場所 → 時間帯 → 照明 → ポーズ → カメラ語句
- 例）
  selfie, young app developer, checking analytics on laptop, rooftop cafe in Shibuya, golden hour glow, relaxed smile, smartphone front camera ƒ/1.8

回答は生成プロンプトのみ出力してください。`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}. Response: ${errorText}`)
    }

    const data = await response.json()
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('No content generated by Gemini API')
    }

    const generatedPrompt = data.candidates[0].content.parts[0].text.trim()
    
    console.log('Generated prompt:', generatedPrompt)

    return new Response(
      JSON.stringify({ 
        success: true,
        imagePrompt: generatedPrompt
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error generating image prompt:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate image prompt',
        details: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
