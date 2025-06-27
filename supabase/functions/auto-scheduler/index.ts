
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
    console.log('Starting auto-scheduler...');
    
    const now = new Date();
    console.log(`Current time: ${now.toISOString()}`);

    // キューから処理待ちの投稿を取得（時間範囲を少し広げる）
    const timeBuffer = new Date(now.getTime() + 5 * 60 * 1000); // 5分後まで
    
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
      throw queueError;
    }

    console.log(`Found ${queueItems?.length || 0} posts to process`);

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const queueItem of queueItems || []) {
      try {
        console.log(`Processing post ${queueItem.post_id}, scheduled for: ${queueItem.scheduled_for}`);
        processedCount++;

        // 投稿時刻をチェック
        const scheduledTime = new Date(queueItem.scheduled_for);
        const timeDiff = now.getTime() - scheduledTime.getTime();
        
        console.log(`Time difference: ${timeDiff}ms (${Math.round(timeDiff / 1000 / 60)} minutes)`);

        // キューアイテムを処理中に更新
        await supabase
          .from('post_queue')
          .update({ status: 'processing' })
          .eq('id', queueItem.id);

        // Threads投稿を実行
        const { data: postResult, error: postError } = await supabase.functions.invoke('threads-post', {
          body: {
            postId: queueItem.post_id,
            userId: queueItem.user_id
          }
        });

        if (postError) {
          console.error(`Threads post error for ${queueItem.post_id}:`, postError);
          throw postError;
        }

        console.log(`Threads post result for ${queueItem.post_id}:`, postResult);

        // 成功時はキューアイテムと投稿を完了状態に更新
        await supabase
          .from('post_queue')
          .update({ status: 'completed' })
          .eq('id', queueItem.id);

        await supabase
          .from('posts')
          .update({ 
            status: 'published',
            published_at: now.toISOString()
          })
          .eq('id', queueItem.post_id);

        console.log(`Successfully posted and updated ${queueItem.post_id}`);
        successCount++;

      } catch (error) {
        console.error(`Error processing post ${queueItem.post_id}:`, error);
        failedCount++;

        // 失敗時の処理
        const post = queueItem.posts;
        const newRetryCount = (post.retry_count || 0) + 1;
        const maxRetries = post.max_retries || 3;

        if (newRetryCount <= maxRetries) {
          // リトライ回数内の場合は再スケジュール
          const nextRetryTime = new Date();
          nextRetryTime.setMinutes(nextRetryTime.getMinutes() + (newRetryCount * 15)); // 15分後にリトライ

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

          console.log(`Scheduled retry ${newRetryCount} for post ${queueItem.post_id} at ${nextRetryTime.toISOString()}`);
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

          console.log(`Post ${queueItem.post_id} failed after ${maxRetries} retries`);
        }
      }
    }

    const message = `Auto-scheduler completed. Processed: ${processedCount}, Success: ${successCount}, Failed: ${failedCount}`;
    console.log(message);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: processedCount,
        successful: successCount,
        failed: failedCount,
        message: message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in auto-scheduler:', error);
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
