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
    console.log('🔬 品質保証テスト開始...');

    // 1. 機能別テスト結果
    const testResults = {
      auto_posting: await testAutoPosting(),
      auto_reply: await testAutoReply(),
      data_integrity: await testDataIntegrity(),
      performance: await testPerformance(),
      error_monitoring: await testErrorMonitoring()
    };

    // 2. 総合評価
    const evaluation = evaluateQuality(testResults);

    console.log('🔬 品質保証テスト完了');

    return new Response(
      JSON.stringify({
        test_timestamp: new Date().toISOString(),
        overall_quality: evaluation.grade,
        quality_score: evaluation.score,
        test_results: testResults,
        recommendations: evaluation.recommendations,
        critical_issues: evaluation.critical_issues
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('品質テストエラー:', error);
    
    return new Response(
      JSON.stringify({
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

async function testAutoPosting() {
  console.log('📝 自動投稿機能テスト');
  
  const { data: activeConfigs, error } = await supabase
    .from('auto_post_configs')
    .select(`
      id, is_active, next_run_at, multi_time_enabled, post_times,
      personas(name, is_active, threads_access_token)
    `)
    .eq('is_active', true);

  if (error) {
    return { status: 'FAIL', error: error.message };
  }

  const readyConfigs = activeConfigs?.filter(config => 
    config.personas?.is_active && 
    config.personas?.threads_access_token &&
    config.next_run_at
  ) || [];

  const overdueConfigs = activeConfigs?.filter(config => 
    config.next_run_at && new Date(config.next_run_at) < new Date()
  ) || [];

  return {
    status: readyConfigs.length > 0 ? 'PASS' : 'WARN',
    total_configs: activeConfigs?.length || 0,
    ready_configs: readyConfigs.length,
    overdue_configs: overdueConfigs.length,
    details: {
      ready_personas: readyConfigs.map(c => c.personas?.name).slice(0, 5),
      overdue_personas: overdueConfigs.map(c => c.personas?.name).slice(0, 5)
    }
  };
}

async function testAutoReply() {
  console.log('💬 自動返信機能テスト');
  
  const { data: personas, error } = await supabase
    .from('personas')
    .select(`
      id, name, auto_reply_enabled, ai_auto_reply_enabled, is_active, threads_access_token,
      auto_replies(id, is_active, trigger_keywords, response_template)
    `)
    .eq('is_active', true);

  if (error) {
    return { status: 'FAIL', error: error.message };
  }

  const aiReplyEnabled = personas?.filter(p => p.ai_auto_reply_enabled && p.threads_access_token) || [];
  const templateReplyEnabled = personas?.filter(p => 
    p.auto_reply_enabled && 
    p.auto_replies?.some((reply: any) => reply.is_active && reply.trigger_keywords?.length > 0)
  ) || [];

  const noReplySetup = personas?.filter(p => 
    !p.ai_auto_reply_enabled && 
    (!p.auto_reply_enabled || !p.auto_replies?.some((reply: any) => reply.is_active))
  ) || [];

  return {
    status: aiReplyEnabled.length + templateReplyEnabled.length > 0 ? 'PASS' : 'WARN',
    ai_reply_count: aiReplyEnabled.length,
    template_reply_count: templateReplyEnabled.length,
    no_reply_count: noReplySetup.length,
    details: {
      ai_enabled: aiReplyEnabled.map(p => p.name).slice(0, 5),
      no_setup: noReplySetup.map(p => p.name).slice(0, 5)
    }
  };
}

async function testDataIntegrity() {
  console.log('🔍 データ整合性テスト');
  
  // 孤立したキューアイテム
  const { data: orphanedQueue } = await supabase
    .from('post_queue')
    .select('post_id')
    .not('post_id', 'in', `(SELECT id FROM posts)`);

  // 重複キューアイテム
  const { data: duplicateQueue } = await supabase.rpc('get_duplicate_queue_items');

  // 無効な次回実行時刻
  const { data: invalidSchedules, error } = await supabase
    .from('auto_post_configs')
    .select('id, next_run_at, personas(name)')
    .eq('is_active', true)
    .is('next_run_at', null);

  return {
    status: (orphanedQueue?.length || 0) === 0 && (invalidSchedules?.length || 0) === 0 ? 'PASS' : 'FAIL',
    orphaned_items: orphanedQueue?.length || 0,
    invalid_schedules: invalidSchedules?.length || 0,
    details: {
      invalid_schedule_personas: invalidSchedules?.map(s => s.personas?.name) || []
    }
  };
}

async function testPerformance() {
  console.log('⚡ パフォーマンステスト');
  
  const startTime = Date.now();
  
  // 大量データクエリテスト
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, status, created_at, persona_id')
    .limit(500);

  const queryTime = Date.now() - startTime;

  if (error) {
    return { status: 'FAIL', error: error.message };
  }

  // メモリ効率テスト (簡易版)
  const memoryStart = Date.now();
  const testData = new Array(1000).fill(0).map((_, i) => ({ id: i, data: `test_${i}` }));
  const memoryTime = Date.now() - memoryStart;

  return {
    status: queryTime < 2000 ? 'PASS' : queryTime < 5000 ? 'WARN' : 'FAIL',
    db_query_time_ms: queryTime,
    records_processed: posts?.length || 0,
    memory_allocation_ms: memoryTime,
    details: {
      query_performance: queryTime < 1000 ? 'EXCELLENT' : queryTime < 2000 ? 'GOOD' : 'SLOW'
    }
  };
}

async function testErrorMonitoring() {
  console.log('🚨 エラーモニタリングテスト');
  
  const { data: recentErrors, error } = await supabase
    .from('security_events')
    .select('event_type, details, created_at')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return { status: 'FAIL', error: error.message };
  }

  const errorTypes = recentErrors?.reduce((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const criticalErrors = recentErrors?.filter(event => 
    event.event_type.includes('error') || 
    event.event_type.includes('fail')
  ) || [];

  return {
    status: criticalErrors.length === 0 ? 'PASS' : criticalErrors.length < 5 ? 'WARN' : 'FAIL',
    total_events: recentErrors?.length || 0,
    critical_errors: criticalErrors.length,
    error_types: errorTypes,
    details: {
      recent_critical: criticalErrors.slice(0, 3).map(e => ({ type: e.event_type, time: e.created_at }))
    }
  };
}

function evaluateQuality(results: any) {
  let score = 0;
  const recommendations: string[] = [];
  const critical_issues: string[] = [];

  // スコア計算 (100点満点)
  Object.entries(results).forEach(([key, result]: [string, any]) => {
    switch (result.status) {
      case 'PASS':
        score += 20;
        break;
      case 'WARN':
        score += 10;
        recommendations.push(`${key}: 改善が推奨されます`);
        break;
      case 'FAIL':
        score += 0;
        critical_issues.push(`${key}: 緊急修正が必要です`);
        break;
    }
  });

  let grade;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  // 品質特有の推奨事項
  if (results.auto_posting.ready_configs < results.auto_posting.total_configs) {
    recommendations.push('一部の自動投稿設定にトークンが不足しています');
  }

  if (results.auto_reply.no_reply_count > 0) {
    recommendations.push('自動返信が未設定のペルソナがあります');
  }

  return {
    score,
    grade,
    recommendations,
    critical_issues
  };
}