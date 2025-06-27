
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

    // 現在時刻を基準に処理対象を決定（5分の猶予を持たせる）
    const scheduledTimeCutoff = new Date(now.getTime() + 5 * 60 * 1000); // 5分後まで
    
    // 予約済みで実行時間が来ている投稿を取得
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select(`
        *,
        personas!inner(
          threads_access_token,
          name
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_for', scheduledTimeCutoff.toISOString())
      .not('personas.threads_access_token', 'is', null)
      .order('scheduled_for', { ascending: true })
      .limit(10);

    if (postsError) {
      throw postsError;
    }

    console.log(`Found ${postsData?.length || 0} posts to process`);

    for (const post of postsData || []) {
      try {
        console.log(`Processing post ${post.id} scheduled for ${post.scheduled_for}`);

        // 投稿を処理中に更新
        await supabase
          .from('posts')
          .update({ status: 'processing' })
          .eq('id', post.id);

        // Threads投稿を実行
        const { error: postError } = await supabase.functions.invoke('threads-post', {
          body: {
            postId: post.id,
            userId: post.user_id
          }
        });

        if (postError) {
          throw postError;
        }

        console.log(`Successfully posted ${post.id}`);

      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error);

        // 失敗時の処理
        const newRetryCount = (post.retry_count || 0) + 1;
        const maxRetries = post.max_retries || 3;

        if (newRetryCount <= maxRetries) {
          // リトライ回数内の場合は再スケジュール
          const nextRetryTime = new Date();
          nextRetryTime.setMinutes(nextRetryTime.getMinutes() + (newRetryCount * 15)); // 15分後にリトライ

          await supabase
            .from('posts')
            .update({
              status: 'scheduled',
              retry_count: newRetryCount,
              last_retry_at: new Date().toISOString(),
              scheduled_for: nextRetryTime.toISOString()
            })
            .eq('id', post.id);

          console.log(`Scheduled retry ${newRetryCount} for post ${post.id} at ${nextRetryTime.toISOString()}`);
        } else {
          // 最大リトライ回数を超えた場合は失敗状態に
          await supabase
            .from('posts')
            .update({
              status: 'failed',
              retry_count: newRetryCount,
              last_retry_at: new Date().toISOString()
            })
            .eq('id', post.id);

          console.log(`Post ${post.id} failed after ${maxRetries} retries`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: postsData?.length || 0,
        message: 'Auto-scheduler completed successfully'
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
