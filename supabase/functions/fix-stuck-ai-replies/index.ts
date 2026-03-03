import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔧 スタックしたAI返信リプライの修復開始...');

    // auto_reply_sent=true かつ reply_status=failed のリプライを取得
    const { data: stuckReplies, error: fetchError } = await supabase
      .from('thread_replies')
      .select(`
        id,
        reply_id,
        reply_status,
        auto_reply_sent,
        ai_response,
        created_at,
        personas (
          id,
          name,
          ai_auto_reply_enabled
        )
      `)
      .eq('auto_reply_sent', true)
      .in('reply_status', ['failed', 'processing'])
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (fetchError) {
      throw fetchError;
    }

    console.log(`📊 スタック状態のリプライ: ${stuckReplies?.length || 0}件`);

    const fixedReplies = [];

    // AI自動返信が有効なペルソナのリプライのみリセット
    for (const reply of stuckReplies || []) {
      const persona = reply.personas as any;
      
      if (persona?.ai_auto_reply_enabled) {
        // auto_reply_sentをfalseにリセットして再処理可能にする
        const { error: updateError } = await supabase
          .from('thread_replies')
          .update({
            auto_reply_sent: false,
            reply_status: 'pending',
            error_details: {
              ...(reply.error_details || {}),
              fixed_at: new Date().toISOString(),
              fixed_reason: 'Reset stuck auto_reply_sent flag'
            }
          })
          .eq('id', reply.id);

        if (updateError) {
          console.error(`❌ リプライ ${reply.id} のリセット失敗:`, updateError);
        } else {
          console.log(`✅ リプライ ${reply.id} をリセット (Persona: ${persona.name})`);
          fixedReplies.push({
            id: reply.id,
            reply_id: reply.reply_id,
            persona_name: persona.name,
            had_ai_response: reply.ai_response !== null
          });
        }
      }
    }

    // 10分以上processing状態のリプライもリセット
    const { data: processingReplies, error: processingError } = await supabase
      .from('thread_replies')
      .select(`
        id,
        reply_id,
        updated_at,
        personas (
          id,
          name,
          ai_auto_reply_enabled
        )
      `)
      .eq('reply_status', 'processing')
      .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (!processingError && processingReplies) {
      for (const reply of processingReplies) {
        const persona = reply.personas as any;
        
        if (persona?.ai_auto_reply_enabled) {
          const { error: resetError } = await supabase
            .from('thread_replies')
            .update({
              auto_reply_sent: false,
              reply_status: 'pending',
              error_details: {
                fixed_at: new Date().toISOString(),
                fixed_reason: 'Reset stuck processing state (>10min)'
              }
            })
            .eq('id', reply.id);

          if (!resetError) {
            console.log(`✅ 長時間processing状態をリセット: ${reply.id} (Persona: ${persona.name})`);
            fixedReplies.push({
              id: reply.id,
              reply_id: reply.reply_id,
              persona_name: persona.name,
              reason: 'Long processing timeout'
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_stuck: stuckReplies?.length || 0,
        fixed_count: fixedReplies.length,
        fixed_replies: fixedReplies
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ エラー:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
