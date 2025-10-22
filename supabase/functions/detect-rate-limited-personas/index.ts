import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

    console.log('🔍 レート制限ペルソナ検出開始...');

    // 過去24時間の失敗したリプライからスパム検出エラーを探す
    const { data: failedReplies, error: fetchError } = await supabase
      .from('thread_replies')
      .select(`
        id,
        persona_id,
        reply_status,
        error_details,
        created_at,
        personas (
          id,
          name,
          is_rate_limited,
          user_id
        )
      `)
      .eq('reply_status', 'failed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    console.log(`📊 過去24時間の失敗リプライ: ${failedReplies?.length || 0}件`);

    // スパム検出エラー (error_subcode 2207051) を持つペルソナを抽出
    const rateLimitedPersonas = new Map<string, any>();

    for (const reply of failedReplies || []) {
      const errorDetails = reply.error_details as any;
      
      // error_subcode 2207051 (スパム検出) をチェック
      if (errorDetails?.error?.error_subcode === 2207051 ||
          errorDetails?.spam_detection === true) {
        
        const persona = (reply.personas as any);
        if (persona && !rateLimitedPersonas.has(persona.id)) {
          rateLimitedPersonas.set(persona.id, {
            id: persona.id,
            name: persona.name,
            user_id: persona.user_id,
            is_rate_limited: persona.is_rate_limited,
            error_message: errorDetails.error?.error_user_msg || 'スパム検出により制限されています',
            detected_at: reply.created_at
          });
        }
      }
    }

    console.log(`🚨 レート制限検出ペルソナ: ${rateLimitedPersonas.size}件`);

    const updatedPersonas = [];
    
    // レート制限フラグを設定（まだ設定されていない場合）
    for (const [personaId, personaData] of rateLimitedPersonas) {
      if (!personaData.is_rate_limited) {
        const estimatedLiftTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        const { error: updateError } = await supabase
          .from('personas')
          .update({
            is_rate_limited: true,
            rate_limit_detected_at: personaData.detected_at,
            rate_limit_reason: personaData.error_message,
            rate_limit_until: estimatedLiftTime.toISOString()
          })
          .eq('id', personaId);

        if (updateError) {
          console.error(`❌ ペルソナ ${personaData.name} の更新失敗:`, updateError);
        } else {
          console.log(`✅ ペルソナ ${personaData.name} のレート制限フラグを設定`);
          updatedPersonas.push({
            id: personaId,
            name: personaData.name,
            reason: personaData.error_message
          });
        }
      } else {
        console.log(`ℹ️ ペルソナ ${personaData.name} は既にレート制限状態`);
      }
    }

    // 成功したリプライがあるペルソナのレート制限を解除
    const { data: recentSuccessReplies, error: successError } = await supabase
      .from('thread_replies')
      .select(`
        persona_id,
        personas (
          id,
          name,
          is_rate_limited
        )
      `)
      .eq('reply_status', 'sent')
      .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()); // 過去2時間

    const clearedPersonas = [];

    if (recentSuccessReplies && !successError) {
      const successPersonaIds = new Set(recentSuccessReplies.map(r => r.persona_id));
      
      for (const personaId of successPersonaIds) {
        const persona = recentSuccessReplies.find(r => r.persona_id === personaId)?.personas as any;
        
        if (persona?.is_rate_limited) {
          const { error: clearError } = await supabase
            .from('personas')
            .update({
              is_rate_limited: false,
              rate_limit_detected_at: null,
              rate_limit_reason: null,
              rate_limit_until: null
            })
            .eq('id', personaId);

          if (!clearError) {
            console.log(`✅ ペルソナ ${persona.name} のレート制限を解除（最近の成功リプライを確認）`);
            clearedPersonas.push({
              id: personaId,
              name: persona.name
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        detected_rate_limited: rateLimitedPersonas.size,
        updated_personas: updatedPersonas,
        cleared_personas: clearedPersonas,
        total_failed_replies: failedReplies?.length || 0
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
