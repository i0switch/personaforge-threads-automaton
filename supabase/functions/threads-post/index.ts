
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    console.log('Starting Threads post function...');

    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const { postId, userId } = requestBody;

    if (!postId || !userId) {
      const error = 'Missing required fields: postId, userId';
      console.error(error, { postId, userId });
      throw new Error(error);
    }

    console.log(`Publishing post ${postId} to Threads for user ${userId}`);

    // Get post details with persona info
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select(`
        *,
        personas!inner(threads_access_token)
      `)
      .eq('id', postId)
      .eq('user_id', userId)
      .single();

    console.log('Post query result:', { post: post ? 'found' : 'not found', error: postError });

    if (postError) {
      console.error('Post query error:', postError);
      throw new Error(`Post query failed: ${postError.message}`);
    }

    if (!post) {
      const error = 'Post not found or access denied';
      console.error(error, { postId, userId });
      throw new Error(error);
    }

    console.log('Post found:', {
      id: post.id,
      content: post.content.substring(0, 100) + '...',
      hasPersona: !!post.personas,
      hasToken: !!post.personas?.threads_access_token
    });

    // Safety guard: Global posting pause
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('posting_paused, pause_reason, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('System settings fetch error:', settingsError);
    }
    if (settings?.posting_paused) {
      console.warn('🛑 Posting paused by admin. Skipping publish.');
      // Revert post status to scheduled if this was marked processing upstream
      try {
        await supabase
          .from('posts')
          .update({ status: 'scheduled' })
          .eq('id', postId)
          .eq('status', 'processing');
      } catch (revertErr) {
        console.error('Failed to revert post status after pause:', revertErr);
      }
      return new Response(
        JSON.stringify({ success: false, paused: true, reason: settings.pause_reason || null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Safety guard: Check persona scheduled time (except manual "publish now")
    // If the post has a scheduled_for timestamp and it's due (allowing small tolerance),
    // bypass persona time-window checks to honor the scheduled time precisely.
    let bypassTimeCheck = false;
    if (post.scheduled_for) {
      try {
        const dueToleranceMs = 60_000; // 60s tolerance around minute boundaries
        const scheduledAtMs = new Date(post.scheduled_for).getTime();
        if (!Number.isNaN(scheduledAtMs) && scheduledAtMs <= Date.now() + dueToleranceMs) {
          bypassTimeCheck = true;
          console.log('⏩ Scheduled time reached — bypassing persona time-slot checks');
        }
      } catch (e) {
        console.warn('Failed to parse scheduled_for, continuing with normal checks');
      }
    }

    if (!bypassTimeCheck && post.auto_schedule && post.persona_id) {
      console.log('🕐 Checking if current time matches persona scheduled settings...');
      
      const now = new Date();
      const nowHour = now.getHours();
      const nowMinute = now.getMinutes();
      
      // Check auto post configs (fixed time)
      const { data: autoConfig } = await supabase
        .from('auto_post_configs')
        .select('post_time, post_times, multi_time_enabled, timezone, is_active')
        .eq('persona_id', post.persona_id)
        .eq('is_active', true)
        .single();
      
      // Check random post configs (random times)
      const { data: randomConfig } = await supabase
        .from('random_post_configs')
        .select('random_times, timezone, is_active')
        .eq('persona_id', post.persona_id)
        .eq('is_active', true)
        .single();
      
      let timeMatches = false;
      
      if (autoConfig) {
        console.log('📋 Auto config found, checking time slots...');
        if (autoConfig.multi_time_enabled && autoConfig.post_times?.length > 0) {
          // Multiple times check
          for (const timeSlot of autoConfig.post_times) {
            const [hours, minutes] = timeSlot.split(':').map(Number);
            if (nowHour === hours && nowMinute === minutes) {
              timeMatches = true;
              console.log(`✅ Time matches auto config slot: ${timeSlot}`);
              break;
            }
          }
        } else if (autoConfig.post_time) {
          // Single time check
          const [hours, minutes] = autoConfig.post_time.toString().split(':').map(Number);
          if (nowHour === hours && nowMinute === minutes) {
            timeMatches = true;
            console.log(`✅ Time matches auto config: ${autoConfig.post_time}`);
          }
        }
      } else if (randomConfig) {
        console.log('🎲 Random config found, checking random time slots...');
        if (randomConfig.random_times?.length > 0) {
          for (const timeSlot of randomConfig.random_times) {
            const [hours, minutes] = timeSlot.split(':').map(Number);
            if (nowHour === hours && nowMinute === minutes) {
              timeMatches = true;
              console.log(`✅ Time matches random config slot: ${timeSlot}`);
              break;
            }
          }
        }
      } else {
        console.log('⚠️ No active posting config found for persona, allowing manual post');
        timeMatches = true; // Allow posts if no config exists
      }
      
      if (!timeMatches) {
        console.warn(`🚫 Time mismatch: Current ${nowHour}:${nowMinute < 10 ? '0' : ''}${nowMinute} does not match any configured time slots`);
        
        // Reschedule to next valid time slot
        let nextScheduledTime: Date | null = null;
        if (autoConfig) {
          if (autoConfig.multi_time_enabled && autoConfig.post_times?.length > 0) {
            // Find next time slot
            const currentMinutes = nowHour * 60 + nowMinute;
            for (const timeSlot of autoConfig.post_times) {
              const [hours, minutes] = timeSlot.split(':').map(Number);
              const slotMinutes = hours * 60 + minutes;
              if (slotMinutes > currentMinutes) {
                const nextRun = new Date(now);
                nextRun.setHours(hours, minutes, 0, 0);
                nextScheduledTime = nextRun;
                break;
              }
            }
            // If no slot today, use first slot tomorrow
            if (!nextScheduledTime) {
              const [hours, minutes] = autoConfig.post_times[0].split(':').map(Number);
              const nextRun = new Date(now);
              nextRun.setDate(nextRun.getDate() + 1);
              nextRun.setHours(hours, minutes, 0, 0);
              nextScheduledTime = nextRun;
            }
          } else if (autoConfig.post_time) {
            const [hours, minutes] = autoConfig.post_time.toString().split(':').map(Number);
            nextScheduledTime = new Date(now);
            nextScheduledTime.setHours(hours, minutes, 0, 0);
            if (nextScheduledTime <= now) {
              nextScheduledTime.setDate(nextScheduledTime.getDate() + 1);
            }
          }
        }
        
        if (nextScheduledTime) {
          await supabase
            .from('posts')
            .update({ status: 'scheduled', scheduled_for: nextScheduledTime.toISOString() })
            .eq('id', postId);
          
          console.log(`📅 Post rescheduled to: ${nextScheduledTime.toISOString()}`);
        }
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            time_mismatch: true, 
            message: `Current time ${nowHour}:${nowMinute < 10 ? '0' : ''}${nowMinute} does not match configured posting times`,
            rescheduled_to: nextScheduledTime?.toISOString() || null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    } else {
      console.log(bypassTimeCheck
        ? '⏩ Bypass active due to scheduled_for being due — skipping time window checks'
        : '📝 Manual post (auto_schedule=false) - skipping time check');
    }

    // Safety guard: Persona must be active
    try {
      const { data: persona, error: personaErr } = await supabase
        .from('personas')
        .select('is_active, name')
        .eq('id', post.persona_id)
        .maybeSingle();
      if (personaErr) {
        console.error('Persona fetch error:', personaErr);
      }
      if (!persona?.is_active) {
        console.warn('⏸️ Persona is inactive. Skipping publish.', { personaId: post.persona_id, name: persona?.name });
        await supabase
          .from('posts')
          .update({ status: 'scheduled' })
          .eq('id', postId)
          .eq('status', 'processing');
        return new Response(
          JSON.stringify({ success: false, persona_inactive: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    } catch (personaCheckErr) {
      console.error('Persona active check failed:', personaCheckErr);
    }

    // Safety guard: hourly per-persona cap
    try {
      const now = new Date();
      const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const MAX_PER_HOUR = 2;
      const { count, error: cntErr } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('persona_id', post.persona_id)
        .eq('status', 'published')
        .gt('published_at', since);
      if (cntErr) {
        console.error('Hourly cap count error:', cntErr);
      }
      const publishedLastHour = count || 0;
      if (publishedLastHour >= MAX_PER_HOUR) {
        const deferTo = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
        await supabase
          .from('posts')
          .update({ status: 'scheduled', scheduled_for: deferTo })
          .eq('id', postId)
          .eq('status', 'processing');
        console.warn(`⏳ Hourly cap reached (${publishedLastHour}/${MAX_PER_HOUR}) for persona ${post.persona_id}. Deferred to ${deferTo}`);
        return new Response(
          JSON.stringify({ success: false, rate_limited: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    } catch (rlErr) {
      console.error('Hourly cap check failed:', rlErr);
    }

    // Threads APIトークンの取得と復号化
    let threadsAccessToken: string | null = null;
    
    try {
      // retrieve-secretファンクションを使用してトークンを取得
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('retrieve-secret', {
        body: { 
          key: `threads_access_token_${post.persona_id}`,
          fallback: post.personas?.threads_access_token
        }
      });

      if (tokenData?.secret && !tokenError) {
        console.log('✅ トークン取得成功（retrieve-secret）');
        threadsAccessToken = tokenData.secret;
      } else if (post.personas?.threads_access_token?.startsWith('THAA')) {
        console.log('✅ 非暗号化トークン使用');
        threadsAccessToken = post.personas.threads_access_token;
      }
    } catch (error) {
      console.error('❌ トークン復号化エラー:', error);
    }

    if (!threadsAccessToken) {
      const error = 'Threads access token not configured or decryption failed for this persona';
      console.error(error, { 
        personaId: post.persona_id,
        hasToken: !!post.personas?.threads_access_token,
        tokenPrefix: post.personas?.threads_access_token?.substring(0, 8) + '...'
      });
      
      // Log security event for missing token
      try {
        await supabase.from('security_events').insert({
          event_type: 'token_missing',
          user_id: userId,
          details: {
            persona_id: post.persona_id,
            post_id: postId,
            error: 'Missing or invalid threads access token'
          }
        });
      } catch (logError) {
        console.error('Failed to log security event:', logError);
      }
      
      throw new Error(error);
    }
    console.log(`Publishing post: ${post.content.substring(0, 100)}...`);

    let containerId: string;

    // Check if post has images and validate them
    if (post.images && post.images.length > 0) {
      console.log(`Post has ${post.images.length} images, validating...`);
      
      // Validate image URL format
      const imageUrl = post.images[0];
      const isValidUrl = (url: string): boolean => {
        try {
          const parsed = new URL(url);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      };

      if (!imageUrl || !isValidUrl(imageUrl)) {
        console.warn('Invalid image URL detected, creating text-only post instead:', imageUrl);
        // Fallback to text-only post for invalid image URLs
        const createContainerResponse = await fetch('https://graph.threads.net/v1.0/me/threads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            media_type: 'TEXT',
            text: post.content,
            access_token: threadsAccessToken
          }),
        });

        const responseText = await createContainerResponse.text();
        console.log('Fallback text container response:', {
          status: createContainerResponse.status,
          ok: createContainerResponse.ok,
          body: responseText
        });

        if (!createContainerResponse.ok) {
          console.error('Threads create fallback text container error:', responseText);
          throw new Error(`Failed to create Threads fallback text container: ${createContainerResponse.status} ${responseText}`);
        }

        const containerData = JSON.parse(responseText);
        console.log('Fallback text container created:', containerData);
        containerId = containerData.id;
      } else {
        console.log('Valid image URL detected, attempting to ensure permanent hosting');

        // Ensure image is hosted on our Supabase storage (avoid expiring external URLs)
        let finalImageUrl = imageUrl;
        try {
          const supaHost = new URL(supabaseUrl).host;
          const srcHost = new URL(imageUrl).host;

          if (supaHost !== srcHost) {
            console.log('Rehosting external image to Supabase Storage:', imageUrl);
            const imgRes = await fetch(imageUrl);
            if (!imgRes.ok) throw new Error(`Failed to fetch source image: ${imgRes.status}`);

            const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
            const arrayBuf = await imgRes.arrayBuffer();

            // Derive extension from content-type or fallback to webp/jpg
            const extFromType = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : contentType.includes('jpeg') ? 'jpg' : 'jpg';
            const path = `${post.user_id}/${post.id}/${Date.now()}.${extFromType}`;

            const { data: upData, error: upErr } = await supabase
              .storage
              .from('post-images')
              .upload(path, new Uint8Array(arrayBuf), { contentType, upsert: true });

            if (upErr) {
              console.warn('Supabase upload failed, will use original URL:', upErr);
            } else {
              const { data: pub } = supabase.storage.from('post-images').getPublicUrl(path);
              if (pub?.publicUrl) {
                finalImageUrl = pub.publicUrl;
                // Persist back to DB so future operations use the stable URL
                await supabase.from('posts').update({ images: [finalImageUrl] }).eq('id', post.id);
                console.log('Image rehosted to Supabase Storage:', finalImageUrl);
              }
            }
          }
        } catch (rehostErr) {
          console.warn('Image rehosting skipped due to error, proceeding with original URL:', rehostErr);
        }

        // Create image container on Threads using the final (possibly rehosted) URL
        const createContainerResponse = await fetch('https://graph.threads.net/v1.0/me/threads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            media_type: 'IMAGE',
            image_url: finalImageUrl,
            text: post.content,
            access_token: threadsAccessToken
          }),
        });

        const responseText = await createContainerResponse.text();
        console.log('Image container response:', {
          status: createContainerResponse.status,
          ok: createContainerResponse.ok,
          body: responseText
        });

        if (!createContainerResponse.ok) {
          console.error('Threads create image container error:', responseText);
          
          // Handle specific 403 authentication error
          if (createContainerResponse.status === 403) {
            await supabase.from('security_events').insert({
              event_type: 'threads_auth_failed',
              user_id: userId,
              details: {
                persona_id: post.persona_id,
                post_id: postId,
                error: 'Threads API authentication failed (403)',
                response: responseText
              }
            });
          }
          
          throw new Error(`Failed to create Threads image container: ${createContainerResponse.status} ${responseText}`);
        }

        const containerData = JSON.parse(responseText);
        console.log('Image container created:', containerData);
        containerId = containerData.id;
      }

    } else {
      console.log('Creating text-only container');
      
      // For text-only posts
      const createContainerResponse = await fetch('https://graph.threads.net/v1.0/me/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_type: 'TEXT',
          text: post.content,
          access_token: threadsAccessToken
        }),
      });

      const responseText = await createContainerResponse.text();
      console.log('Text container response:', {
        status: createContainerResponse.status,
        ok: createContainerResponse.ok,
        body: responseText
      });

      if (!createContainerResponse.ok) {
        console.error('Threads create text container error:', responseText);
        throw new Error(`Failed to create Threads text container: ${createContainerResponse.status} ${responseText}`);
      }

      const containerData = JSON.parse(responseText);
      console.log('Text container created:', containerData);
      containerId = containerData.id;
    }

    if (!containerId) {
      const error = 'No container ID returned from Threads API';
      console.error(error);
      throw new Error(error);
    }

    // Wait longer for image processing
    const waitTime = post.images && post.images.length > 0 ? 5000 : 2000;
    console.log(`Waiting ${waitTime}ms for container processing...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    // Then publish the container (Step 2)
    console.log('Publishing container:', containerId);
    const publishResponse = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: threadsAccessToken
      }),
    });

    const publishResponseText = await publishResponse.text();
    console.log('Publish response:', {
      status: publishResponse.status,
      ok: publishResponse.ok,
      body: publishResponseText
    });

    if (!publishResponse.ok) {
      console.error('Threads publish error:', publishResponseText);
      
      // Handle specific error cases
      if (publishResponse.status === 403) {
        await supabase.from('security_events').insert({
          event_type: 'threads_auth_failed',
          user_id: userId,
          details: {
            persona_id: post.persona_id,
            post_id: postId,
            error: 'Threads API authentication failed during publish (403)',
            response: publishResponseText
          }
        });
      } else if (publishResponse.status === 400 && publishResponseText.includes('text is too long')) {
        await supabase.from('security_events').insert({
          event_type: 'threads_content_error',
          user_id: userId,
          details: {
            persona_id: post.persona_id,
            post_id: postId,
            error: 'Threads content length exceeded (500 characters)',
            content_length: post.content.length
          }
        });
      }
      
      throw new Error(`Failed to publish to Threads: ${publishResponse.status} ${publishResponseText}`);
    }

    const publishData = JSON.parse(publishResponseText);
    console.log('Post published successfully:', publishData);

    // Update post status and queue status atomically
    console.log('Updating post and queue status in database...');
    const publishedAt = new Date().toISOString();
    
    // Update posts table
    const { error: updatePostError } = await supabase
      .from('posts')
      .update({
        status: 'published',
        published_at: publishedAt
      })
      .eq('id', postId)
      .eq('user_id', userId);

    if (updatePostError) {
      console.error('Critical: Failed to update post status after successful Threads publication:', updatePostError);
      throw new Error(`Post published to Threads but failed to update database: ${updatePostError.message}`);
    }

    // Update corresponding queue entries to completed
    const { error: updateQueueError } = await supabase
      .from('post_queue')
      .update({ 
        status: 'completed',
        updated_at: publishedAt
      })
      .eq('post_id', postId);

    if (updateQueueError) {
      console.error('Critical: Failed to update queue status after successful publication:', updateQueueError);
      // Try to revert post status to prevent inconsistency
      await supabase
        .from('posts')
        .update({ status: 'scheduled', published_at: null })
        .eq('id', postId);
      throw new Error(`Post published but failed to update queue status: ${updateQueueError.message}`);
    }

    console.log('Post and queue status updated successfully');

    // Save Threads post ID to self-reply job for this post (if exists)
    try {
      const threadsId: string | undefined = publishData?.id;
      if (threadsId) {
        const { error: jobErr } = await supabase
          .from('self_reply_jobs')
          .update({ threads_post_id: threadsId })
          .eq('post_id', postId)
          .eq('status', 'pending');
        if (jobErr) {
          console.error('Failed to update self_reply_jobs with Threads ID:', jobErr);
        } else {
          console.log('self_reply_jobs updated with Threads ID:', threadsId);
        }
      } else {
        console.warn('No Threads ID in publishData; skipping job update');
      }
    } catch (e) {
      console.error('Error updating self-reply job with Threads ID', e);
    }

    // Kick off self-reply processor in background (do not await)
    try {
      // Safe fire-and-forget
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      supabase.functions.invoke('self-reply-processor', { body: { limit: 10 } })
        .then((res) => console.log('Triggered self-reply-processor:', res.status))
        .catch((e) => console.error('Failed to trigger self-reply-processor', e));
    } catch (e) {
      console.error('Self-reply trigger error', e);
    }

    console.log(`Post ${postId} successfully published to Threads`);

    return new Response(
      JSON.stringify({ 
        success: true,
        threads_id: publishData.id,
        message: 'Post published to Threads successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in threads-post function:', error);
    console.error('Error stack:', error.stack);
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
