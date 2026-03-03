import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://threads-genius-ai.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔧 スタックしたAI返信の一括リセット開始...');

    // ステップ1: AI自動返信が有効なペルソナでスタックしている返信を特定
    const { data: stuckReplies, error: fetchError } = await supabase
      .from('thread_replies')
      .select(`
        id,
        reply_id,
        persona_id,
        reply_status,
        auto_reply_sent,
        personas!inner (
          id,
          name,
          ai_auto_reply_enabled
        )
      `)
      .eq('auto_reply_sent', true)
      .in('reply_status', ['failed', 'processing'])
      .eq('personas.ai_auto_reply_enabled', true);

    if (fetchError) {
      console.error('❌ スタック返信の取得エラー:', fetchError);
      throw fetchError;
    }

    if (!stuckReplies || stuckReplies.length === 0) {
      console.log('✅ スタックした返信はありません');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'スタックした返信はありませんでした',
          reset_count: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📋 ${stuckReplies.length}件のスタック返信を発見`);

    // ステップ2: 一括リセット（auto_reply_sentをfalseに、reply_statusをpendingに）
    const replyIds = stuckReplies.map(r => r.reply_id);
    
    const { error: updateError } = await supabase
      .from('thread_replies')
      .update({
        auto_reply_sent: false,
        reply_status: 'pending',
        retry_count: 0,
        last_retry_at: null,
        error_details: {
          reset_at: new Date().toISOString(),
          reset_reason: 'Bulk reset of stuck AI replies',
          previous_status: 'stuck'
        }
      })
      .in('reply_id', replyIds);

    if (updateError) {
      console.error('❌ 一括リセットエラー:', updateError);
      throw updateError;
    }

    console.log(`✅ ${stuckReplies.length}件のスタック返信をリセット完了`);

    // ステップ3: ペルソナごとの統計を表示
    const personaStats = stuckReplies.reduce((acc: any, reply: any) => {
      const personaName = reply.personas.name;
      if (!acc[personaName]) {
        acc[personaName] = 0;
      }
      acc[personaName]++;
      return acc;
    }, {});

    console.log('📊 ペルソナ別リセット統計:', personaStats);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${stuckReplies.length}件のスタック返信を正常にリセットしました`,
        reset_count: stuckReplies.length,
        persona_stats: personaStats,
        details: 'これらの返信は次回のprocess-unhandled-repliesで再処理されます'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ エラー:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
