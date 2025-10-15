import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    if (error || !data) return null;

    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) return null;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const encryptedData = Uint8Array.from(atob(data.encrypted_key), c => c.charCodeAt(0));
    const iv = encryptedData.slice(0, 12);
    const ciphertext = encryptedData.slice(12);

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
        return decoder.decode(decrypted);
      } catch (e2) {
        console.error('Failed to decrypt user API key:', e2);
        return null;
      }
    }
  } catch (e) {
    console.error('Failed to get user API key:', e);
    return null;
  }
}

async function getAllGeminiApiKeys(userId: string): Promise<string[]> {
  const apiKeys: string[] = [];
  
  for (let i = 1; i <= 10; i++) {
    const keyName = i === 1 ? 'GEMINI_API_KEY' : `GEMINI_API_KEY_${i}`;
    const apiKey = await getUserApiKey(userId, keyName);
    if (apiKey) {
      apiKeys.push(apiKey);
    }
  }
  
  return apiKeys;
}

async function generateWithGeminiRotation(prompt: string, userId: string): Promise<string> {
  const apiKeys = await getAllGeminiApiKeys(userId);
  
  if (apiKeys.length === 0) {
    throw new Error('Gemini API key is not configured. Please set your API key in Settings.');
  }
  
  let lastError: Error | null = null;
  
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    console.log(`Trying Gemini API key ${i + 1}/${apiKeys.length}`);
    
    try {
      const result = await generateWithGemini(prompt, apiKey);
      console.log(`Successfully generated content with API key ${i + 1}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`API key ${i + 1} failed:`, errorMessage);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (errorMessage.includes('429') || 
          errorMessage.includes('quota') || 
          errorMessage.includes('RESOURCE_EXHAUSTED') ||
          errorMessage.includes('Rate limit')) {
        console.log(`Rate limit/quota error detected, trying next API key...`);
        continue;
      } else {
        throw error;
      }
    }
  }
  
  throw lastError || new Error('All Gemini API keys failed');
}

async function generateWithGemini(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error('Gemini API key is not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${txt}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini returned empty content');
  return text.trim();
}

function buildPrompt(persona: any, customPrompt?: string, contentPrefs?: string) {
  const personaInfo = [
    `ペルソナ名: ${persona?.name || '未設定'}`,
    persona?.tone_of_voice ? `口調: ${persona.tone_of_voice}` : undefined,
    persona?.expertise?.length ? `専門領域: ${persona.expertise.join(', ')}` : undefined,
    persona?.personality ? `性格: ${persona.personality}` : undefined,
  ].filter(Boolean).join('\n');

  return `あなたは指定されたペルソナになりきってThreads用の短文投稿を1件だけ出力します。\n` +
         `出力はテキスト本文のみ。絵文字やハッシュタグの使用は内容に応じて自然に。\n` +
         `--- ペルソナ情報 ---\n${personaInfo}\n` +
         (contentPrefs ? `--- 投稿方針 ---\n${contentPrefs}\n` : '') +
         (customPrompt ? `--- カスタムプロンプト ---\n${customPrompt}\n` : '') +
         `--- 出力ルール ---\n- 280文字程度以内\n- 攻撃的・不適切表現は禁止\n- 改行2回以内\n- 出力はテキスト本文のみ`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    const { personaId, customPrompt, contentPrefs } = await req.json();

    if (!personaId) {
      throw new Error('personaId is required');
    }

    console.log(`Test generating post for persona ${personaId}`);

    // Get persona details
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .eq('user_id', user.id)
      .single();

    if (personaError || !persona) {
      throw new Error('Persona not found or access denied');
    }

    console.log(`Using persona: ${persona.name}`);

    // Build prompt
    const prompt = buildPrompt(persona, customPrompt, contentPrefs);
    
    // Generate content
    const generatedContent = await generateWithGeminiRotation(prompt, user.id);

    console.log(`Successfully generated test post`);

    return new Response(
      JSON.stringify({ 
        success: true,
        content: generatedContent
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in test-auto-post-generate function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});
