
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const personaId = url.searchParams.get('persona_id');
    
    console.log(`Webhook request received: ${req.method} ${req.url}`);
    console.log(`Persona ID from URL: ${personaId}`);

    if (req.method === 'GET') {
      // Webhook verification for subscription setup
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('GET request received:');
      console.log(`Mode: ${mode}`);
      console.log(`Token: ${token}`);
      console.log(`Challenge: ${challenge}`);

      if (mode === 'subscribe') {
        if (!personaId) {
          console.error('No persona_id provided');
          return new Response('No persona_id provided', { status: 400 });
        }

        // Get persona's webhook verify token
        const { data: persona, error } = await supabase
          .from('personas')
          .select('webhook_verify_token')
          .eq('id', personaId)
          .single();

        if (error || !persona) {
          console.error('Persona not found:', error);
          return new Response('Persona not found', { status: 404 });
        }

        const expectedToken = persona.webhook_verify_token;
        console.log(`Expected token: ${expectedToken}`);
        console.log(`Received token: ${token}`);

        if (token === expectedToken) {
          console.log('Token verified successfully');
          return new Response(challenge, { status: 200 });
        } else {
          console.error('Token verification failed');
          return new Response('Forbidden', { status: 403 });
        }
      }

      return new Response('Method not allowed', { status: 405 });
    }

    if (req.method === 'POST') {
      console.log('POST request received:');
      
      const rawBody = await req.text();
      console.log(`Body length: ${rawBody.length}`);
      console.log(`Raw body: ${rawBody}`);

      // Security headers check
      const signature = req.headers.get('x-hub-signature-256');
      const timestamp = req.headers.get('x-hub-timestamp');
      
      console.log(`Signature present: ${signature ? 'true' : 'false'}`);
      console.log(`Timestamp present: ${timestamp ? 'true' : 'false'}`);

      let webhookData;
      try {
        webhookData = JSON.parse(rawBody);
        console.log('Successfully parsed JSON:', JSON.stringify(webhookData, null, 2));
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        return new Response('Invalid JSON', { status: 400 });
      }

      let processedAnyReply = false;

      // Handle different webhook formats
      if (webhookData.object === 'page' && webhookData.entry) {
        // Traditional webhook format
        console.log('Processing entry-based webhook...');
        
        for (const entry of webhookData.entry) {
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.field === 'feed' && change.value && change.value.item === 'comment') {
                console.log('=== PROCESSING COMMENT FOR PERSONA ===');
                const processed = await processReplyData(change.value, personaId);
                if (processed) processedAnyReply = true;
              }
            }
          }
        }
      } else if (webhookData.values && Array.isArray(webhookData.values)) {
        // Values-based webhook format (newer format)
        console.log('Processing values-based webhook...');
        
        for (const valueItem of webhookData.values) {
          if (valueItem.field === 'replies' && valueItem.value) {
            console.log('Found reply in values, processing...');
            console.log('=== PROCESSING REPLY FOR PERSONA ===');
            const processed = await processReplyData(valueItem.value, personaId);
            if (processed) processedAnyReply = true;
          }
        }
      }

      console.log(`Processed any reply: ${processedAnyReply}`);

      // Log security event
      await logSecurityEvent({
        event: 'webhook_processed',
        details: {
          object: webhookData.object || 'unknown',
          entries: webhookData.entry ? webhookData.entry.length : 0,
          values: webhookData.values ? webhookData.values.length : 0,
          persona_id: personaId,
          processed_reply: processedAnyReply
        },
        severity: 'low'
      });

      return new Response(JSON.stringify({ 
        success: true, 
        processed: processedAnyReply 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

async function processReplyData(replyData: any, personaId: string | null): Promise<boolean> {
  if (!personaId) {
    console.error('No persona ID provided');
    return false;
  }

  console.log('Reply Data:', JSON.stringify(replyData, null, 2));
  console.log(`Persona ID: ${personaId}`);

  // Extract reply information
  const sanitizedData = {
    reply_id: replyData.id,
    original_post_id: replyData.replied_to?.id || replyData.root_post?.id,
    reply_author_id: replyData.username || replyData.from?.username,
    reply_author_username: replyData.username || replyData.from?.username,
    reply_text: replyData.text || replyData.message,
    reply_timestamp: new Date(replyData.timestamp || replyData.created_time || Date.now()).toISOString()
  };

  console.log('Sanitized Data:', JSON.stringify(sanitizedData, null, 2));

  // Get persona information
  const { data: persona, error: personaError } = await supabase
    .from('personas')
    .select('id, name, user_id, threads_app_id, threads_username, ai_auto_reply_enabled, threads_access_token')
    .eq('id', personaId)
    .single();

  console.log('Persona Query Result:', {
    persona: persona ? {
      id: persona.id,
      name: persona.name,
      user_id: persona.user_id,
      threads_app_id: persona.threads_app_id,
      threads_username: persona.threads_username,
      ai_auto_reply_enabled: persona.ai_auto_reply_enabled
    } : null,
    error: personaError
  });

  if (personaError || !persona) {
    console.error('Failed to get persona:', personaError);
    return false;
  }

  // Enhanced self-reply check
  const isSelf = 
    sanitizedData.reply_author_username === persona.name ||
    sanitizedData.reply_author_username === persona.threads_username ||
    sanitizedData.reply_author_id === persona.user_id ||
    sanitizedData.reply_author_id === persona.threads_app_id;

  console.log('Self-reply check:', {
    reply_author_username: sanitizedData.reply_author_username,
    reply_author_id: sanitizedData.reply_author_id,
    persona_name: persona.name,
    persona_threads_username: persona.threads_username,
    persona_user_id: persona.user_id,
    persona_threads_app_id: persona.threads_app_id,
    is_self: isSelf
  });

  if (isSelf) {
    console.log('Skipping self-reply');
    return false;
  }

  // Check if reply already exists
  const { data: existingReply } = await supabase
    .from('thread_replies')
    .select('id')
    .eq('reply_id', sanitizedData.reply_id)
    .single();

  if (existingReply) {
    console.log('Reply already exists in database');
    return false;
  }

  // Insert new reply to database
  console.log('Inserting new reply to database...');
  const { data: insertedReply, error: insertError } = await supabase
    .from('thread_replies')
    .insert({
      user_id: persona.user_id,
      persona_id: personaId,
      original_post_id: sanitizedData.original_post_id,
      reply_id: sanitizedData.reply_id,
      reply_text: sanitizedData.reply_text,
      reply_author_id: sanitizedData.reply_author_id,
      reply_author_username: sanitizedData.reply_author_username,
      reply_timestamp: sanitizedData.reply_timestamp
    })
    .select()
    .single();

  if (insertError) {
    console.error('Failed to insert reply:', insertError);
    return false;
  }

  console.log('Reply successfully inserted!');

  // Check for keyword-based auto replies first
  console.log('Checking keyword-based auto replies...');
  const { data: autoReplies, error: autoReplyError } = await supabase
    .from('auto_replies')
    .select('*')
    .eq('user_id', persona.user_id)
    .eq('persona_id', personaId)
    .eq('is_active', true);

  if (!autoReplyError && autoReplies && autoReplies.length > 0) {
    console.log(`Found ${autoReplies.length} active auto-reply rules`);
    
    for (const autoReply of autoReplies) {
      const keywords = autoReply.trigger_keywords;
      if (keywords && Array.isArray(keywords)) {
        console.log(`Checking keywords: ${keywords.join(', ')}`);
        
        // Check if any keyword is found in the reply text
        const replyTextLower = sanitizedData.reply_text.toLowerCase();
        const matchedKeyword = keywords.find(keyword => 
          replyTextLower.includes(keyword.toLowerCase())
        );
        
        if (matchedKeyword) {
          console.log(`Keyword matched: "${matchedKeyword}"`);
          console.log(`Sending keyword-based auto reply: "${autoReply.response_template}"`);
          
          try {
            // Send keyword-based reply using Threads API
            const replySuccess = await sendThreadsReply(
              autoReply.response_template,
              sanitizedData.reply_id,
              persona.threads_access_token
            );
            
            if (replySuccess) {
              // Update the thread_replies table to mark auto reply as sent
              await supabase
                .from('thread_replies')
                .update({ auto_reply_sent: true })
                .eq('id', insertedReply.id);
              
              console.log('Keyword-based auto reply sent successfully');
              
              // Log activity
              await supabase
                .from('activity_logs')
                .insert({
                  user_id: persona.user_id,
                  persona_id: personaId,
                  action_type: 'keyword_auto_reply_sent',
                  description: `キーワード自動返信を送信しました (キーワード: ${matchedKeyword})`,
                  metadata: {
                    reply_to: sanitizedData.reply_text,
                    reply_to_id: sanitizedData.reply_id,
                    matched_keyword: matchedKeyword,
                    response: autoReply.response_template
                  }
                });
              
              return true; // Exit early after successful keyword reply
            }
          } catch (keywordReplyError) {
            console.error('Failed to send keyword-based auto reply:', keywordReplyError);
          }
        }
      }
    }
  }

  // If no keyword match, check AI auto reply settings
  console.log('No keyword match found, checking AI auto reply settings...');
  
  if (persona.ai_auto_reply_enabled) {
    console.log('AI auto reply is enabled for this persona');
    try {
      console.log('Calling threads-auto-reply function...');
      const { data: autoReplyResponse, error: autoReplyError } = await supabase.functions.invoke('threads-auto-reply', {
        body: {
          postContent: '', // 元投稿の内容（必要に応じて取得）
          replyContent: sanitizedData.reply_text,
          replyId: sanitizedData.reply_id,
          personaId: personaId,
          userId: persona.user_id
        }
      });

      if (autoReplyError) {
        console.error('Auto-reply function error:', autoReplyError);
      } else {
        console.log('Auto-reply function response:', autoReplyResponse);
        
        // 自動返信が成功した場合、auto_reply_sentをtrueに更新
        if (autoReplyResponse && autoReplyResponse.success) {
          console.log('Auto-reply successful, updating auto_reply_sent to true');
          const { error: updateError } = await supabase
            .from('thread_replies')
            .update({ auto_reply_sent: true })
            .eq('id', insertedReply.id);

          if (updateError) {
            console.error('Failed to update auto_reply_sent:', updateError);
          } else {
            console.log('Successfully updated auto_reply_sent to true');
          }
        }
      }
    } catch (autoReplyErr) {
      console.error('Failed to call auto-reply function:', autoReplyErr);
    }
  } else {
    console.log('AI auto reply is disabled for this persona');
  }

  return true;
}

async function sendThreadsReply(replyText: string, replyToId: string, accessToken: string): Promise<boolean> {
  try {
    console.log('Creating Threads reply container...');
    const createContainerResponse = await fetch('https://graph.threads.net/v1.0/me/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT_POST',
        text: replyText,
        reply_to_id: replyToId,
        access_token: accessToken
      }),
    });

    if (!createContainerResponse.ok) {
      const errorText = await createContainerResponse.text();
      console.error('Threads create container error:', errorText);
      return false;
    }

    const containerData = await createContainerResponse.json();
    console.log('Reply container created:', containerData.id);

    if (!containerData.id) {
      console.error('No container ID returned from Threads API');
      return false;
    }

    // Wait and publish
    console.log('Waiting before publish...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Publishing reply to Threads...');
    const publishResponse = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: accessToken
      }),
    });

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      console.error('Threads publish error:', errorText);
      return false;
    }

    const publishData = await publishResponse.json();
    console.log('Reply published:', publishData.id);
    return true;

  } catch (error) {
    console.error('Error sending Threads reply:', error);
    return false;
  }
}

async function logSecurityEvent(event: any) {
  const securityEvent = {
    timestamp: new Date().toISOString(),
    event: event.event,
    details: event.details,
    severity: event.severity
  };
  
  console.log('Security Event:', JSON.stringify(securityEvent));
}
