import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const threadsAccessToken = Deno.env.get('THREADS_ACCESS_TOKEN');
const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Threads auto-reply process...');

    if (!threadsAccessToken) {
      throw new Error('THREADS_ACCESS_TOKEN is not configured');
    }

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const { message, userId, trigger_keywords } = await req.json();

    if (!message || !userId) {
      throw new Error('Missing required fields: message, userId');
    }

    console.log(`Processing auto-reply for user ${userId}`);
    console.log(`Message content: ${message.substring(0, 100)}...`);

    // Get active auto-reply rules for the user
    const { data: autoReplies, error: repliesError } = await supabase
      .from('auto_replies')
      .select(`
        *,
        personas (*)
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (repliesError) {
      throw repliesError;
    }

    if (!autoReplies || autoReplies.length === 0) {
      console.log('No active auto-reply rules found');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No active auto-reply rules found'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    console.log(`Found ${autoReplies.length} active auto-reply rules`);

    // Check if message matches any trigger keywords
    let matchedRule = null;
    const messageText = message.toLowerCase();

    for (const rule of autoReplies) {
      if (rule.trigger_keywords) {
        const hasMatch = rule.trigger_keywords.some(keyword => 
          messageText.includes(keyword.toLowerCase())
        );
        
        if (hasMatch) {
          matchedRule = rule;
          console.log(`Matched rule with keywords: ${rule.trigger_keywords.join(', ')}`);
          break;
        }
      }
    }

    if (!matchedRule) {
      console.log('No matching trigger keywords found');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No matching trigger keywords found'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Generate personalized reply using Gemini
    const persona = matchedRule.personas;
    const prompt = `
あなたは${persona.name}として返信を作成してください。

ペルソナ情報:
- 名前: ${persona.name}
- 年齢: ${persona.age || '不明'}
- 性格: ${persona.personality || ''}
- 専門分野: ${persona.expertise?.join(', ') || ''}
- 口調: ${persona.tone_of_voice || ''}

返信テンプレート: ${matchedRule.response_template}

受信メッセージ: ${message}

要件:
1. ${persona.name}のキャラクターに沿った返信
2. 自然で親しみやすい文章
3. 簡潔で200文字以内
4. テンプレートを参考にしつつ、受信メッセージに合わせてカスタマイズ

返信内容のみを返してください:`;

    console.log('Generating personalized reply with Gemini...');

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
          temperature: 0.7,
          topK: 1,
          topP: 1,
          maxOutputTokens: 1024,
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

    const replyContent = data.candidates[0].content.parts[0].text;
    console.log(`Generated reply: ${replyContent.substring(0, 100)}...`);

    // Here you would typically post the reply to Threads
    // For now, we'll just log it and return success
    console.log(`Auto-reply generated successfully: ${replyContent}`);

    // In a real implementation, you would:
    // 1. Create a Threads container with the reply
    // 2. Publish the reply as a response to the original message
    // This requires additional Threads API endpoints for replies

    return new Response(
      JSON.stringify({ 
        success: true,
        generated_reply: replyContent,
        persona_used: persona.name,
        matched_keywords: matchedRule.trigger_keywords,
        message: 'Auto-reply generated successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in threads-auto-reply function:', error);
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