
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
    console.log('Current time:', now.toISOString());

    // キューから処理待ちの投稿を取得（5分の猶予を設けて取得）
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
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
      .lte('scheduled_for', fiveMinutesFromNow.toISOString())
      .order('queue_position', { ascending: true })
      .limit(10);

    if (queueError) {
      console.error('Queue query error:', queueError);
      throw queueError;
    }

    console.log(`Found ${queueItems?.length || 0} posts to process`);

    for (const queueItem of queueItems || []) {
      try {
        console.log(`Processing post ${queueItem.post_id}, scheduled for: ${queueItem.scheduled_for}`);

        // キューアイテムを処理中に更新
        await supabase
          .from('post_queue')
          .update({ status: 'processing' })
          .eq('id', queueItem.id);

        // Threads投稿を実行
        const { error: postError } = await supabase.functions.invoke('threads-post', {
          body: {
            postId: queueItem.post_id,
            userId: queueItem.user_id
          }
        });

        if (postError) {
          console.error(`Threads post error for ${queueItem.post_id}:`, postError);
          throw postError;
        }

        // 成功時はキューアイテムを完了状態に更新
        await supabase
          .from('post_queue')
          .update({ status: 'completed' })
          .eq('id', queueItem.id);

        console.log(`Successfully posted ${queueItem.post_id}`);

      } catch (error) {
        console.error(`Error processing post ${queueItem.post_id}:`, error);

        // 失敗時の処理
        const post = queueItem.posts;
        const newRetryCount = (post.retry_count || 0) + 1;
        const maxRetries = post.max_retries || 3;

        if (newRetryCount <= maxRetries) {
          // リトライ回数内の場合は再スケジュール
          const retryDelay = newRetryCount * 15; // 15分 * リトライ回数
          const nextRetryTime = new Date(now.getTime() + retryDelay * 60 * 1000);

          console.log(`Scheduling retry ${newRetryCount} for post ${queueItem.post_id} at ${nextRetryTime.toISOString()}`);

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

          console.log(`Scheduled retry ${newRetryCount} for post ${queueItem.post_id}`);
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

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: queueItems?.length || 0,
        message: 'Auto-scheduler completed successfully',
        timestamp: now.toISOString()
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
