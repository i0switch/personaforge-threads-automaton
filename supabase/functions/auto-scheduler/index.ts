
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // 現在時刻より前にスケジュールされた投稿を取得（バッファ時間を1分に縮小）
    const timeBuffer = new Date(now.getTime() + 1 * 60 * 1000); // 1分後まで
    
    console.log(`Searching for posts scheduled before: ${timeBuffer.toISOString()}`);
    
    // キューにある投稿を優先的に処理（重複を避けるため）
    const { data: queueItems, error: queueError } = await supabase
      .from('post_queue')
      .select(`
        *,
        posts!inner(
          *,
          personas!inner(threads_access_token)
        )
      `)
      .eq('status', 'queued')
      .lte('scheduled_for', timeBuffer.toISOString())
      .order('queue_position', { ascending: true })
      .limit(10);

    if (queueError) {
      console.error('Error fetching queue items:', queueError);
      // キューエラーは致命的ではないので続行
    }

    console.log(`Found ${queueItems?.length || 0} queue items to process`);

    // キューにない直接スケジュール済みの投稿を取得（重複を避けるため）
    const queuePostIds = queueItems?.map(item => item.post_id) || [];
    
    const { data: scheduledPostsRaw, error: scheduledError } = await supabase
      .from('posts')
      .select(`
        *,
        personas!inner(threads_access_token)
      `)
      .eq('status', 'scheduled')
      .not('scheduled_for', 'is', null)
      .lte('scheduled_for', timeBuffer.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(20);

    // キューに存在するpost_idを除外（クライアント側で安全にフィルタ）
    const scheduledPosts = (scheduledPostsRaw || []).filter(post => !queuePostIds.includes(post.id));

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
    const MAX_PER_HOUR = 2;                      // 1人あたり1時間に最大2件
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

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    // キューアイテムを優先して処理（重複を避けるため）
    for (const queueItem of queueItems || []) {
      try {
        console.log(`Processing queue item ${queueItem.id} for post ${queueItem.post_id}`);
        processedCount++;

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

        // キューアイテムを処理中に更新
        const { error: updateQueueError } = await supabase
          .from('post_queue')
          .update({ status: 'processing' })
          .eq('id', queueItem.id);

        if (updateQueueError) {
          console.error('Error updating queue status:', updateQueueError);
        }

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
        console.log(`Queue item ${queueItem.id} already updated to completed by threads-post`);
        
        successCount++;

      } catch (error) {
        console.error(`Error processing queue item ${queueItem.id}:`, error);
        failedCount++;

        // 失敗時の処理
        const post = queueItem.posts;
        const newRetryCount = (post.retry_count || 0) + 1;
        const maxRetries = post.max_retries || 3;

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

          await supabase
            .from('post_queue')
            .update({
              status: 'queued',
              scheduled_for: nextRetryTime.toISOString()
            })
            .eq('id', queueItem.id);
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

          await supabase
            .from('post_queue')
            .update({ status: 'failed' })
            .eq('id', queueItem.id);
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

        // 投稿を処理中に更新
        console.log('Updating post to processing status...');
        const { error: updatePostError } = await supabase
          .from('posts')
          .update({ status: 'processing' })
          .eq('id', post.id);

        if (updatePostError) {
          console.error('Error updating post status:', updatePostError);
        }

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
        error: error.message,
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
