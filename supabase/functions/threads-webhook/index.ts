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
    console.log('Threads webhook received');

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const webhookData = await req.json();
    console.log('Webhook data:', JSON.stringify(webhookData, null, 2));

    // Threads webhook verification
    const mode = req.url.includes('hub.mode=subscribe');
    if (mode) {
      const challenge = new URL(req.url).searchParams.get('hub.challenge');
      return new Response(challenge, { headers: corsHeaders });
    }

    // Process reply webhook
    if (webhookData.object === 'page' && webhookData.entry) {
      for (const entry of webhookData.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'reply' && change.value) {
              await processReply(change.value);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in threads-webhook function:', error);
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

async function processReply(replyData: any) {
  console.log('Processing reply:', replyData);

  try {
    // Extract reply information
    const { media_id, text, from, parent_media_id } = replyData;
    
    if (!text || !parent_media_id) {
      console.log('Missing required reply data');
      return;
    }

    // Find the original post in our database
    const { data: originalPost, error: postError } = await supabase
      .from('posts')
      .select(`
        *,
        personas (*)
      `)
      .eq('platform', 'threads')
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .single();

    if (postError || !originalPost) {
      console.log('Original post not found in database');
      return;
    }

    const userId = originalPost.user_id;
    
    // Check if user has auto-reply enabled
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('auto_reply_enabled')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile?.auto_reply_enabled) {
      console.log('Auto-reply not enabled for user:', userId);
      return;
    }

    // Get user's active auto-reply rules with persona info
    const { data: autoReplies, error: repliesError } = await supabase
      .from('auto_replies')
      .select(`
        *,
        personas (*, threads_access_token)
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (repliesError || !autoReplies || autoReplies.length === 0) {
      console.log('No active auto-reply rules found');
      return;
    }

    // Use the first available persona with threads access token
    let selectedRule = null;
    for (const rule of autoReplies) {
      if (rule.personas?.threads_access_token) {
        selectedRule = rule;
        break;
      }
    }

    if (!selectedRule) {
      console.log('No persona with Threads access token found');
      return;
    }

    const persona = selectedRule.personas;
    
    // Generate contextual reply using Gemini
    const prompt = `
あなたは${persona.name}として、Threadsでのリプライに返信してください。

ペルソナ情報:
- 名前: ${persona.name}
- 年齢: ${persona.age || '不明'}
- 性格: ${persona.personality || ''}
- 専門分野: ${persona.expertise?.join(', ') || ''}
- 口調: ${persona.tone_of_voice || ''}

元のポスト内容: ${originalPost.content}

受信したリプライ: ${text}

以下の要件で返信を作成してください:
1. ${persona.name}のキャラクターと専門性を活かした返信
2. リプライの内容に適切に対応
3. 自然で親しみやすく、価値のある返信
4. 280文字以内で簡潔に
5. ${persona.tone_of_voice}の特徴を反映
6. 過度にフォーマルにならず、SNSらしい自然な返信

返信内容のみを返してください:`;

    console.log('Generating reply with Gemini...');

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

    // Post reply to Threads using the persona's access token
    await postReplyToThreads(
      media_id, // Reply to the specific comment media ID
      replyContent,
      persona.threads_access_token
    );

    console.log('Auto-reply posted successfully');

  } catch (error) {
    console.error('Error processing reply:', error);
  }
}

async function postReplyToThreads(parentMediaId: string, text: string, accessToken: string) {
  try {
    // First, create a threads container for the reply
    const containerResponse = await fetch(`https://graph.threads.net/v1.0/me/threads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: text,
        reply_to_id: parentMediaId, // This makes it a reply
      }),
    });

    if (!containerResponse.ok) {
      const errorData = await containerResponse.text();
      throw new Error(`Failed to create threads container: ${containerResponse.status} ${errorData}`);
    }

    const containerData = await containerResponse.json();
    const containerId = containerData.id;

    console.log('Threads container created:', containerId);

    // Then publish the container
    const publishResponse = await fetch(`https://graph.threads.net/v1.0/me/threads_publish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerId,
      }),
    });

    if (!publishResponse.ok) {
      const errorData = await publishResponse.text();
      throw new Error(`Failed to publish threads reply: ${publishResponse.status} ${errorData}`);
    }

    const publishData = await publishResponse.json();
    console.log('Threads reply published:', publishData.id);

    return publishData.id;

  } catch (error) {
    console.error('Error posting reply to Threads:', error);
    throw error;
  }
}