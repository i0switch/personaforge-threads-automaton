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

interface TestResult {
  test_name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 包括的システムテスト開始...');
    const results: TestResult[] = [];

    // 1. データベース整合性テスト
    console.log('1. データベース整合性テスト');
    
    // 1.1 ペルソナとトークンの整合性
    const { data: personasWithToken, error: personaError } = await supabase
      .from('personas')
      .select('id, name, is_active, threads_access_token')
      .eq('is_active', true);

    if (personaError) {
      results.push({
        test_name: 'persona_token_consistency',
        status: 'FAIL',
        message: 'ペルソナデータ取得エラー',
        details: personaError
      });
    } else {
      const activeWithoutToken = personasWithToken.filter(p => !p.threads_access_token);
      results.push({
        test_name: 'persona_token_consistency',
        status: activeWithoutToken.length > 0 ? 'WARN' : 'PASS',
        message: `アクティブペルソナ ${personasWithToken.length}個中、${activeWithoutToken.length}個がトークンなし`,
        details: activeWithoutToken
      });
    }

    // 1.2 post_queueの整合性チェック
    const { data: queueStats, error: queueError } = await supabase
      .from('post_queue')
      .select('status')
      .then(({ data, error }) => {
        if (error) return { data: null, error };
        const stats = data?.reduce((acc, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        return { data: stats, error: null };
      });

    if (queueError) {
      results.push({
        test_name: 'queue_integrity',
        status: 'FAIL',
        message: 'キュー整合性チェックエラー',
        details: queueError
      });
    } else {
      const processingCount = queueStats?.processing || 0;
      results.push({
        test_name: 'queue_integrity',
        status: processingCount > 0 ? 'FAIL' : 'PASS',
        message: `キュー状態: processing=${processingCount}, completed=${queueStats?.completed || 0}, failed=${queueStats?.failed || 0}`,
        details: queueStats
      });
    }

    // 2. 自動投稿設定テスト
    console.log('2. 自動投稿設定テスト');
    
    const { data: autoPostConfigs, error: configError } = await supabase
      .from('auto_post_configs')
      .select(`
        id, persona_id, is_active, next_run_at,
        personas(name, is_active, threads_access_token)
      `)
      .eq('is_active', true);

    if (configError) {
      results.push({
        test_name: 'auto_post_config',
        status: 'FAIL',
        message: '自動投稿設定取得エラー',
        details: configError
      });
    } else {
      const invalidConfigs = autoPostConfigs?.filter(config => 
        !config.personas?.is_active || 
        !config.personas?.threads_access_token ||
        !config.next_run_at
      ) || [];
      
      results.push({
        test_name: 'auto_post_config',
        status: invalidConfigs.length > 0 ? 'WARN' : 'PASS',
        message: `自動投稿設定 ${autoPostConfigs?.length || 0}個中、${invalidConfigs.length}個が無効設定`,
        details: invalidConfigs
      });
    }

    // 3. 自動返信設定テスト
    console.log('3. 自動返信設定テスト');
    
    const { data: replySettings, error: replyError } = await supabase
      .from('personas')
      .select(`
        id, name, auto_reply_enabled, ai_auto_reply_enabled,
        auto_replies(id, is_active, trigger_keywords, response_template)
      `)
      .eq('is_active', true);

    if (replyError) {
      results.push({
        test_name: 'auto_reply_config',
        status: 'FAIL',
        message: '自動返信設定取得エラー',
        details: replyError
      });
    } else {
      const replyIssues = replySettings?.filter(persona => {
        const hasTemplateReply = persona.auto_reply_enabled && 
          persona.auto_replies?.some((reply: any) => reply.is_active);
        const hasAIReply = persona.ai_auto_reply_enabled;
        return !hasTemplateReply && !hasAIReply;
      }) || [];

      results.push({
        test_name: 'auto_reply_config',
        status: replyIssues.length > 0 ? 'WARN' : 'PASS',
        message: `${replySettings?.length || 0}個のペルソナ中、${replyIssues.length}個が自動返信未設定`,
        details: replyIssues.map(p => p.name)
      });
    }

    // 4. キーワードマッチングテスト
    console.log('4. キーワードマッチングテスト');
    
    function testKeywordMatch(text: string, keywords: string[]): boolean {
      const normalizedText = text.normalize('NFKC').toLowerCase();
      return keywords.some(keyword => {
        const normalizedKeyword = keyword.normalize('NFKC').toLowerCase();
        return normalizedText.includes(normalizedKeyword);
      });
    }

    const testCases = [
      { text: "❤️", keywords: ["❤"], expected: true },
      { text: "♥", keywords: ["❤"], expected: false }, // 異なる文字
      { text: "視聴ありがとう", keywords: ["視"], expected: true },
      { text: "見てくれてありがとう", keywords: ["視"], expected: false }
    ];

    let keywordTestsPassed = 0;
    const keywordTestResults = testCases.map(test => {
      const result = testKeywordMatch(test.text, test.keywords);
      const passed = result === test.expected;
      if (passed) keywordTestsPassed++;
      return {
        text: test.text,
        keywords: test.keywords,
        expected: test.expected,
        actual: result,
        passed
      };
    });

    results.push({
      test_name: 'keyword_matching',
      status: keywordTestsPassed === testCases.length ? 'PASS' : 'FAIL',
      message: `キーワードマッチング ${keywordTestsPassed}/${testCases.length} 通過`,
      details: keywordTestResults
    });

    // 5. パフォーマンステスト
    console.log('5. パフォーマンステスト');
    
    const performanceStart = Date.now();
    
    // 大量データクエリテスト
    const { data: largePosts, error: perfError } = await supabase
      .from('posts')
      .select('id, status, created_at')
      .limit(1000);

    const performanceTime = Date.now() - performanceStart;
    
    results.push({
      test_name: 'database_performance',
      status: performanceTime < 2000 ? 'PASS' : performanceTime < 5000 ? 'WARN' : 'FAIL',
      message: `大量データクエリ: ${performanceTime}ms, ${largePosts?.length || 0}件取得`,
      details: { response_time_ms: performanceTime, records_fetched: largePosts?.length || 0 }
    });

    // 6. エラーログ分析
    console.log('6. 最近のエラーログ分析');
    
    const { data: recentErrors, error: logError } = await supabase
      .from('security_events')
      .select('event_type, details, created_at')
      .like('event_type', '%error%')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    results.push({
      test_name: 'error_analysis',
      status: (recentErrors?.length || 0) === 0 ? 'PASS' : (recentErrors?.length || 0) < 5 ? 'WARN' : 'FAIL',
      message: `過去24時間のエラー: ${recentErrors?.length || 0}件`,
      details: recentErrors
    });

    // 結果集計
    const passCount = results.filter(r => r.status === 'PASS').length;
    const warnCount = results.filter(r => r.status === 'WARN').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    
    const overallStatus = failCount > 0 ? 'CRITICAL' : warnCount > 0 ? 'WARNING' : 'HEALTHY';

    console.log(`🧪 テスト完了: ${passCount} PASS, ${warnCount} WARN, ${failCount} FAIL`);

    return new Response(
      JSON.stringify({
        overall_status: overallStatus,
        summary: {
          total_tests: results.length,
          passed: passCount,
          warnings: warnCount,
          failed: failCount
        },
        test_results: results,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('テスト実行エラー:', error);
    
    return new Response(
      JSON.stringify({
        overall_status: 'ERROR',
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