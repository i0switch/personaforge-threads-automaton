import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { postContent, replyContent, persona } = await req.json();

    if (!postContent || !replyContent || !persona) {
      throw new Error('Missing required fields: postContent, replyContent, persona');
    }

    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('暗号化キーが設定されていません');
    }

    // Get authorization header to identify the user
    const authHeader = req.headers.get('Authorization');

    // Get all Gemini API keys for the user
    async function getUserApiKey(userId: string, keyName: string): Promise<string | null> {
      try {
        const { data: userApiKey, error: keyError } = await supabase
          .from('user_api_keys')
          .select('encrypted_key')
          .eq('user_id', userId)
          .eq('key_name', keyName)
          .single();

        if (keyError || !userApiKey?.encrypted_key) {
          return null;
        }

        console.log('Found user personal Gemini API key, decrypting...');
        
        // Decrypt the user's API key
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        
        // Base64デコード
        const encryptedData = Uint8Array.from(atob(userApiKey.encrypted_key), c => c.charCodeAt(0));
        
        // IVと暗号化されたデータを分離
        const iv = encryptedData.slice(0, 12);
        const ciphertext = encryptedData.slice(12);

        // Try current AES-GCM (raw key padded to 32 bytes)
        try {
          const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
            { name: 'AES-GCM' },
            false,
            ['decrypt']
          );

          const decryptedData = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            keyMaterial,
            ciphertext
          );

          return decoder.decode(decryptedData);
        } catch (_e) {
          // Fallback: legacy PBKDF2-derived AES-GCM
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
            const decryptedData = await crypto.subtle.decrypt(
              { name: 'AES-GCM', iv },
              derivedKey,
              ciphertext
            );
            console.log('Legacy key decryption succeeded (PBKDF2 fallback).');
            return decoder.decode(decryptedData);
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

    async function getAllGeminiApiKeys(userId: string): Promise<string[]> {
      const apiKeys: string[] = [];
      
      // Try all possible Gemini API keys (1-10)
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
        throw new Error('No Gemini API keys configured');
      }
      
      let lastError: Error | null = null;
      
      for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        console.log(`Trying Gemini API key ${i + 1}/${apiKeys.length}`);
        
        try {
          // Updated model name from gemini-pro to gemini-1.5-flash
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: prompt
                }]
              }]
            })
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

          const generatedReply = data.candidates[0].content.parts[0].text;
          console.log(`Successfully generated content with API key ${i + 1}`);
          return generatedReply;
        } catch (error) {
          console.log(`API key ${i + 1} failed:`, error.message);
          lastError = error;
          
          // Check if it's a quota/rate limit error that should trigger rotation
          if (error.message.includes('429') || 
              error.message.includes('quota') || 
              error.message.includes('RESOURCE_EXHAUSTED') ||
              error.message.includes('Rate limit')) {
            console.log(`Rate limit/quota error detected, trying next API key...`);
            continue;
          } else {
            // For other errors, don't continue trying other keys
            throw error;
          }
        }
      }
      
      // If all keys failed, throw the last error
      throw lastError || new Error('All Gemini API keys failed');
    }

    if (!authHeader || !persona?.user_id) {
      throw new Error('認証情報またはペルソナ情報が不足しています');
    }

    const prompt = [
      `あなたは以下のペルソナになりきって、投稿に対する返信を生成してください：`,
      ``,
      `【ペルソナ情報】`,
      `名前: ${persona.name}`,
      `年齢: ${persona.age || '未設定'}`,
      `性格: ${persona.personality || '未設定'}`,
      `専門分野: ${persona.expertise?.join(', ') || '未設定'}`,
      `口調: ${persona.tone_of_voice || '未設定'}`,
      ``,
      `【元の投稿】`,
      postContent,
      ``,
      `【返信内容】`,
      replyContent,
      ``,
      `【指示】`,
      `- 上記のペルソナの特徴を活かした自然な返信を生成してください`,
      `- 返信内容に対して適切にレスポンスしてください`,
      `- 280文字以内で収めてください`,
      `- 攻撃的や不適切な表現は避けてください`,
      `- ペルソナらしい口調と個性を反映してください`,
      ``,
      `返信:`,
    ].join('\n');

    const generatedReply = await generateWithGeminiRotation(prompt, persona.user_id);

    return new Response(
      JSON.stringify({ success: true, reply: generatedReply }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in generate-auto-reply:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to generate auto reply' 
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