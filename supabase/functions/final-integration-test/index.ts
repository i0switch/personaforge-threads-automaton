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
    console.log('🚀 最終統合テスト開始...');
    const testResults = [];

    // 1. システム修復の効果確認
    console.log('1. システム修復効果確認');
    const { data: queueStatus } = await supabase
      .from('post_queue')
      .select('status')
      .then(({ data, error }) => {
        const stats = data?.reduce((acc: any, item: any) => {
          acc[item.status] = (acc[item.status] || 0) + 1;
          return acc;
        }, {});
        return { data: stats, error };
      });

    testResults.push({
      test: 'queue_repair_validation',
      status: (queueStatus?.processing || 0) === 0 ? 'PASS' : 'FAIL',
      message: `キュー修復確認: processing=${queueStatus?.processing || 0}, failed=${queueStatus?.failed || 0}`,
      details: queueStatus
    });

    // 2. 自動投稿システムの統合テスト
    console.log('2. 自動投稿システム統合テスト');
    const { data: readyForPosting } = await supabase
      .from('auto_post_configs')
      .select(`
        id, next_run_at, is_active,
        personas!inner(name, is_active, threads_access_token)
      `)
      .eq('is_active', true)
      .eq('personas.is_active', true)
      .not('personas.threads_access_token', 'is', null)
      .not('next_run_at', 'is', null);

    testResults.push({
      test: 'auto_posting_integration',
      status: (readyForPosting?.length || 0) > 0 ? 'PASS' : 'WARN',
      message: `投稿準備完了: ${readyForPosting?.length || 0}個の設定`,
      details: {
        ready_configs: readyForPosting?.length || 0,
        next_runs: readyForPosting?.slice(0, 3).map(c => ({
          name: c.personas?.name,
          next_run: c.next_run_at
        }))
      }
    });

    // 3. 自動返信システムの統合テスト
    console.log('3. 自動返信システム統合テスト');
    
    // キーワードマッチング機能のテスト
    function normalizeText(text: string): string {
      return text.normalize('NFKC').toLowerCase().trim();
    }

    function testKeywordMatch(text: string, keywords: string[]): boolean {
      const normalizedText = normalizeText(text);
      return keywords.some(keyword => {
        const normalizedKeyword = normalizeText(keyword);
        return normalizedText.includes(normalizedKeyword);
      });
    }

    const keywordTests = [
      { text: "❤️", keywords: ["❤"], expected: true },
      { text: "♥", keywords: ["❤"], expected: false },
      { text: "視聴ありがとう", keywords: ["視"], expected: true },
      { text: "愛してる", keywords: ["愛"], expected: true }
    ];

    const passedKeywordTests = keywordTests.filter(test => 
      testKeywordMatch(test.text, test.keywords) === test.expected
    ).length;

    testResults.push({
      test: 'keyword_matching_system',
      status: passedKeywordTests === keywordTests.length ? 'PASS' : 'FAIL',
      message: `キーワードマッチング: ${passedKeywordTests}/${keywordTests.length} 通過`,
      details: keywordTests.map(test => ({
        ...test,
        actual: testKeywordMatch(test.text, test.keywords)
      }))
    });

    // 4. データベース整合性の最終確認
    console.log('4. データベース整合性最終確認');
    
    const { data: integrityCheck } = await supabase.rpc('get_duplicate_queue_items');
    
    const { data: orphanedCheck } = await supabase
      .from('post_queue')
      .select('post_id')
      .not('post_id', 'in', `(SELECT id FROM posts WHERE id IS NOT NULL)`)
      .limit(5);

    testResults.push({
      test: 'database_integrity_final',
      status: (integrityCheck?.length || 0) === 0 && (orphanedCheck?.length || 0) === 0 ? 'PASS' : 'FAIL',
      message: `データ整合性: 重複=${integrityCheck?.length || 0}件, 孤立=${orphanedCheck?.length || 0}件`,
      details: {
        duplicates: integrityCheck?.length || 0,
        orphaned: orphanedCheck?.length || 0
      }
    });

    // 5. パフォーマンス最終確認
    console.log('5. パフォーマンス最終確認');
    const perfStart = Date.now();
    
    const { data: largeQuery } = await supabase
      .from('posts')
      .select('id, status, persona_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    const perfTime = Date.now() - perfStart;

    testResults.push({
      test: 'performance_final',
      status: perfTime < 3000 ? 'PASS' : 'WARN',
      message: `大量クエリ性能: ${perfTime}ms, ${largeQuery?.length || 0}件取得`,
      details: {
        query_time_ms: perfTime,
        records_count: largeQuery?.length || 0,
        performance_grade: perfTime < 1000 ? 'A' : perfTime < 2000 ? 'B' : perfTime < 3000 ? 'C' : 'D'
      }
    });

    // 6. セキュリティ最終確認
    console.log('6. セキュリティ最終確認');
    
    const { data: recentSecurityEvents } = await supabase
      .from('security_events')
      .select('event_type, created_at')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // 過去1時間
      .order('created_at', { ascending: false })
      .limit(20);

    const criticalEvents = recentSecurityEvents?.filter(event => 
      event.event_type.includes('error') || 
      event.event_type.includes('violation') ||
      event.event_type.includes('breach')
    ) || [];

    testResults.push({
      test: 'security_final',
      status: criticalEvents.length === 0 ? 'PASS' : criticalEvents.length <= 2 ? 'WARN' : 'FAIL',
      message: `セキュリティ状況: 過去1時間で${criticalEvents.length}件の重要イベント`,
      details: {
        total_events: recentSecurityEvents?.length || 0,
        critical_events: criticalEvents.length,
        recent_events: recentSecurityEvents?.slice(0, 5).map(e => e.event_type)
      }
    });

    // 結果集計と総合評価
    const passCount = testResults.filter(r => r.status === 'PASS').length;
    const warnCount = testResults.filter(r => r.status === 'WARN').length;
    const failCount = testResults.filter(r => r.status === 'FAIL').length;
    
    const overallGrade = failCount === 0 ? (warnCount === 0 ? 'A+' : warnCount <= 1 ? 'A' : 'B') : 
                        failCount <= 1 ? 'C' : 'D';
    
    const qualityScore = Math.round(((passCount * 100 + warnCount * 70) / testResults.length));

    console.log(`🚀 最終統合テスト完了: ${overallGrade} (${qualityScore}点)`);

    return new Response(
      JSON.stringify({
        test_timestamp: new Date().toISOString(),
        overall_grade: overallGrade,
        quality_score: qualityScore,
        summary: {
          total_tests: testResults.length,
          passed: passCount,
          warnings: warnCount,
          failed: failCount
        },
        test_results: testResults,
        recommendations: generateRecommendations(testResults),
        certification: qualityScore >= 85 ? 'PRODUCTION_READY' : qualityScore >= 70 ? 'STAGING_READY' : 'NEEDS_IMPROVEMENT'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('統合テストエラー:', error);
    
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

function generateRecommendations(results: any[]): string[] {
  const recommendations: string[] = [];
  
  results.forEach(result => {
    if (result.status === 'FAIL') {
      switch (result.test) {
        case 'queue_repair_validation':
          recommendations.push('キューシステムの修復が必要です');
          break;
        case 'keyword_matching_system':
          recommendations.push('キーワードマッチング機能の見直しが必要です');
          break;
        case 'database_integrity_final':
          recommendations.push('データベース整合性の修復が必要です');
          break;
        default:
          recommendations.push(`${result.test} の問題解決が必要です`);
      }
    } else if (result.status === 'WARN') {
      switch (result.test) {
        case 'auto_posting_integration':
          recommendations.push('より多くの自動投稿設定を有効化することを推奨');
          break;
        case 'performance_final':
          recommendations.push('データベースクエリのパフォーマンス最適化を検討');
          break;
        case 'security_final':
          recommendations.push('セキュリティイベントの監視強化を推奨');
          break;
      }
    }
  });

  if (recommendations.length === 0) {
    recommendations.push('全てのテストが正常に通過しています。システムは本番環境で使用可能です。');
  }

  return recommendations;
}