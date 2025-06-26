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
      console.log(`No user API key found for ${keyName}, will use fallback`);
      return null;
    }

    // 復号化処理 - より安全なエラーハンドリング
    try {
      const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || 'AIThreadsSecretKey2024ForAPIEncryption';
      
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
      const decryptedKey = dec.decode(decrypted);
      console.log('Successfully decrypted user API key');
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

// レート制限対応のためのリトライ機能
async function callGeminiWithRetry(apiKey: string, prompt: string, maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Gemini API call attempt ${attempt}/${maxRetries}`);
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
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

      if (response.status === 429) {
        // レート制限の場合は待機時間を増やしてリトライ
        const waitTime = Math.pow(2, attempt) * 1000; // 指数バックオフ
        console.log(`Rate limited, waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Gemini API call successful');
      return data;

    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // 最後の試行でない場合は少し待ってリトライ
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
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
      selectedDates, 
      selectedTimes,
      customPrompt
    } = await req.json();

    if (!personaId || !topics || !selectedDates || !selectedTimes) {
      throw new Error('Missing required fields: personaId, topics, selectedDates, selectedTimes');
    }

    // ユーザーのGemini APIキーを取得
    const userGeminiApiKey = await getUserApiKey(user.id, 'GEMINI_API_KEY');
    const geminiApiKey = userGeminiApiKey || fallbackGeminiApiKey;

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Gemini API key is not configured. Please set your API key in Settings.',
          success: false,
          needsApiKey: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      );
    }

    // Calculate total posts to generate
    const postCount = selectedDates.length * selectedTimes.length;
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

    // Generate time slots from selected dates and times
    const timeSlots = generateTimeSlots(selectedDates, selectedTimes);

    const posts = [];
    const failedPosts = [];

    for (let i = 0; i < timeSlots.length; i++) {
      console.log(`Generating post ${i + 1}/${timeSlots.length}`);

      // Create prompt for Gemini with variety
      const prompt = createPostPrompt(persona, topics, i + 1, timeSlots.length, customPrompt, timeSlots[i]);

      try {
        // Call Gemini API with retry logic
        const data = await callGeminiWithRetry(geminiApiKey, prompt);

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
          failedPosts.push({ index: i + 1, error: saveError.message });
          continue;
        }

        console.log(`Post ${i + 1} saved with ID: ${savedPost.id}`);
        posts.push(savedPost);

      } catch (error) {
        console.error(`Error generating post ${i + 1}:`, error);
        failedPosts.push({ index: i + 1, error: error.message });
        continue;
      }

      // Add delay to avoid rate limiting - longer delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒の間隔
    }

    console.log(`Successfully generated ${posts.length} posts`);
    
    if (failedPosts.length > 0) {
      console.log(`Failed to generate ${failedPosts.length} posts:`, failedPosts);
    }

    return new Response(
      JSON.stringify({ 
        posts,
        success: true,
        generated_count: posts.length,
        requested_count: timeSlots.length,
        failed_count: failedPosts.length,
        failures: failedPosts
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

function generateTimeSlots(selectedDates: string[], selectedTimes: string[]): string[] {
  const slots = [];
  
  for (const dateStr of selectedDates) {
    const date = new Date(dateStr);
    
    for (const timeStr of selectedTimes) {
      const [hour, minute] = timeStr.split(':').map(Number);
      const scheduledDate = new Date(date);
      scheduledDate.setHours(hour, minute, 0, 0);
      
      slots.push(scheduledDate.toISOString());
    }
  }
  
  return slots;
}

function createPostPrompt(persona: any, topics: string[], postNumber: number, totalPosts: number, customPrompt?: string, scheduledTime?: string): string {
  const topicsText = topics.join('、');
  
  // 投稿日時から時間帯を判定
  const timeOfDay = getTimeOfDay(scheduledTime);
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  
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
投稿時間帯: ${timeOfDay}
メインテーマ: ${randomTopic}

カスタム指示: ${customPrompt}

注意事項:
- 投稿内容に番号（1/2、2/2など）を含めないでください
- 投稿内容のみを返してください
- １００文字程度の長さにしてください
- 他の投稿とは異なる視点やアプローチで書いてください
- 時間帯に適した内容にしてください

${persona.name}のキャラクターに沿って、上記の指示に従って投稿内容のみを返してください:`;
  }
  
  // バリエーション豊かなプロンプト
  const variations = [
    `個人的な体験や気づきを交えて`,
    `質問やアドバイスの形で`,
    `具体的な例やエピソードを使って`,
    `読者に行動を促すような内容で`,
    `トレンドや最新情報を含めて`,
    `感情や気持ちを込めて`,
    `実用的なヒントやコツとして`,
    `失敗談や学びを含めて`
  ];
  
  const selectedVariation = variations[postNumber % variations.length];
  
  return `あなたは${persona.name}として投稿を作成してください。

ペルソナ情報:
- 名前: ${persona.name}
- 年齢: ${persona.age || '不明'}
- 性格: ${persona.personality || ''}
- 専門分野: ${persona.expertise?.join(', ') || ''}
- 口調: ${persona.tone_of_voice || ''}

投稿設定:
- 投稿番号: ${postNumber}/${totalPosts}
- 投稿時間帯: ${timeOfDay}
- メインテーマ: ${randomTopic}
- 投稿スタイル: ${selectedVariation}

要件:
1. ${persona.name}のキャラクターに沿った内容
2. １００文字程度の長さにする
3. 自然で魅力的な文章
4. エンゲージメントを促す内容
5. 「${randomTopic}」をメインテーマにする
6. ${selectedVariation}書く
7. ${timeOfDay}に適した内容にする
8. 他の投稿とは異なる独自の視点を持つ

注意事項:
- 投稿内容に番号（1/2、2/2など）を含めないでください
- 投稿内容のみを返してください
- １００文字程度の長さにしてください
- 同じような表現や構成を避け、バリエーション豊かにしてください

投稿内容のみを返してください:`;
}

function getTimeOfDay(scheduledTime?: string): string {
  if (!scheduledTime) return '一日中';
  
  const date = new Date(scheduledTime);
  const hour = date.getHours();
  
  if (hour >= 5 && hour < 12) return '朝';
  if (hour >= 12 && hour < 17) return '昼';
  if (hour >= 17 && hour < 21) return '夕方';
  return '夜';
}

function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[^\s#]+/g;
  const matches = text.match(hashtagRegex);
  return matches ? matches.slice(0, 5) : [];
}
