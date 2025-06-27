
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const fallbackGeminiApiKey = Deno.env.get('GEMINI_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getUserApiKey(userId: string, keyName: string): Promise<string | null> {
  try {
    console.log(`Retrieving API key for user ${userId} with key name ${keyName}`);
    
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', userId)
      .eq('key_name', keyName)
      .single();

    if (error || !data) {
      console.log('No user API key found:', error?.message);
      return null;
    }

    console.log('Found encrypted API key, attempting decryption...');

    // 復号化処理
    const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');
    if (!ENCRYPTION_KEY) {
      console.error('ENCRYPTION_KEY not found in environment');
      return null;
    }
    
    try {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      // Base64デコード
      const encryptedData = Uint8Array.from(atob(data.encrypted_key), c => c.charCodeAt(0));
      
      // IVと暗号化されたデータを分離
      const iv = encryptedData.slice(0, 12);
      const ciphertext = encryptedData.slice(12);

      // 暗号化キーをCryptoKeyに変換
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
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
      console.log('API key decryption successful');
      return decryptedKey;
    } catch (decryptError) {
      console.error('Decryption failed:', decryptError);
      return null;
    }
  } catch (error) {
    console.error('Error retrieving user API key:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    let userId = null;
    
    // 認証トークンがある場合はユーザーIDを取得
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (!authError && user) {
          userId = user.id;
          console.log(`User authenticated: ${userId}`);
        }
      } catch (authError) {
        console.log('Auth token invalid, using fallback API key');
      }
    }

    const { postContent, replyContent, persona } = await req.json();

    console.log('Generating auto-reply with data:', {
      postContent: postContent?.substring(0, 100) + '...',
      replyContent: replyContent?.substring(0, 100) + '...',
      persona: persona?.name,
      userId: userId
    });

    // ユーザーのGemini APIキーを取得
    let geminiApiKey = fallbackGeminiApiKey;
    
    if (userId) {
      const userGeminiApiKey = await getUserApiKey(userId, 'GEMINI_API_KEY');
      if (userGeminiApiKey) {
        geminiApiKey = userGeminiApiKey;
        console.log('Using user-specific Gemini API key');
      } else {
        console.log('Using fallback Gemini API key');
      }
    } else {
      console.log('No user authentication, using fallback Gemini API key');
    }

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const prompt = [
      'あなたは、ソーシャルメディア「Threads」で活躍する、経験豊富なコミュニティマネージャーです。',
      'あなたのゴールは、受信したリプライに対して、あなたのペルソナに沿った、人間らしく、魅力的で、気の利いた返信を生成し、会話を促進することです。',
      '',
      '## あなたのペルソナ情報',
      `- **名前**: ${persona?.name || 'Unknown'}`,
      `- **職業**: ${persona?.occupation || 'Unknown'}`,
      `- **性格**: ${persona?.personality || 'Unknown'}`,
      `- **話し方**: ${persona?.tone_of_voice || 'Unknown'}`,
      `- **背景**: ${persona?.background || 'Unknown'}`,
      '',
      '## 返信タスクの背景',
      '以下の「元の投稿」に対して、あるユーザーから「受信リプライ」が届きました。',
      `* **元の投稿**: ${postContent || '(本文なし)'}`,
      `* **受信リプライ**: ${replyContent}`,
      '---',
      '',
      '## あなたへの指示',
      '上記の「受信リプライ」に対して、以下の「厳格なルール」をすべて守り、最も適切で自然な返信を生成してください。',
      '',
      '### 厳格なルール',
      '- **思考プロセス**: まず受信リプライの意図（質問、感想、共感など）を分析し、次にあなたのペルソナならどう応答するかを考え、それから返信文を作成してください。',
      '- **ペルソナの一貫性**: 必ず上記「あなたのペルソナ情報」に記載された口調、スタイル、過去のサンプル投稿のトーンを忠実に守ってください。',
      '- **自然な会話**: 機械的な応答は絶対に避けてください。人間同士の自然な会話の流れを意識してください。',
      '- **簡潔さ**: 返信は簡潔に、最大でも280文字程度に収めてください。',
      '- **絵文字**: ペルソナのスタイルに合致する場合のみ、控えめに使用してください。',
      '- **禁止事項**: 署名や挨拶（「こんにちは」など）で始めないでください。ハッシュタグは使用しないでください。質問に質問で返すことは避けてください。',
      '- **出力形式**: 生成する返信文のみを出力してください。思考プロセスや言い訳、前置きは一切含めないでください。'
    ].join('\n');

    // Updated model name from gemini-pro to gemini-1.5-flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
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
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API error:', error);
      throw new Error(`Gemini API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    console.log('Gemini API response:', data);

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response from Gemini API');
    }

    const generatedReply = data.candidates[0].content.parts[0].text.trim();

    return new Response(
      JSON.stringify({
        success: true,
        reply: generatedReply,
        message: 'Auto-reply generated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in generate-auto-reply function:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate auto-reply',
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
