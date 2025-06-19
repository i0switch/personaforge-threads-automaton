import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Threads auto-reply process...');

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const { message, userId, trigger_keywords, originalPost } = await req.json();

    if (!message || !userId) {
      throw new Error('Missing required fields: message, userId');
    }

    console.log(`Processing auto-reply for user ${userId}`);
    console.log(`Message content: ${message.substring(0, 100)}...`);
    if (originalPost) {
      console.log(`Original post content: ${originalPost.substring(0, 100)}...`);
    }

    // Get active auto-reply rules for the user with persona info including threads access token
    const { data: autoReplies, error: repliesError } = await supabase
      .from('auto_replies')
      .select(`
        *,
        personas (*, threads_access_token)
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

    // Enhanced logic: Check for keyword match OR context-aware rules
    let matchedRule = null;
    const messageText = message.toLowerCase();

    // First, try to find keyword-based rules
    for (const rule of autoReplies) {
      if (rule.trigger_keywords && rule.trigger_keywords.length > 0) {
        const hasMatch = rule.trigger_keywords.some(keyword => 
          messageText.includes(keyword.toLowerCase())
        );
        
        if (hasMatch) {
          matchedRule = rule;
          console.log(`Matched keyword-based rule: ${rule.trigger_keywords.join(', ')}`);
          break;
        }
      }
    }

    // If no keyword match, check for context-aware rules (rules with empty or no keywords)
    if (!matchedRule) {
      const contextAwareRule = autoReplies.find(rule => 
        !rule.trigger_keywords || rule.trigger_keywords.length === 0
      );
      
      if (contextAwareRule) {
        matchedRule = contextAwareRule;
        console.log('Using context-aware rule for intelligent reply generation');
      }
    }

    if (!matchedRule) {
      console.log('No matching rules found');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No matching auto-reply rules found'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Generate personalized reply using Gemini
    const persona = matchedRule.personas;
    
    // Check if persona has threads access token for posting replies
    const threadsAccessToken = persona.threads_access_token;
    if (!threadsAccessToken) {
      console.log(`No Threads access token configured for persona ${persona.name}`);
      // Continue with reply generation but won't be able to post to Threads
    }
    // Create context-aware prompt that analyzes both original post and reply
    const prompt = `
あなたは${persona.name}として、ポストとそのリプライを分析して最適な返信を作成してください。

ペルソナ情報:
- 名前: ${persona.name}
- 年齢: ${persona.age || '不明'}
- 性格: ${persona.personality || ''}
- 専門分野: ${persona.expertise?.join(', ') || ''}
- 口調: ${persona.tone_of_voice || ''}

${originalPost ? `元のポスト内容: ${originalPost}` : ''}

受信したリプライ: ${message}

返信テンプレート（参考用）: ${matchedRule.response_template}

分析と返信作成の要件:
1. 元のポストの文脈とリプライの内容を両方考慮して返信を作成
2. ${persona.name}のキャラクターと専門性を活かした返信
3. リプライの意図や感情を理解して適切に対応
4. 自然で親しみやすく、かつ価値のある返信
5. 280文字以内で簡潔に
6. 必要に応じて質問を返したり、追加情報を提供
7. ${persona.tone_of_voice}の特徴を反映

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