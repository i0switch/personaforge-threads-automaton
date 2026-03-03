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
    console.log('🧪 自動返信システム包括テスト開始');
    const testResults: any[] = [];

    // 1. データベース状態の確認
    console.log('📊 データベース状態を確認中...');
    
    const { data: personas, error: personaError } = await supabase
      .from('personas')
      .select(`
        id, 
        name, 
        auto_reply_enabled, 
        ai_auto_reply_enabled,
        threads_access_token
      `)
      .in('name', ['令和ギャル占い師@レイカさん', '守護霊鑑定OL🦊みさき'])
      .eq('is_active', true);

    if (personaError) {
      throw new Error(`ペルソナ取得エラー: ${personaError.message}`);
    }

    testResults.push({
      step: 1,
      name: 'ペルソナ状態確認',
      status: 'completed',
      result: `アクティブペルソナ数: ${personas?.length || 0}`,
      details: personas
    });

    // 2. 未処理リプライの確認
    const { count: unprocessedCount, error: countError } = await supabase
      .from('thread_replies')
      .select('*', { count: 'exact', head: true })
      .eq('auto_reply_sent', false)
      .in('persona_id', personas?.map(p => p.id) || []);

    testResults.push({
      step: 2,
      name: '未処理リプライ確認',
      status: 'completed',
      result: `未処理リプライ数: ${unprocessedCount || 0}`,
      count: unprocessedCount
    });

    // 3. 自動返信設定の確認
    const { data: autoRepliesSettings, error: settingsError } = await supabase
      .from('auto_replies')
      .select('*')
      .in('persona_id', personas?.map(p => p.id) || [])
      .eq('is_active', true);

    testResults.push({
      step: 3,
      name: '自動返信設定確認',
      status: 'completed',
      result: `アクティブ設定数: ${autoRepliesSettings?.length || 0}`,
      settings: autoRepliesSettings
    });

    // 4. アクセストークンの確認
    let tokenStatus = 0;
    for (const persona of personas || []) {
      if (persona.threads_access_token) {
        tokenStatus++;
      }
    }

    testResults.push({
      step: 4,
      name: 'アクセストークン確認',
      status: 'completed',
      result: `設定済みトークン数: ${tokenStatus}/${personas?.length || 0}`
    });

    // 5. 未処理リプライの処理テスト（実際の処理は行わず、処理可能性のみ確認）
    if (unprocessedCount && unprocessedCount > 0) {
      console.log(`📋 ${unprocessedCount}件の未処理リプライを発見`);
      
      // サンプル未処理リプライを取得
      const { data: sampleReplies, error: sampleError } = await supabase
        .from('thread_replies')
        .select(`
          *,
          personas!inner (
            id,
            name,
            auto_reply_enabled,
            ai_auto_reply_enabled,
            threads_access_token
          )
        `)
        .eq('auto_reply_sent', false)
        .limit(5);

      testResults.push({
        step: 5,
        name: '未処理リプライ詳細',
        status: 'completed',
        result: `サンプル取得: ${sampleReplies?.length || 0}件`,
        samples: sampleReplies
      });
    } else {
      testResults.push({
        step: 5,
        name: '未処理リプライ詳細',
        status: 'completed',
        result: '未処理リプライなし - システム正常'
      });
    }

    // 6. システム健康性の評価
    let healthScore = 0;
    const healthChecks = {
      personas_active: (personas?.length || 0) > 0,
      tokens_configured: tokenStatus > 0,
      auto_reply_settings: (autoRepliesSettings?.length || 0) > 0,
      processing_up_to_date: (unprocessedCount || 0) === 0
    };

    Object.values(healthChecks).forEach(check => {
      if (check) healthScore++;
    });

    const healthPercentage = Math.round((healthScore / Object.keys(healthChecks).length) * 100);
    
    testResults.push({
      step: 6,
      name: 'システム健康性評価',
      status: 'completed',
      result: `システム健康度: ${healthPercentage}%`,
      score: healthScore,
      maxScore: Object.keys(healthChecks).length,
      checks: healthChecks
    });

    // 最終結果
    console.log(`✅ 包括テスト完了 - 健康度: ${healthPercentage}%`);

    return new Response(JSON.stringify({
      success: true,
      healthPercentage,
      summary: {
        personas: personas?.length || 0,
        unprocessedReplies: unprocessedCount || 0,
        activeSettings: autoRepliesSettings?.length || 0,
        configuredTokens: tokenStatus
      },
      testResults,
      recommendations: generateRecommendations(healthChecks, unprocessedCount || 0)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ 包括テストエラー:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : String(error),
      testResults: []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

function generateRecommendations(healthChecks: any, unprocessedCount: number): string[] {
  const recommendations: string[] = [];

  if (!healthChecks.personas_active) {
    recommendations.push("⚠️ アクティブなペルソナが見つかりません。ペルソナの設定を確認してください。");
  }

  if (!healthChecks.tokens_configured) {
    recommendations.push("🔑 Threadsアクセストークンが設定されていません。API連携を確認してください。");
  }

  if (!healthChecks.auto_reply_settings) {
    recommendations.push("⚙️ 自動返信設定がありません。キーワード設定を確認してください。");
  }

  if (!healthChecks.processing_up_to_date) {
    recommendations.push(`📝 ${unprocessedCount}件の未処理リプライがあります。process-unhandled-replies関数を実行してください。`);
  }

  if (recommendations.length === 0) {
    recommendations.push("✅ システムは正常に動作しています！");
  }

  return recommendations;
}