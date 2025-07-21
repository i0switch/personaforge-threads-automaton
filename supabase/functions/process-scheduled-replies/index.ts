import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('=== Processing scheduled replies ===');
    const currentTime = new Date();
    console.log('Current time:', currentTime.toISOString());

    // Get scheduled replies that are due
    const { data: scheduledReplies, error: fetchError } = await supabase
      .from('thread_replies')
      .select(`
        *,
        personas!inner(
          id,
          name,
          personality,
          tone_of_voice,
          expertise,
          threads_access_token,
          user_id
        )
      `)
      .eq('reply_status', 'scheduled')
      .lte('scheduled_reply_at', currentTime.toISOString());

    if (fetchError) {
      console.error('Error fetching scheduled replies:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${scheduledReplies?.length || 0} scheduled replies to process`);

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const reply of scheduledReplies || []) {
      processedCount++;
      console.log(`Processing reply ${processedCount}/${scheduledReplies?.length}: ${reply.id}`);

      try {
        // 定型文返信かAI返信かを判定
        const keywordReply = await checkIfKeywordReply(supabase, reply.personas.user_id, reply.reply_text);
        
        if (keywordReply) {
          // 定型文返信の場合
          console.log(`Processing keyword-based reply: "${keywordReply.response_template}"`);
          await sendKeywordReply(reply, keywordReply.response_template);
        } else {
          // AI返信の場合（既存ロジック）
          console.log('Processing AI-based reply');
          await processAIReply(reply, geminiApiKey, encryptionKey, supabase);
        }

        // Update reply status to sent
        const { error: updateError } = await supabase
          .from('thread_replies')
          .update({ 
            reply_status: 'sent',
            auto_reply_sent: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', reply.id);

        if (updateError) {
          console.error('Error updating reply status:', updateError);
        }

        // Log activity
        await supabase
          .from('activity_logs')
          .insert({
            user_id: reply.personas.user_id,
            persona_id: reply.persona_id,
            action_type: keywordReply ? 'keyword_auto_reply_sent' : 'scheduled_auto_reply_sent',
            description: keywordReply 
              ? `定型文返信が送信されました: ${reply.reply_text.substring(0, 50)}...`
              : `スケジュール返信が送信されました: ${reply.reply_text.substring(0, 50)}...`,
            metadata: {
              reply_id: reply.reply_id,
              response_text: keywordReply?.response_template || 'AI Generated',
              scheduled_at: reply.scheduled_reply_at
            }
          });

        successCount++;
        console.log(`Successfully processed reply ${reply.id}`);

      } catch (error) {
        console.error(`Error processing reply ${reply.id}:`, error);
        failedCount++;

        // Update reply status to failed
        await supabase
          .from('thread_replies')
          .update({ 
            reply_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', reply.id);

        // Log error
        await supabase
          .from('activity_logs')
          .insert({
            user_id: reply.personas.user_id,
            persona_id: reply.persona_id,
            action_type: 'scheduled_auto_reply_failed',
            description: `スケジュール返信の送信に失敗しました: ${error.message}`,
            metadata: {
              reply_id: reply.reply_id,
              error: error.message,
              scheduled_at: reply.scheduled_reply_at
            }
          });
      }
    }
  }
}

// 定型文返信かどうかをチェックする関数
async function checkIfKeywordReply(supabase: any, userId: string, replyText: string) {
  const { data: autoReplies } = await supabase
    .from('auto_replies')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!autoReplies) return null;

  const replyTextLower = replyText.toLowerCase();
  
  for (const autoReply of autoReplies) {
    const keywords = autoReply.trigger_keywords || [];
    
    for (const keyword of keywords) {
      if (replyTextLower.includes(keyword.toLowerCase())) {
        console.log(`Keyword "${keyword}" matched in reply: "${replyText}"`);
        return autoReply;
      }
    }
  }
  
  return null;
}

// 定型文返信を送信する関数
async function sendKeywordReply(reply: any, responseTemplate: string) {
  if (reply.personas.threads_access_token) {
    // Create reply container
    const createResponse = await fetch(`https://graph.threads.net/v1.0/me/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: responseTemplate,
        reply_to_id: reply.reply_id,
        access_token: reply.personas.threads_access_token,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create keyword reply container: ${errorText}`);
    }

    const createData = await createResponse.json();
    console.log('Created keyword reply container:', createData.id);

    // Publish the reply
    const publishResponse = await fetch(`https://graph.threads.net/v1.0/${createData.id}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: reply.personas.threads_access_token,
      }),
    });

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      throw new Error(`Failed to publish keyword reply: ${errorText}`);
    }

    console.log('Keyword reply published successfully');
  }
}

// AI返信を処理する関数
async function processAIReply(reply: any, geminiApiKey: string, encryptionKey: string, supabase: any) {
  // Generate AI reply using persona data
  const prompt = `
あなたは以下のペルソナとして振る舞ってください：

ペルソナ情報：
- 名前: ${reply.personas.name}
- 性格: ${reply.personas.personality || '友好的'}
- 口調: ${reply.personas.tone_of_voice || 'カジュアル'}
- 専門分野: ${reply.personas.expertise?.join(', ') || '一般'}

元の投稿：
${reply.original_post_id}

返信された内容：
${reply.reply_text}

上記の返信に対して、このペルソナとして自然で魅力的な返信を生成してください。140文字以内で、ペルソナの性格と口調を反映した内容にしてください。
        `;

  // Get API key (user's key or system key)
  let apiKey = geminiApiKey;
  
  if (!apiKey) {
    const { data: userKeys } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', reply.personas.user_id)
      .eq('key_name', 'gemini_api_key')
      .single();

    if (userKeys?.encrypted_key && encryptionKey) {
      // Decrypt user's API key
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const encryptedData = new Uint8Array(atob(userKeys.encrypted_key).split('').map(c => c.charCodeAt(0)));
      const iv = encryptedData.slice(0, 12);
      const ciphertext = encryptedData.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );

      apiKey = new TextDecoder().decode(decrypted);
    }
  }

  if (!apiKey) {
    throw new Error('Gemini API key not available');
  }

  // Call Gemini API
  const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=' + apiKey, {
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
        temperature: 0.9,
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!geminiResponse.ok) {
    throw new Error(`Gemini API error: ${geminiResponse.status}`);
  }

  const geminiData = await geminiResponse.json();
  const generatedReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!generatedReply) {
    throw new Error('No reply generated from Gemini API');
  }

  console.log('Generated reply:', generatedReply);

  // Post to Threads API
  if (reply.personas.threads_access_token) {
    // Create reply container
    const createResponse = await fetch(`https://graph.threads.net/v1.0/me/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: generatedReply,
        reply_to_id: reply.reply_id,
        access_token: reply.personas.threads_access_token,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create reply container: ${errorText}`);
    }

    const createData = await createResponse.json();
    console.log('Created reply container:', createData.id);

    // Publish the reply
    const publishResponse = await fetch(`https://graph.threads.net/v1.0/${createData.id}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: reply.personas.threads_access_token,
      }),
    });

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      throw new Error(`Failed to publish reply: ${errorText}`);
    }

    console.log('Reply published successfully');
  }
}

    console.log(`=== Scheduled replies processing completed. Processed: ${processedCount}, Success: ${successCount}, Failed: ${failedCount} ===`);

    return new Response(JSON.stringify({ 
      processed: processedCount,
      success: successCount,
      failed: failedCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-scheduled-replies function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});