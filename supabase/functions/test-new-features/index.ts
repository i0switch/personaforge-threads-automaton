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
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
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
    console.log('🧪 新機能テスト開始...');
    const results: TestResult[] = [];

    // 1. template_post_boxesテーブルの整合性テスト
    console.log('1. テンプレートポストボックステーブル整合性');
    
    const { data: templateBoxes, error: boxError } = await supabase
      .from('template_post_boxes')
      .select(`
        id, box_name, is_active, templates, random_times, 
        timezone, next_run_at, user_id, persona_id,
        personas(name, is_active, threads_access_token)
      `);

    if (boxError) {
      results.push({
        test_name: 'template_post_boxes_table',
        status: 'FAIL',
        message: 'テーブルアクセスエラー',
        details: boxError
      });
    } else {
      // テンプレート構造の検証
      let validTemplates = 0;
      let invalidTemplates = 0;
      const templateIssues: any[] = [];

      templateBoxes?.forEach(box => {
        const templates = box.templates as any[];
        if (Array.isArray(templates)) {
          templates.forEach((template, idx) => {
            // image_urls配列のチェック
            if (template.image_urls !== undefined) {
              if (Array.isArray(template.image_urls)) {
                if (template.image_urls.length <= 2) {
                  validTemplates++;
                } else {
                  invalidTemplates++;
                  templateIssues.push({
                    box: box.box_name,
                    template_index: idx,
                    issue: '画像が2つ以上アップロードされています',
                    count: template.image_urls.length
                  });
                }
              } else {
                invalidTemplates++;
                templateIssues.push({
                  box: box.box_name,
                  template_index: idx,
                  issue: 'image_urlsが配列ではありません'
                });
              }
            } else {
              validTemplates++;
            }

            // テンプレートテキストの検証
            if (!template.text || template.text.trim() === '') {
              templateIssues.push({
                box: box.box_name,
                template_index: idx,
                issue: 'テンプレートテキストが空です'
              });
            }
          });
        }
      });

      results.push({
        test_name: 'template_structure_validation',
        status: invalidTemplates === 0 && templateIssues.length === 0 ? 'PASS' : 'WARN',
        message: `テンプレート構造: 有効=${validTemplates}, 無効=${invalidTemplates}`,
        details: {
          total_boxes: templateBoxes?.length || 0,
          valid_templates: validTemplates,
          invalid_templates: invalidTemplates,
          issues: templateIssues
        }
      });

      // アクティブなボックスの検証
      const activeBoxes = templateBoxes?.filter(box => box.is_active);
      const activeWithoutPersona = activeBoxes?.filter(box => 
        !box.personas?.is_active || !box.personas?.threads_access_token
      );

      results.push({
        test_name: 'template_boxes_active_validation',
        status: (activeWithoutPersona?.length || 0) === 0 ? 'PASS' : 'WARN',
        message: `アクティブボックス ${activeBoxes?.length || 0}個中、${activeWithoutPersona?.length || 0}個が無効なペルソナ`,
        details: {
          active_boxes: activeBoxes?.length || 0,
          invalid_persona_boxes: activeWithoutPersona?.map(b => b.box_name)
        }
      });
    }

    // 2. メディアアップロード機能のテスト（2つまで）
    console.log('2. メディアアップロード制限テスト');
    
    const { data: templatesWithImages } = await supabase
      .from('template_post_boxes')
      .select('box_name, templates');

    let imagesOver2 = 0;
    let imagesExactly2 = 0;
    let imagesUnder2 = 0;
    const imageCountIssues: any[] = [];

    templatesWithImages?.forEach(box => {
      const templates = box.templates as any[];
      if (Array.isArray(templates)) {
        templates.forEach((template, idx) => {
          if (template.image_urls && Array.isArray(template.image_urls)) {
            const count = template.image_urls.length;
            if (count > 2) {
              imagesOver2++;
              imageCountIssues.push({
                box: box.box_name,
                template_index: idx,
                image_count: count
              });
            } else if (count === 2) {
              imagesExactly2++;
            } else {
              imagesUnder2++;
            }
          }
        });
      }
    });

    results.push({
      test_name: 'media_upload_limit',
      status: imagesOver2 === 0 ? 'PASS' : 'FAIL',
      message: `画像アップロード: 2枚超過=${imagesOver2}, 2枚=${imagesExactly2}, 2枚未満=${imagesUnder2}`,
      details: {
        over_limit: imagesOver2,
        exactly_2: imagesExactly2,
        under_2: imagesUnder2,
        violations: imageCountIssues
      }
    });

    // 3. 手動投稿機能のデータ整合性テスト
    console.log('3. 手動投稿機能テスト');
    
    const { data: manualPosts, error: manualError } = await supabase
      .from('posts')
      .select(`
        id, content, status, scheduled_for, auto_schedule, 
        persona_id, images, created_at,
        personas(name, is_active)
      `)
      .eq('auto_schedule', false)
      .order('created_at', { ascending: false })
      .limit(100);

    if (manualError) {
      results.push({
        test_name: 'manual_post_functionality',
        status: 'FAIL',
        message: '手動投稿データ取得エラー',
        details: manualError
      });
    } else {
      // 手動投稿のデータ検証
      const missingSchedule = manualPosts?.filter(p => !p.scheduled_for);
      const missingContent = manualPosts?.filter(p => !p.content || p.content.trim() === '');
      const invalidStatus = manualPosts?.filter(p => !['scheduled', 'published', 'failed'].includes(p.status));
      
      // post_queueとの整合性チェック
      const postIds = manualPosts?.map(p => p.id) || [];
      const { data: queueEntries } = await supabase
        .from('post_queue')
        .select('post_id, status')
        .in('post_id', postIds);

      const postsWithoutQueue = manualPosts?.filter(p => 
        p.status === 'scheduled' && !queueEntries?.some(q => q.post_id === p.id)
      );

      results.push({
        test_name: 'manual_post_data_integrity',
        status: missingSchedule.length === 0 && missingContent.length === 0 && 
                invalidStatus.length === 0 && postsWithoutQueue.length === 0 ? 'PASS' : 'WARN',
        message: `手動投稿: ${manualPosts?.length || 0}件, 問題=${missingSchedule.length + missingContent.length + invalidStatus.length + postsWithoutQueue.length}件`,
        details: {
          total_manual_posts: manualPosts?.length || 0,
          missing_schedule: missingSchedule.length,
          missing_content: missingContent.length,
          invalid_status: invalidStatus.length,
          posts_without_queue: postsWithoutQueue.length,
          recent_posts: manualPosts?.slice(0, 5).map(p => ({
            id: p.id,
            content_preview: p.content?.substring(0, 30),
            scheduled_for: p.scheduled_for,
            status: p.status,
            persona: p.personas?.name
          }))
        }
      });

      // 画像アップロード機能（手動投稿）
      const postsWithImages = manualPosts?.filter(p => p.images && p.images.length > 0);
      const postsWithOver2Images = postsWithImages?.filter(p => p.images.length > 2);

      results.push({
        test_name: 'manual_post_image_limit',
        status: postsWithOver2Images.length === 0 ? 'PASS' : 'FAIL',
        message: `手動投稿画像: 画像付き=${postsWithImages.length}件, 2枚超過=${postsWithOver2Images.length}件`,
        details: {
          posts_with_images: postsWithImages.length,
          posts_over_2_images: postsWithOver2Images.length,
          violations: postsWithOver2Images.map(p => ({
            id: p.id,
            image_count: p.images.length
          }))
        }
      });
    }

    // 4. システム全体のパフォーマンステスト
    console.log('4. パフォーマンステスト');
    
    const perfStart = Date.now();
    const { data: perfData } = await supabase
      .from('posts')
      .select('id, status, persona_id, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    const perfTime = Date.now() - perfStart;

    results.push({
      test_name: 'system_performance',
      status: perfTime < 2000 ? 'PASS' : perfTime < 5000 ? 'WARN' : 'FAIL',
      message: `クエリパフォーマンス: ${perfTime}ms`,
      details: {
        query_time_ms: perfTime,
        records_fetched: perfData?.length || 0,
        grade: perfTime < 1000 ? 'A' : perfTime < 2000 ? 'B' : perfTime < 3000 ? 'C' : 'D'
      }
    });

    // 結果集計
    const passCount = results.filter(r => r.status === 'PASS').length;
    const warnCount = results.filter(r => r.status === 'WARN').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    
    const overallStatus = failCount === 0 ? (warnCount === 0 ? 'EXCELLENT' : 'GOOD') : 
                         failCount <= 1 ? 'NEEDS_ATTENTION' : 'CRITICAL';
    
    const qualityScore = Math.round(((passCount * 100 + warnCount * 60) / results.length));

    console.log(`✅ テスト完了: ${overallStatus} (${qualityScore}点)`);

    return new Response(
      JSON.stringify({
        test_timestamp: new Date().toISOString(),
        overall_status: overallStatus,
        quality_score: qualityScore,
        summary: {
          total_tests: results.length,
          passed: passCount,
          warnings: warnCount,
          failed: failCount
        },
        test_results: results,
        recommendations: generateRecommendations(results),
        certification: qualityScore >= 90 ? 'PRODUCTION_READY' : 
                      qualityScore >= 70 ? 'STAGING_READY' : 'NEEDS_IMPROVEMENT'
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

function generateRecommendations(results: TestResult[]): string[] {
  const recommendations: string[] = [];
  
  results.forEach(result => {
    if (result.status === 'FAIL') {
      switch (result.test_name) {
        case 'media_upload_limit':
          recommendations.push('⚠️ 画像アップロード制限（2枚）が守られていません。UI側で制限を強化してください。');
          break;
        case 'manual_post_image_limit':
          recommendations.push('⚠️ 手動投稿で2枚を超える画像がアップロードされています。バリデーションを追加してください。');
          break;
        case 'template_post_boxes_table':
          recommendations.push('⚠️ template_post_boxesテーブルへのアクセスに問題があります。');
          break;
        case 'manual_post_functionality':
          recommendations.push('⚠️ 手動投稿機能のデータ取得に問題があります。');
          break;
        default:
          recommendations.push(`⚠️ ${result.test_name} に問題があります。`);
      }
    } else if (result.status === 'WARN') {
      switch (result.test_name) {
        case 'template_structure_validation':
          recommendations.push('📋 一部のテンプレートに構造的な問題があります。確認してください。');
          break;
        case 'template_boxes_active_validation':
          recommendations.push('📋 アクティブなボックスの一部に無効なペルソナが設定されています。');
          break;
        case 'manual_post_data_integrity':
          recommendations.push('📋 手動投稿のデータに不整合があります。確認が必要です。');
          break;
        case 'system_performance':
          recommendations.push('📋 システムパフォーマンスの最適化を検討してください。');
          break;
      }
    }
  });

  if (recommendations.length === 0) {
    recommendations.push('✅ すべてのテストが正常に通過しました。新機能は本番環境で使用可能です。');
  }

  return recommendations;
}
