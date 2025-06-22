
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postContent, replyContent, persona } = await req.json();

    console.log('Generating auto-reply with data:', {
      postContent: postContent?.substring(0, 100) + '...',
      replyContent: replyContent?.substring(0, 100) + '...',
      persona: persona?.name
    });

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const prompt = `
あなたは以下のペルソナとして返信を生成してください：

ペルソナ情報：
- 名前: ${persona?.name || 'Unknown'}
- 職業: ${persona?.occupation || 'Unknown'}
- 性格: ${persona?.personality || 'Unknown'}
- 話し方: ${persona?.tone || 'Unknown'}
- 背景: ${persona?.background || 'Unknown'}

元の投稿:
${postContent}

受信したリプライ:
${replyContent}

このリプライに対して、上記のペルソナの特徴を活かした自然で適切な返信文を生成してください。
返信は簡潔で親しみやすく、相手との会話を続けやすい内容にしてください。
絵文字は適度に使用し、ペルソナの性格に合った口調で書いてください。

返信文のみを出力してください（説明文は不要）。
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`, {
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
