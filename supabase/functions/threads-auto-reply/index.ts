
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting auto reply process...');

    const { postContent, replyContent, personaId, userId } = await req.json();

    if (!postContent || !replyContent || !personaId || !userId) {
      throw new Error('Missing required fields');
    }

    // Get persona information
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .eq('user_id', userId)
      .single();

    if (personaError || !persona) {
      throw new Error('Persona not found');
    }

    if (!persona.threads_access_token) {
      throw new Error('Threads access token not configured for this persona');
    }

    // Generate AI reply using Gemini - Updated model name
    const prompt = `
あなたは${persona.name}として振る舞ってください。

ペルソナ情報:
- 名前: ${persona.name}
- 年齢: ${persona.age || '不明'}
- 性格: ${persona.personality || ''}
- 専門分野: ${persona.expertise?.join(', ') || ''}
- 話し方: ${persona.tone_of_voice || ''}

元の投稿:
${postContent}

返信内容:
${replyContent}

上記の返信に対して、あなたのペルソナとして自然で適切な返信を生成してください。
150文字以内で、親しみやすく自然な返信をお願いします。
`;

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
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
      }),
    });

    if (!geminiResponse.ok) {
      throw new Error('Failed to generate AI reply');
    }

    const geminiData = await geminiResponse.json();
    const generatedReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedReply) {
      throw new Error('No reply generated');
    }

    console.log('Generated reply:', generatedReply);

    // Post the reply to Threads
    const createContainerResponse = await fetch('https://graph.threads.net/v1.0/me/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: generatedReply,
        access_token: persona.threads_access_token
      }),
    });

    if (!createContainerResponse.ok) {
      const errorText = await createContainerResponse.text();
      console.error('Threads create container error:', errorText);
      throw new Error(`Failed to create Threads container: ${createContainerResponse.status}`);
    }

    const containerData = await createContainerResponse.json();
    console.log('Container created:', containerData);

    if (!containerData.id) {
      throw new Error('No container ID returned from Threads API');
    }

    // Wait and publish
    await new Promise(resolve => setTimeout(resolve, 2000));

    const publishResponse = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: persona.threads_access_token
      }),
    });

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      console.error('Threads publish error:', errorText);
      throw new Error(`Failed to publish to Threads: ${publishResponse.status}`);
    }

    const publishData = await publishResponse.json();
    console.log('Reply published:', publishData);

    // Log activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        persona_id: personaId,
        action_type: 'auto_reply_sent',
        description: 'AI自動返信を送信しました',
        metadata: {
          original_post: postContent,
          reply_to: replyContent,
          generated_reply: generatedReply,
          threads_id: publishData.id
        }
      });

    console.log('Auto reply completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        reply: generatedReply,
        threads_id: publishData.id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in auto reply function:', error);
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
