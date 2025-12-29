
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
    // CRITICAL FIX: If the post has a scheduled_for timestamp, ALWAYS bypass time checks.
    // The scheduler has already validated the time when creating/queuing the post.
    // Re-checking here causes already-scheduled posts to be rescheduled incorrectly.
    let bypassTimeCheck = false;
    if (post.scheduled_for) {
      bypassTimeCheck = true;
      console.log('⏭️ Bypassing time check: post has scheduled_for timestamp');
    }

    if (!bypassTimeCheck && post.auto_schedule && post.persona_id) {
      console.log('🕐 Checking if current time matches persona scheduled settings...');

      // Determine persona timezone from configs (fallback to Asia/Tokyo)
      // We fetch both configs first
      const { data: autoConfig } = await supabase
        .from('auto_post_configs')
        .select('post_time, post_times, multi_time_enabled, timezone, is_active')
        .eq('persona_id', post.persona_id)
        .eq('is_active', true)
        .single();

      const { data: randomConfig } = await supabase
        .from('random_post_configs')
        .select('random_times, timezone, is_active')
        .eq('persona_id', post.persona_id)
        .eq('is_active', true)
        .single();

      const timezone = autoConfig?.timezone || randomConfig?.timezone || 'Asia/Tokyo';

      // Helpers for timezone-aware comparisons and scheduling
      const getTzHM = (zone: string) => {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: zone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).formatToParts(new Date());
        const h = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
        const m = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
        return { h, m };
      };

      const getTimezoneOffset = (zone: string) => {
        const now = new Date();
        const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
        const target = new Date(utc.toLocaleString('en-US', { timeZone: zone }));
        return (utc.getTime() - target.getTime()) / 60000; // minutes
      };

      const zonedDateForTime = (timeStr: string, zone: string, dayOffset = 0) => {
        // timeStr: 'HH:mm' or 'HH:mm:ss'
        const now = new Date();
        const base = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const dateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: zone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(base);
        const local = new Date(`${dateStr}T${timeStr}`);
        const offsetMin = getTimezoneOffset(zone);
        return new Date(local.getTime() - offsetMin * 60 * 1000); // UTC Date corresponding to local time
      };

      const { h: nowHour, m: nowMinute } = getTzHM(timezone);
      let timeMatches = false;

      if (autoConfig) {
        console.log('📋 Auto config found, checking time slots...');
        if (autoConfig.multi_time_enabled && autoConfig.post_times?.length > 0) {
          for (const timeSlot of autoConfig.post_times) {
            const [hours, minutes] = timeSlot.split(':').map(Number);
            if (nowHour === hours && nowMinute === minutes) {
              timeMatches = true;
              console.log(`✅ Time matches auto config slot (tz ${timezone}): ${timeSlot}`);
              break;
            }
          }
        } else if (autoConfig.post_time) {
          const [hours, minutes] = autoConfig.post_time.toString().split(':').map(Number);
          if (nowHour === hours && nowMinute === minutes) {
            timeMatches = true;
            console.log(`✅ Time matches auto config (tz ${timezone}): ${autoConfig.post_time}`);
          }
        }
      } else if (randomConfig) {
        console.log('🎲 Random config found, checking random time slots...');
        if (randomConfig.random_times?.length > 0) {
          for (const timeSlot of randomConfig.random_times) {
            const [hours, minutes] = timeSlot.split(':').map(Number);
            if (nowHour === hours && nowMinute === minutes) {
              timeMatches = true;
              console.log(`✅ Time matches random config slot (tz ${timezone}): ${timeSlot}`);
              break;
            }
          }
        }
      } else {
        console.log('⚠️ No active posting config found for persona, allowing manual post');
        timeMatches = true; // Allow posts if no config exists
      }

      if (!timeMatches) {
        const paddedMinute = nowMinute < 10 ? `0${nowMinute}` : `${nowMinute}`;
        console.warn(`🚫 Time mismatch: Current ${nowHour}:${paddedMinute} (${timezone}) does not match any configured time slots`);

        // Reschedule to next valid time slot in persona timezone, then convert to UTC
        let nextScheduledTime: Date | null = null;
        const currentMinutes = nowHour * 60 + nowMinute;

        const computeNextFromSlots = (slots: string[]) => {
          // Normalize and sort slots just in case
          const normalized = [...slots].map(s => s.length === 5 ? `${s}:00` : s).sort();
          for (const slot of normalized) {
            const [hh, mm] = slot.split(':').map(Number);
            const slotMin = hh * 60 + mm;
            if (slotMin > currentMinutes) {
              nextScheduledTime = zonedDateForTime(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, timezone, 0);
              return;
            }
          }
          // No slot left today -> first slot tomorrow
          const [h0, m0] = normalized[0].split(':').map(Number);
          nextScheduledTime = zonedDateForTime(`${String(h0).padStart(2, '0')}:${String(m0).padStart(2, '0')}`, timezone, 1);
        };

        if (autoConfig) {
          if (autoConfig.multi_time_enabled && autoConfig.post_times?.length > 0) {
            computeNextFromSlots(autoConfig.post_times);
          } else if (autoConfig.post_time) {
            const [hours, minutes] = autoConfig.post_time.toString().split(':').map(Number);
            // Today at configured time in tz; if passed, schedule for tomorrow
            const candidate = zonedDateForTime(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, timezone, 0);
            const { h: ch, m: cm } = getTzHM(timezone);
            const candMinutes = hours * 60 + minutes;
            const nowMin = ch * 60 + cm;
            nextScheduledTime = candMinutes > nowMin
              ? candidate
              : zonedDateForTime(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, timezone, 1);
          }
        } else if (randomConfig && randomConfig.random_times?.length > 0) {
          computeNextFromSlots(randomConfig.random_times);
        }

        if (nextScheduledTime) {
          await supabase
            .from('posts')
            .update({ status: 'scheduled', scheduled_for: nextScheduledTime.toISOString() })
            .eq('id', postId);

          console.log(`📅 Post rescheduled to (UTC): ${nextScheduledTime.toISOString()} (tz: ${timezone})`);
        }

        return new Response(
          JSON.stringify({ 
            success: false, 
            time_mismatch: true, 
            message: `Current time ${nowHour}:${paddedMinute} (${timezone}) does not match configured posting times`,
            rescheduled_to: nextScheduledTime?.toISOString() || null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    } else {
      if (!bypassTimeCheck) {
        console.log('📝 Manual post (auto_schedule=false) - skipping time check');
      }
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
      const MAX_PER_HOUR = 10;
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
      // retrieve-secretファンクションを認証付きで呼び出し
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('retrieve-secret', {
        body: { 
          key: `threads_access_token_${post.persona_id}`,
          fallback: post.personas?.threads_access_token
        },
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`
        }
      });

      console.log('🔍 Token response:', { success: tokenData?.success, source: tokenData?.source, hasSecret: !!tokenData?.secret });

      if (tokenData?.success && tokenData?.secret && tokenData.secret !== 'null' && tokenData.secret !== null) {
        console.log('✅ トークン取得成功（retrieve-secret）');
        threadsAccessToken = tokenData.secret;
      } else if (post.personas?.threads_access_token?.startsWith('THAA')) {
        console.log('✅ 非暗号化トークン使用');
        threadsAccessToken = post.personas.threads_access_token;
      } else {
        console.log('⚠️ トークンが取得できませんでした:', { tokenData, tokenError });
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

    // Helper: Validate URL format
    const isValidUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    };

    // Helper: Rehost image to Supabase storage if needed
    const rehostImageIfNeeded = async (imageUrl: string, index: number): Promise<string> => {
      try {
        const supaHost = new URL(supabaseUrl).host;
        const srcHost = new URL(imageUrl).host;

        if (supaHost !== srcHost) {
          console.log(`Rehosting external image ${index + 1} to Supabase Storage:`, imageUrl);
          const imgRes = await fetch(imageUrl);
          if (!imgRes.ok) throw new Error(`Failed to fetch source image: ${imgRes.status}`);

          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          const arrayBuf = await imgRes.arrayBuffer();

          const extFromType = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : contentType.includes('jpeg') ? 'jpg' : 'jpg';
          const path = `${post.user_id}/${post.id}/${Date.now()}_${index}.${extFromType}`;

          const { error: upErr } = await supabase
            .storage
            .from('post-images')
            .upload(path, new Uint8Array(arrayBuf), { contentType, upsert: true });

          if (upErr) {
            console.warn(`Supabase upload failed for image ${index + 1}, using original URL:`, upErr);
            return imageUrl;
          }

          const { data: pub } = supabase.storage.from('post-images').getPublicUrl(path);
          if (pub?.publicUrl) {
            console.log(`Image ${index + 1} rehosted to:`, pub.publicUrl);
            return pub.publicUrl;
          }
        }
        return imageUrl;
      } catch (rehostErr) {
        console.warn(`Image ${index + 1} rehosting skipped due to error:`, rehostErr);
        return imageUrl;
      }
    };

    // Check if post has images and validate them
    if (post.images && post.images.length > 0) {
      console.log(`Post has ${post.images.length} image(s), validating...`);
      
      // Filter valid image URLs
      const validImages = post.images.filter((url: string) => url && isValidUrl(url));
      console.log(`Valid images: ${validImages.length}/${post.images.length}`);

      if (validImages.length === 0) {
        // No valid images, fallback to text-only post
        console.warn('No valid image URLs detected, creating text-only post instead');
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

      } else if (validImages.length === 1) {
        // Single image post
        console.log('Single image post, processing...');
        const finalImageUrl = await rehostImageIfNeeded(validImages[0], 0);

        // Update DB with rehosted URL if changed
        if (finalImageUrl !== validImages[0]) {
          await supabase.from('posts').update({ images: [finalImageUrl] }).eq('id', post.id);
        }

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

      } else {
        // Multiple images - use CAROUSEL
        console.log(`Creating CAROUSEL post with ${validImages.length} images...`);
        
        // Step 1: Create individual media containers for each image
        const childContainerIds: string[] = [];
        const rehostedUrls: string[] = [];

        for (let i = 0; i < validImages.length; i++) {
          const imageUrl = validImages[i];
          console.log(`Processing carousel image ${i + 1}/${validImages.length}...`);
          
          const finalImageUrl = await rehostImageIfNeeded(imageUrl, i);
          rehostedUrls.push(finalImageUrl);

          // Create carousel item container (is_carousel_item=true, NO text for carousel items)
          const itemResponse = await fetch('https://graph.threads.net/v1.0/me/threads', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              media_type: 'IMAGE',
              image_url: finalImageUrl,
              is_carousel_item: true,
              access_token: threadsAccessToken
            }),
          });

          const itemText = await itemResponse.text();
          console.log(`Carousel item ${i + 1} response:`, {
            status: itemResponse.status,
            ok: itemResponse.ok,
            body: itemText
          });

          if (!itemResponse.ok) {
            console.error(`Failed to create carousel item ${i + 1}:`, itemText);
            throw new Error(`Failed to create carousel item ${i + 1}: ${itemResponse.status} ${itemText}`);
          }

          const itemData = JSON.parse(itemText);
          childContainerIds.push(itemData.id);
          console.log(`Carousel item ${i + 1} created: ${itemData.id}`);

          // Wait a bit between creating items to avoid rate limiting
          if (i < validImages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // Update DB with rehosted URLs if any changed
        const hasChanges = rehostedUrls.some((url, i) => url !== validImages[i]);
        if (hasChanges) {
          await supabase.from('posts').update({ images: rehostedUrls }).eq('id', post.id);
          console.log('Updated post with rehosted image URLs');
        }

        // Wait for all items to be processed
        console.log('Waiting for carousel items to be processed...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Step 2: Create carousel container with children
        console.log(`Creating carousel container with ${childContainerIds.length} children...`);
        const carouselResponse = await fetch('https://graph.threads.net/v1.0/me/threads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            media_type: 'CAROUSEL',
            children: childContainerIds.join(','),
            text: post.content,
            access_token: threadsAccessToken
          }),
        });

        const carouselText = await carouselResponse.text();
        console.log('Carousel container response:', {
          status: carouselResponse.status,
          ok: carouselResponse.ok,
          body: carouselText
        });

        if (!carouselResponse.ok) {
          console.error('Failed to create carousel container:', carouselText);
          
          if (carouselResponse.status === 403) {
            await supabase.from('security_events').insert({
              event_type: 'threads_auth_failed',
              user_id: userId,
              details: {
                persona_id: post.persona_id,
                post_id: postId,
                error: 'Threads API CAROUSEL authentication failed (403)',
                response: carouselText
              }
            });
          }
          
          throw new Error(`Failed to create carousel container: ${carouselResponse.status} ${carouselText}`);
        }

        const carouselData = JSON.parse(carouselText);
        console.log('Carousel container created:', carouselData);
        containerId = carouselData.id;
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
      
      // エラーレスポンスを解析
      let errorData: any;
      try {
        errorData = JSON.parse(publishResponseText);
      } catch {
        errorData = { message: publishResponseText };
      }

      // エラーの詳細な分類
      let failureCategory = 'api_error';
      let failureReason = `Threads API エラー (${publishResponse.status})`;

      // Handle specific error cases
      if (publishResponse.status === 403 || publishResponse.status === 401) {
        failureCategory = 'token_expired';
        failureReason = 'Threadsアクセストークンが期限切れまたは無効です';
        
        await supabase.from('security_events').insert({
          event_type: 'threads_auth_failed',
          user_id: userId,
          details: {
            persona_id: post.persona_id,
            post_id: postId,
            error: `Threads API authentication failed during publish (${publishResponse.status})`,
            response: publishResponseText
          }
        });
      } else if (publishResponse.status === 400) {
        // レート制限チェック
        if (errorData?.error?.error_subcode === 2207050 || publishResponseText.includes('制限されています')) {
          failureCategory = 'rate_limited';
          failureReason = 'Threads APIのレート制限により投稿できませんでした';
          
          // ペルソナを一時停止
          await supabase
            .from('personas')
            .update({
              is_rate_limited: true,
              rate_limit_detected_at: new Date().toISOString(),
              rate_limit_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              rate_limit_reason: errorData?.error?.error_user_msg || 'Rate limited'
            })
            .eq('id', post.persona_id);
          
          // 自動投稿設定を一時停止
          await supabase
            .from('auto_post_configs')
            .update({ is_active: false })
            .eq('persona_id', post.persona_id);
        } else if (publishResponseText.includes('text is too long')) {
          failureReason = 'コンテンツが長すぎます（500文字制限）';
          
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
        } else {
          failureReason = `Threads API エラー: ${errorData?.error?.message || publishResponseText}`;
        }
      }

      // 失敗情報を記録
      await supabase
        .from('posts')
        .update({
          status: 'failed',
          failure_reason: failureReason,
          failure_category: failureCategory,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId);
      
      throw new Error(`Failed to publish to Threads: ${failureReason}`);
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
        .then((res) => console.log('Triggered self-reply-processor:', res.data))
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
    console.error('Error stack:', error instanceof Error ? error.stack : 'no stack');
    
    // エラー分類とfailure_reasonの設定
    let failureCategory = 'api_error';
    let failureReason = error instanceof Error ? error.message : String(error);
    
    // エラーメッセージから詳細な分類を行う
    if (failureReason.includes('expired') || failureReason.includes('403') || failureReason.includes('authentication failed')) {
      failureCategory = 'token_expired';
      failureReason = 'Threadsアクセストークンが期限切れまたは無効です';
    } else if (failureReason.includes('rate limit') || failureReason.includes('2207050') || failureReason.includes('制限されています')) {
      failureCategory = 'rate_limited';
      failureReason = 'Threads APIのレート制限により投稿できませんでした';
    } else if (failureReason.includes('network') || failureReason.includes('timeout') || failureReason.includes('ECONNREFUSED')) {
      failureCategory = 'network_error';
      failureReason = 'ネットワークエラーにより投稿できませんでした';
    } else if (failureReason.includes('400') || failureReason.includes('Invalid') || failureReason.includes('too long')) {
      failureCategory = 'api_error';
      failureReason = 'Threads APIエラー: ' + failureReason;
    }
    
    // postsテーブルにfailure情報を記録
    try {
      const requestBody = await req.json().catch(() => ({}));
      const postId = requestBody?.postId;
      
      if (postId) {
        await supabase
          .from('posts')
          .update({
            status: 'failed',
            failure_reason: failureReason,
            failure_category: failureCategory,
            updated_at: new Date().toISOString()
          })
          .eq('id', postId);
        
        console.log(`Failed post recorded: ${postId}, category: ${failureCategory}`);
      }
    } catch (updateError) {
      console.error('Failed to update post failure info:', updateError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: failureReason,
        category: failureCategory,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});
