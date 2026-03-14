
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { requireInternalRequest } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://threads-genius-ai.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Use shared auth: accepts both x-cron-secret and service_role Authorization
  const internalAuth = requireInternalRequest(req, corsHeaders);
  if (!internalAuth.ok) {
    console.error('Auto-scheduler auth failed - request rejected');
    return internalAuth.response;
  }

  try {
    console.log('=== Auto-scheduler starting ===');
    
    const now = new Date();
    console.log(`Current time: ${now.toISOString()}`);

    // Global posting pause check (safety guard)
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
      console.warn('🛑 System posting paused. Aborting auto-scheduler run.', settings);
      return new Response(
        JSON.stringify({ 
          success: true, 
          postingPaused: true, 
          reason: settings.pause_reason || null,
          timestamp: now.toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 現在時刻より前（厳守）にスケジュールされた投稿のみを対象
    const cutoffTime = now; // 早発禁止のためバッファなし
    // 古すぎる投稿は無視（7日以上前のスケジュールは陳腐化しているため除外）
    const staleThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    console.log(`Searching for posts scheduled between ${staleThreshold.toISOString()} and ${cutoffTime.toISOString()}`);
    
    // キューにある投稿を優先的に処理（重複を避けるため）
    const { data: queueItems, error: queueError } = await supabase
      .from('post_queue')
      .select(`
        *,
        posts!inner(
          *,
          personas!fk_posts_persona_id(threads_access_token)
        )
      `)
      .eq('status', 'queued')
      .gte('scheduled_for', staleThreshold.toISOString())
      .lte('scheduled_for', cutoffTime.toISOString())
      .order('queue_position', { ascending: true })
      .limit(10);

    if (queueError) {
      console.error('Error fetching queue items:', queueError);
      // キューエラーは致命的ではないので続行
    }

    console.log(`Found ${queueItems?.length || 0} queue items to process`);

    // キューにない直接スケジュール済みの投稿を取得（重複を避けるため）
    const queuePostIds = queueItems?.map(item => item.post_id) || [];
    
    let scheduledQuery = supabase
      .from('posts')
      .select(`
        *,
        personas!fk_posts_persona_id(threads_access_token)
      `)
      .eq('status', 'scheduled')
      .not('scheduled_for', 'is', null)
      .gte('scheduled_for', staleThreshold.toISOString())
      .lte('scheduled_for', cutoffTime.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(20);

    if (queuePostIds.length > 0) {
      const quotedIds = queuePostIds.map(id => `"${id}"`).join(',');
      scheduledQuery = scheduledQuery.not('id', 'in', `(${quotedIds})`);
    }

    const { data: scheduledPosts, error: scheduledError } = await scheduledQuery;

    if (scheduledError) {
      console.error('Error fetching scheduled posts:', scheduledError);
      throw scheduledError;
    }

    console.log(`Found ${scheduledPosts?.length || 0} scheduled posts to process`);
    
    if (scheduledPosts && scheduledPosts.length > 0) {
      console.log('Scheduled posts details:', scheduledPosts.map(post => ({
        id: post.id,
        scheduled_for: post.scheduled_for,
        status: post.status,
        content_preview: post.content.substring(0, 50) + '...'
      })));
    }

    // Posting safeguards
    const MAX_PER_HOUR = 10;                     // 1人あたり1時間に最大10件
    const MAX_PER_PERSONA_PER_RUN = 1;           // 1回の実行で各ペルソナ最大1件
    const publishedCountCache = new Map<string, number>();
    const processedRunCount = new Map<string, number>();

    const getPublishedLastHour = async (personaId: string): Promise<number> => {
      if (publishedCountCache.has(personaId)) return publishedCountCache.get(personaId)!;
      const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('persona_id', personaId)
        .eq('status', 'published')
        .gt('published_at', since);
      if (error) {
        console.error('Failed to count posts last hour:', { personaId, error });
      }
      const c = count || 0;
      publishedCountCache.set(personaId, c);
      return c;
    };

    // 長時間processingのままのキューアイテムをクリーンアップ（スタックした処理を防ぐ）
    const timeoutMinutes = 10;
    const timeoutThreshold = new Date(now.getTime() - timeoutMinutes * 60 * 1000);
    
    const { data: timeoutItems, error: timeoutError } = await supabase
      .from('post_queue')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('status', 'processing')
      .lt('updated_at', timeoutThreshold.toISOString())
      .select('id');

    if (timeoutError) {
      console.error('Error cleaning up timeout queue items:', timeoutError);
    } else if (timeoutItems && timeoutItems.length > 0) {
      console.warn(`🔧 Auto-fixed ${timeoutItems.length} stuck processing queue items`);
    }

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    // キューアイテムを優先して処理（重複を避けるため）
    for (const queueItem of queueItems || []) {
      try {
        console.log(`Processing queue item ${queueItem.id} for post ${queueItem.post_id}`);
        processedCount++;

        // 厳守: scheduled_for より前は処理しない
        if (queueItem.scheduled_for) {
          const itemScheduledFor = new Date(queueItem.scheduled_for);
          if (itemScheduledFor.getTime() > now.getTime()) {
            console.warn(`Skip early queue item ${queueItem.id}; scheduled for ${itemScheduledFor.toISOString()} (now ${now.toISOString()})`);
            continue;
          }
        }

        // Per-persona throttling and hourly cap
        const personaId = queueItem.posts?.persona_id as string;
        const runCount = processedRunCount.get(personaId) || 0;
        if (runCount >= MAX_PER_PERSONA_PER_RUN) {
          console.warn('Skip due to per-run cap for persona (queue):', personaId);
          continue;
        }
        const publishedLastHour = await getPublishedLastHour(personaId);
        if (publishedLastHour >= MAX_PER_HOUR) {
          const deferTo = new Date(now.getTime() + 60 * 60 * 1000);
          await supabase
            .from('post_queue')
            .update({ scheduled_for: deferTo.toISOString() })
            .eq('id', queueItem.id);
          console.warn(`Skip due to hourly cap (${publishedLastHour}/${MAX_PER_HOUR}) for persona ${personaId} (queue). Deferred to ${deferTo.toISOString()}`);
          continue;
        }
        processedRunCount.set(personaId, runCount + 1);

        // アトミックな状態更新：queuedからprocessingに変更（既に処理中の場合はスキップ）
        const { data: lockResult, error: lockError } = await supabase
          .from('post_queue')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', queueItem.id)
          .eq('status', 'queued') // 重要：queuedの場合のみ更新
          .select('id');

        if (lockError) {
          console.error('Error locking queue item:', lockError);
          continue;
        }

        if (!lockResult || lockResult.length === 0) {
          console.warn(`⏭️ Queue item ${queueItem.id} already processed by another instance, skipping`);
          continue;
        }

        console.log(`🔒 Successfully locked queue item ${queueItem.id} for processing`);

        // Threads投稿を実行
        const { data: postResult, error: postError } = await supabase.functions.invoke('threads-post', {
          body: {
            postId: queueItem.post_id,
            userId: queueItem.user_id
          }
        });

        if (postError) {
          console.error(`Threads post error for queue item ${queueItem.id}:`, postError);
          throw postError;
        }

        // threads-post関数内で既にキューステータスは'completed'に更新済み
        // ここでは追加の更新は不要（重複更新を防止）
        console.log(`✅ Queue item ${queueItem.id} processing completed successfully`);
        
        successCount++;

      } catch (error) {
        console.error(`Error processing queue item ${queueItem.id}:`, error);
        
        // 失敗した場合はステータスをfailedに更新
        try {
          await supabase
            .from('post_queue')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', queueItem.id);
        } catch (updateError) {
          console.error('Failed to update queue item status to failed:', updateError);
        }
        
        failedCount++;

        // 失敗時の処理
        const post = queueItem.posts;
        const newRetryCount = (post.retry_count || 0) + 1;
        const maxRetries = post.max_retries || 3;

        try {
          if (newRetryCount <= maxRetries) {
            // リトライ回数内の場合は再スケジュール
            const nextRetryTime = new Date();
            nextRetryTime.setMinutes(nextRetryTime.getMinutes() + (newRetryCount * 15));

            await supabase
              .from('posts')
              .update({
                retry_count: newRetryCount,
                last_retry_at: now.toISOString(),
                scheduled_for: nextRetryTime.toISOString()
              })
              .eq('id', queueItem.post_id);

            // 🚨 CRITICAL FIX: post_queue更新を確実に実行（複数回試行）
            let queueUpdateSuccess = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                const { error: queueUpdateError } = await supabase
                  .from('post_queue')
                  .update({
                    status: 'queued',
                    scheduled_for: nextRetryTime.toISOString(),
                    updated_at: now.toISOString()
                  })
                  .eq('id', queueItem.id);

                if (!queueUpdateError) {
                  queueUpdateSuccess = true;
                  break;
                }
                console.warn(`Queue update attempt ${attempt}/3 failed for ${queueItem.id}:`, queueUpdateError);
              } catch (attemptError) {
                console.warn(`Queue update attempt ${attempt}/3 exception for ${queueItem.id}:`, attemptError);
              }
            }
            
            if (!queueUpdateSuccess) {
              console.error(`CRITICAL: All queue update attempts failed for ${queueItem.id}, marking as failed`);
              try {
                await supabase.from('post_queue').update({ status: 'failed' }).eq('id', queueItem.id);
              } catch (fallbackError) {
                console.error(`CRITICAL: Fallback update also failed for ${queueItem.id}:`, fallbackError);
              }
            }
          } else {
            // 最大リトライ回数を超えた場合は失敗状態に
            await supabase
              .from('posts')
              .update({
                status: 'failed',
                retry_count: newRetryCount,
                last_retry_at: now.toISOString()
              })
              .eq('id', queueItem.post_id);

            // 🚨 CRITICAL FIX: post_queue更新を確実に実行（複数回試行）
            let queueFailSuccess = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                const { error: queueFailError } = await supabase
                  .from('post_queue')
                  .update({ 
                    status: 'failed',
                    updated_at: now.toISOString()
                  })
                  .eq('id', queueItem.id);

                if (!queueFailError) {
                  queueFailSuccess = true;
                  break;
                }
                console.warn(`Queue fail update attempt ${attempt}/3 failed for ${queueItem.id}:`, queueFailError);
              } catch (attemptError) {
                console.warn(`Queue fail update attempt ${attempt}/3 exception for ${queueItem.id}:`, attemptError);
              }
            }
            
            if (!queueFailSuccess) {
              console.error(`CRITICAL: Failed to update queue to failed after all attempts: ${queueItem.id}`);
            }
          }
        } catch (updateError) {
          // 🚨 CRITICAL FIX: 更新処理でエラーが発生した場合の最終安全網（確実実行）
          console.error(`CRITICAL: Queue update failed for ${queueItem.id}, forcing to failed:`, updateError);
          let finalSafetySuccess = false;
          for (let attempt = 1; attempt <= 5; attempt++) {
            try {
              const { error: finalError } = await supabase
                .from('post_queue')
                .update({ 
                  status: 'failed',
                  updated_at: now.toISOString()
                })
                .eq('id', queueItem.id);
              
              if (!finalError) {
                finalSafetySuccess = true;
                console.log(`Final safety update succeeded on attempt ${attempt} for ${queueItem.id}`);
                break;
              }
              console.warn(`Final safety attempt ${attempt}/5 failed for ${queueItem.id}:`, finalError);
            } catch (safetyError) {
              console.warn(`Final safety attempt ${attempt}/5 exception for ${queueItem.id}:`, safetyError);
            }
            // 指数バックオフで待機
            if (attempt < 5) {
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
            }
          }
          
          if (!finalSafetySuccess) {
            console.error(`EMERGENCY: All final safety attempts failed for ${queueItem.id}. Manual intervention required.`);
          }
        }
      }
    }

    // キューにない直接スケジュール済み投稿を処理
    for (const post of scheduledPosts || []) {
      try {
        console.log(`Processing scheduled post ${post.id}, scheduled for: ${post.scheduled_for}`);
        processedCount++;

        // Per-persona throttling and hourly cap
        const personaId = post.persona_id as string;
        const runCount = processedRunCount.get(personaId) || 0;
        if (runCount >= MAX_PER_PERSONA_PER_RUN) {
          console.warn('Skip due to per-run cap for persona (scheduled):', personaId);
          continue;
        }
        const publishedLastHour = await getPublishedLastHour(personaId);
        if (publishedLastHour >= MAX_PER_HOUR) {
          const deferTo = new Date(now.getTime() + 60 * 60 * 1000);
          await supabase
            .from('posts')
            .update({ scheduled_for: deferTo.toISOString() })
            .eq('id', post.id);
          console.warn(`Skip due to hourly cap (${publishedLastHour}/${MAX_PER_HOUR}) for persona ${personaId} (scheduled). Deferred to ${deferTo.toISOString()}`);
          continue;
        }
        processedRunCount.set(personaId, runCount + 1);

        // 投稿時刻をチェック
        const scheduledTime = new Date(post.scheduled_for);
        const timeDiff = now.getTime() - scheduledTime.getTime();
        
        console.log(`Time difference: ${timeDiff}ms (${Math.round(timeDiff / 1000 / 60)} minutes)`);
        if (timeDiff < 0) {
          console.warn(`Skip early scheduled post ${post.id}; scheduled for ${scheduledTime.toISOString()} (now ${now.toISOString()})`);
          continue;
        }

        // ✅ CRITICAL FIX: アトミックロックで重複投稿を防止
        console.log('Attempting to lock post with atomic update...');
        const { data: lockResult, error: updatePostError } = await supabase
          .from('posts')
          .update({ status: 'processing', updated_at: now.toISOString() })
          .eq('id', post.id)
          .eq('status', 'scheduled') // ✅ 重要: scheduledの場合のみ更新
          .select('id');

        if (updatePostError) {
          console.error('Error locking post:', updatePostError);
          continue;
        }

        if (!lockResult || lockResult.length === 0) {
          console.warn(`⏭️ Post ${post.id} already processed by another instance, skipping`);
          continue;
        }

        console.log(`🔒 Successfully locked post ${post.id} for processing`);

        // Threads投稿を実行
        console.log('Invoking threads-post function...');
        const { data: postResult, error: postError } = await supabase.functions.invoke('threads-post', {
          body: {
            postId: post.id,
            userId: post.user_id
          }
        });

        console.log('Threads post result:', { postResult, postError });

        if (postError) {
          console.error(`Threads post error for ${post.id}:`, postError);
          throw postError;
        }

        console.log(`Successfully posted ${post.id} to Threads`);
        successCount++;

      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error);
        failedCount++;

        // 失敗時の処理
        const newRetryCount = (post.retry_count || 0) + 1;
        const maxRetries = post.max_retries || 3;

        console.log(`Retry count: ${newRetryCount}/${maxRetries} for post ${post.id}`);

        if (newRetryCount <= maxRetries) {
          // リトライ回数内の場合は再スケジュール
          const nextRetryTime = new Date();
          nextRetryTime.setMinutes(nextRetryTime.getMinutes() + (newRetryCount * 15)); // 15分後にリトライ

          console.log(`Scheduling retry ${newRetryCount} for post ${post.id} at ${nextRetryTime.toISOString()}`);

          await supabase
            .from('posts')
            .update({
              status: 'scheduled',
              retry_count: newRetryCount,
              last_retry_at: now.toISOString(),
              scheduled_for: nextRetryTime.toISOString()
            })
            .eq('id', post.id);
        } else {
          // 最大リトライ回数を超えた場合は失敗状態に
          console.log(`Post ${post.id} failed after ${maxRetries} retries`);

          await supabase
            .from('posts')
            .update({
              status: 'failed',
              retry_count: newRetryCount,
              last_retry_at: now.toISOString()
            })
            .eq('id', post.id);
        }
      }
    }

    const message = `Auto-scheduler completed. Processed: ${processedCount}, Success: ${successCount}, Failed: ${failedCount}`;
    console.log('=== ' + message + ' ===');

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: processedCount,
        successful: successCount,
        failed: failedCount,
        message: message,
        timestamp: now.toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('=== Auto-scheduler error ===', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        success: false,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});
