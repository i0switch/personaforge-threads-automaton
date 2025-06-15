import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const fallbackGeminiApiKey = Deno.env.get('GEMINI_API_KEY'); // フォールバック用

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

    // 復号化処理
    const ENCRYPTION_KEY = 'AIThreadsSecretKey2024ForAPIEncryption';
    
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(ENCRYPTION_KEY),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: enc.encode('salt'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    const combined = Uint8Array.from(atob(data.encrypted_key), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (error) {
    console.error('Error retrieving user API key:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting post generation...');

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

    const { 
      personaId, 
      topics, 
      postCount, 
      startTime, 
      endTime, 
      interval,
      customPrompt
    } = await req.json();

    if (!personaId || !topics) {
      throw new Error('Missing required fields: personaId, topics');
    }

    // ユーザーのGemini APIキーを取得
    const userGeminiApiKey = await getUserApiKey(user.id, 'GEMINI_API_KEY');
    const geminiApiKey = userGeminiApiKey || fallbackGeminiApiKey;

    if (!geminiApiKey) {
      throw new Error('Gemini API key is not configured. Please set your API key in Settings.');
    }

    console.log(`Generating ${postCount} posts for persona ${personaId} using ${userGeminiApiKey ? 'user' : 'fallback'} API key`);

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

    // Generate time slots
    const timeSlots = generateTimeSlots(startTime, endTime, interval, postCount);

    const posts = [];

    for (let i = 0; i < postCount; i++) {
      console.log(`Generating post ${i + 1}/${postCount}`);

      // Create prompt for Gemini
      const prompt = createPostPrompt(persona, topics, i + 1, postCount, customPrompt);

      try {
        // Call Gemini API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.9,
              topK: 1,
              topP: 1,
              maxOutputTokens: 2048,
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              }
            ]
          }),
        });

        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
          throw new Error('Invalid response from Gemini API');
        }

        const generatedContent = data.candidates[0].content.parts[0].text;

        // Use generated content as is, without hashtag extraction
        const content = generatedContent.trim();
        const hashtags: string[] = [];

        // Save post to database
        const { data: savedPost, error: saveError } = await supabase
          .from('posts')
          .insert([{
            content,
            hashtags,
            scheduled_for: timeSlots[i],
            persona_id: personaId,
            user_id: user.id,
            status: 'scheduled',
            platform: 'threads'
          }])
          .select()
          .single();

        if (saveError) {
          console.error('Error saving post:', saveError);
          throw saveError;
        }

        console.log(`Post ${i + 1} saved with ID: ${savedPost.id}`);
        posts.push(savedPost);

      } catch (error) {
        console.error(`Error generating post ${i + 1}:`, error);
        // Continue with next post instead of failing completely
        continue;
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`Successfully generated ${posts.length} posts`);

    return new Response(
      JSON.stringify({ 
        posts,
        success: true,
        generated_count: posts.length,
        requested_count: postCount
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in generate-posts function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});

function generateTimeSlots(startTime: string, endTime: string, interval: number, count: number): string[] {
  const slots = [];
  const start = new Date(`2024-01-01T${startTime}:00`);
  const end = new Date(`2024-01-01T${endTime}:00`);
  
  let current = new Date(start);
  const intervalMs = interval * 60 * 60 * 1000; // Convert hours to milliseconds
  
  for (let i = 0; i < count; i++) {
    if (current <= end) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(current.getHours(), current.getMinutes(), 0, 0);
      
      slots.push(tomorrow.toISOString());
      current = new Date(current.getTime() + intervalMs);
    } else {
      // If we exceed end time, wrap to next day
      const nextDay = new Date(start);
      nextDay.setDate(nextDay.getDate() + Math.floor(i * interval / 24) + 1);
      slots.push(nextDay.toISOString());
    }
  }
  
  return slots;
}

function createPostPrompt(persona: any, topics: string[], postNumber: number, totalPosts: number, customPrompt?: string): string {
  const topicsText = topics.join('、');
  
  // カスタムプロンプトが提供されている場合はそれを使用
  if (customPrompt && customPrompt.trim()) {
    return `あなたは${persona.name}として投稿を作成してください。

ペルソナ情報:
- 名前: ${persona.name}
- 年齢: ${persona.age || '不明'}
- 性格: ${persona.personality || ''}
- 専門分野: ${persona.expertise?.join(', ') || ''}
- 口調: ${persona.tone_of_voice || ''}

投稿番号: ${postNumber}/${totalPosts}

カスタム指示: ${customPrompt}

${persona.name}のキャラクターに沿って、上記の指示に従って投稿内容のみを返してください:`;
  }
  
  // デフォルトプロンプト（ハッシュタグ指示を削除）
  return `あなたは${persona.name}として投稿を作成してください。

ペルソナ情報:
- 名前: ${persona.name}
- 年齢: ${persona.age || '不明'}
- 性格: ${persona.personality || ''}
- 専門分野: ${persona.expertise?.join(', ') || ''}
- 口調: ${persona.tone_of_voice || ''}

投稿テーマ: ${topicsText}
投稿番号: ${postNumber}/${totalPosts}

要件:
1. ${persona.name}のキャラクターに沿った内容
2. Threadsに適した長さ（500文字以内）
3. 自然で魅力的な文章
4. エンゲージメントを促す内容
5. ${topicsText}のいずれかに関連した内容

投稿内容のみを返してください:`;
}

function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[^\s#]+/g;
  const matches = text.match(hashtagRegex);
  return matches ? matches.slice(0, 5) : [];
}