import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://threads-genius-ai.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TestResult {
  test_name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (Deno.env.get('ENABLE_TEST_FUNCTIONS') !== 'true') {
    return new Response(JSON.stringify({ success: false, error: 'Disabled in production' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('=== Starting Duplicate Post Prevention Tests ===');
    const results: TestResult[] = [];
    const now = new Date();

    // Test 1: アトミックロック機能のテスト（シミュレーション）
    console.log('\n📋 Test 1: Atomic lock mechanism simulation');
    try {
      // scheduled状態のテスト投稿を作成
      const { data: testPost, error: createError } = await supabase
        .from('posts')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000', // テスト用UUID
          persona_id: '00000000-0000-0000-0000-000000000000',
          content: `[TEST] Duplicate prevention test ${now.toISOString()}`,
          status: 'scheduled',
          scheduled_for: now.toISOString(),
          auto_schedule: true
        })
        .select()
        .single();

      if (createError || !testPost) {
        throw new Error(`Failed to create test post: ${createError?.message}`);
      }

      console.log(`Created test post: ${testPost.id}`);

      // 2つのインスタンスが同時にアトミックロックを試みるシミュレーション
      const lock1Promise = supabase
        .from('posts')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', testPost.id)
        .eq('status', 'scheduled')
        .select('id');

      const lock2Promise = supabase
        .from('posts')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', testPost.id)
        .eq('status', 'scheduled')
        .select('id');

      const [lock1Result, lock2Result] = await Promise.all([lock1Promise, lock2Promise]);

      const lock1Success = lock1Result.data && lock1Result.data.length > 0;
      const lock2Success = lock2Result.data && lock2Result.data.length > 0;

      if (lock1Success && !lock2Success) {
        results.push({
          test_name: 'Atomic Lock - Concurrent Access Prevention',
          status: 'PASS',
          details: `✅ Only one instance acquired the lock. Lock1: success, Lock2: failed (expected)`,
          timestamp: now.toISOString()
        });
      } else if (!lock1Success && lock2Success) {
        results.push({
          test_name: 'Atomic Lock - Concurrent Access Prevention',
          status: 'PASS',
          details: `✅ Only one instance acquired the lock. Lock1: failed, Lock2: success (expected)`,
          timestamp: now.toISOString()
        });
      } else if (lock1Success && lock2Success) {
        results.push({
          test_name: 'Atomic Lock - Concurrent Access Prevention',
          status: 'FAIL',
          details: `❌ Both instances acquired the lock (CRITICAL BUG - race condition detected)`,
          timestamp: now.toISOString()
        });
      } else {
        results.push({
          test_name: 'Atomic Lock - Concurrent Access Prevention',
          status: 'FAIL',
          details: `❌ Neither instance acquired the lock (unexpected)`,
          timestamp: now.toISOString()
        });
      }

      // テスト投稿をクリーンアップ
      await supabase.from('posts').delete().eq('id', testPost.id);
      console.log(`Cleaned up test post: ${testPost.id}`);
    } catch (error) {
      results.push({
        test_name: 'Atomic Lock - Concurrent Access Prevention',
        status: 'FAIL',
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: now.toISOString()
      });
    }

    // Test 2: 重複キューアイテムの検出
    console.log('\n📋 Test 2: Duplicate queue items detection');
    try {
      const duplicates = await supabase.rpc('get_duplicate_queue_items');
      
      if (duplicates.error) {
        throw new Error(`Failed to check duplicates: ${duplicates.error.message}`);
      }

      if (!duplicates.data || duplicates.data.length === 0) {
        results.push({
          test_name: 'Duplicate Queue Items Detection',
          status: 'PASS',
          details: `✅ No duplicate queue items found in database`,
          timestamp: now.toISOString()
        });
      } else {
        results.push({
          test_name: 'Duplicate Queue Items Detection',
          status: 'FAIL',
          details: `❌ Found ${duplicates.data.length} duplicate queue items: ${JSON.stringify(duplicates.data)}`,
          timestamp: now.toISOString()
        });
      }
    } catch (error) {
      results.push({
        test_name: 'Duplicate Queue Items Detection',
        status: 'FAIL',
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: now.toISOString()
      });
    }

    // Test 3: 処理中状態のタイムアウト確認
    console.log('\n📋 Test 3: Processing timeout cleanup');
    try {
      const timeoutMinutes = 10;
      const timeoutThreshold = new Date(now.getTime() - timeoutMinutes * 60 * 1000);

      const { data: timeoutItems } = await supabase
        .from('post_queue')
        .select('id, status, updated_at')
        .eq('status', 'processing')
        .lt('updated_at', timeoutThreshold.toISOString());

      if (!timeoutItems || timeoutItems.length === 0) {
        results.push({
          test_name: 'Processing Timeout Cleanup',
          status: 'PASS',
          details: `✅ No stuck processing items found (timeout threshold: ${timeoutMinutes} minutes)`,
          timestamp: now.toISOString()
        });
      } else {
        results.push({
          test_name: 'Processing Timeout Cleanup',
          status: 'FAIL',
          details: `❌ Found ${timeoutItems.length} stuck processing items that need cleanup`,
          timestamp: now.toISOString()
        });
      }
    } catch (error) {
      results.push({
        test_name: 'Processing Timeout Cleanup',
        status: 'FAIL',
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: now.toISOString()
      });
    }

    // Test 4: キューとポストステータスの整合性確認
    console.log('\n📋 Test 4: Queue and Post Status Consistency');
    try {
      const { data: inconsistentItems } = await supabase
        .from('post_queue')
        .select(`
          id,
          status,
          post_id,
          posts!inner(id, status)
        `)
        .neq('status', 'completed');

      if (!inconsistentItems) {
        throw new Error('Failed to fetch queue items');
      }

      const inconsistencies = inconsistentItems.filter((item: any) => {
        const queueStatus = item.status;
        const postStatus = item.posts?.status;
        
        // published投稿のキューはcompletedであるべき
        if (postStatus === 'published' && queueStatus !== 'completed') {
          return true;
        }
        // failed投稿のキューはfailedであるべき
        if (postStatus === 'failed' && queueStatus !== 'failed') {
          return true;
        }
        return false;
      });

      if (inconsistencies.length === 0) {
        results.push({
          test_name: 'Queue and Post Status Consistency',
          status: 'PASS',
          details: `✅ All queue items are consistent with their post status`,
          timestamp: now.toISOString()
        });
      } else {
        results.push({
          test_name: 'Queue and Post Status Consistency',
          status: 'FAIL',
          details: `❌ Found ${inconsistencies.length} inconsistent queue items`,
          timestamp: now.toISOString()
        });
      }
    } catch (error) {
      results.push({
        test_name: 'Queue and Post Status Consistency',
        status: 'FAIL',
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: now.toISOString()
      });
    }

    // 結果サマリーの生成
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const totalCount = results.length;

    const summary = {
      total_tests: totalCount,
      passed: passCount,
      failed: failCount,
      success_rate: totalCount > 0 ? ((passCount / totalCount) * 100).toFixed(2) + '%' : '0%',
      overall_status: failCount === 0 ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌',
      timestamp: now.toISOString()
    };

    console.log('\n=== Test Summary ===');
    console.log(JSON.stringify(summary, null, 2));
    console.log('\n=== Detailed Results ===');
    console.log(JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results,
        recommendations: failCount > 0 ? [
          'Review failed tests and address the identified issues',
          'Check auto-scheduler and threads-post edge function logs for more details',
          'Verify database triggers and functions are working correctly',
          'Consider running manual post tests to verify fixes'
        ] : [
          'All duplicate prevention mechanisms are working correctly',
          'Continue monitoring production logs for any edge cases'
        ]
      }, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Test execution error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
