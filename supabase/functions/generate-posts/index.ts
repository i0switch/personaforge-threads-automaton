import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const { 
      personaId, 
      topics, 
      postCount, 
      startTime, 
      endTime, 
      interval,
      user_id 
    } = await req.json();

    // Get persona details
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .eq('user_id', user_id)
      .single();

    if (personaError || !persona) {
      throw new Error('Persona not found');
    }

    // Generate time slots
    const timeSlots = generateTimeSlots(startTime, endTime, interval, postCount);

    // Generate posts using OpenAI
    const posts = [];
    
    for (let i = 0; i < postCount; i++) {
      const prompt = createPostPrompt(persona, topics, i + 1, postCount);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `あなたは「${persona.name}」というペルソナでソーシャルメディアの投稿を作成するAIです。

ペルソナの特徴:
- 名前: ${persona.name}
- 年齢: ${persona.age || '不明'}
- 性格: ${persona.personality || ''}
- 話し方: ${persona.tone_of_voice || ''}
- 専門分野: ${persona.expertise?.join(', ') || ''}

投稿の要件:
- SNS投稿として自然で魅力的な内容
- ペルソナの特徴を反映した話し方
- 絵文字を適度に使用
- ハッシュタグを3-5個含める
- 280文字以内で簡潔に`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8,
          max_tokens: 500,
        }),
      });

      const data = await response.json();
      const generatedContent = data.choices[0].message.content;
      
      // Parse content and hashtags
      const lines = generatedContent.split('\n').filter(line => line.trim());
      const content = lines.find(line => !line.startsWith('#') && !line.includes('#'))?.trim() || generatedContent;
      const hashtags = extractHashtags(generatedContent);

      posts.push({
        content,
        hashtags,
        scheduled_for: timeSlots[i],
        persona_id: personaId,
        user_id: user_id,
        status: 'draft'
      });

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return new Response(JSON.stringify({ posts }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-posts function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

function createPostPrompt(persona: any, topics: string[], postNumber: number, totalPosts: number): string {
  const topicsText = topics.join('、');
  
  return `以下のトピックに関連する魅力的なSNS投稿を作成してください: ${topicsText}

投稿 ${postNumber}/${totalPosts}

要件:
- ペルソナ「${persona.name}」の特徴を活かした内容
- ${topicsText}のいずれかに関連
- 自然で親しみやすい文体
- 適切な絵文字の使用
- 関連するハッシュタグを3-5個含める
- 280文字以内

フォーマット:
[投稿本文]
#ハッシュタグ1 #ハッシュタグ2 #ハッシュタグ3`;
}

function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[^\s#]+/g;
  const matches = text.match(hashtagRegex);
  return matches ? matches.slice(0, 5) : [];
}