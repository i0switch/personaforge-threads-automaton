
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

    // 予約時刻が過ぎた投稿を取得（より広い範囲で検索）
    const { data: scheduledPosts, error: postsError } = await supabase
      .from('posts')
      .select(`
        *,
        personas!inner(threads_access_token, name)
      `)
      .eq('status', 'scheduled')
      .not('scheduled_for', 'is', null)
      .lte('scheduled_for', now.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(10);

    if (postsError) {
      console.error('Error fetching scheduled posts:', postsError);
      throw postsError;
    }

    console.log(`Found ${scheduledPosts?.length || 0} posts to process`);

    if (!scheduledPosts || scheduledPosts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          processed: 0,
          message: 'No posts to process'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    let successCount = 0;
    let failureCount = 0;

    for (const post of scheduledPosts) {
      try {
        console.log(`Processing post ${post.id} scheduled for ${post.scheduled_for}`);

        // Threads APIアクセストークンの確認
        if (!post.personas?.threads_access_token) {
          console.error(`No Threads access token for post ${post.id}`);
          
          // ステータスを失敗に更新
          await supabase
            .from('posts')
            .update({ 
              status: 'failed',
              retry_count: (post.retry_count || 0) + 1,
              last_retry_at: now.toISOString()
            })
            .eq('id', post.id);
          
          failureCount++;
          continue;
        }

        // Threads投稿を実行
        const { error: postError } = await supabase.functions.invoke('threads-post', {
          body: {
            postId: post.id,
            userId: post.user_id
          }
        });

        if (postError) {
          console.error(`Error posting to Threads for post ${post.id}:`, postError);
          throw postError;
        }

        console.log(`Successfully posted ${post.id} to Threads`);
        successCount++;

        // アクティビティログを記録
        await supabase
          .from('activity_logs')
          .insert({
            user_id: post.user_id,
            persona_id: post.persona_id,
            action_type: 'post_auto_published',
            description: `投稿が自動的にThreadsに公開されました`
          });

      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error);
        failureCount++;

        // リトライ処理
        const newRetryCount = (post.retry_count || 0) + 1;
        const maxRetries = post.max_retries || 3;

        if (newRetryCount <= maxRetries) {
          // リトライ回数内の場合は再スケジュール（30分後）
          const nextRetryTime = new Date(now);
          nextRetryTime.setMinutes(nextRetryTime.getMinutes() + 30);

          await supabase
            .from('posts')
            .update({
              retry_count: newRetryCount,
              last_retry_at: now.toISOString(),
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
              last_retry_at: now.toISOString()
            })
            .eq('id', post.id);

          console.log(`Post ${post.id} failed after ${maxRetries} retries`);
        }
      }
    }

    console.log(`Auto-scheduler completed: ${successCount} success, ${failureCount} failures`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: scheduledPosts.length,
        successful: successCount,
        failed: failureCount,
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
