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
  console.log(`🧪 AI自動返信テスト開始: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { replyId } = await req.json();
    console.log(`📝 テスト対象リプライID: ${replyId}`);

    // リプライ情報を取得
    const { data: replyData, error: replyError } = await supabase
      .from('thread_replies')
      .select('*')
      .eq('reply_id', replyId)
      .maybeSingle();

    if (replyError || !replyData) {
      console.error('❌ リプライが見つかりません:', replyError);
      return new Response(JSON.stringify({ error: 'Reply not found', replyError }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ リプライデータ取得成功:`, replyData);

    // ペルソナ情報を取得
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', replyData.persona_id)
      .maybeSingle();

    if (personaError || !persona) {
      console.error('❌ ペルソナが見つかりません:', personaError);
      return new Response(JSON.stringify({ error: 'Persona not found', personaError }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ ペルソナデータ取得成功: ${persona.name}`, {
      auto_reply_enabled: persona.auto_reply_enabled,
      ai_auto_reply_enabled: persona.ai_auto_reply_enabled
    });

    // OpenAI API キーの確認
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const hasOpenAIKey = !!openaiApiKey;
    console.log(`🔑 OpenAI API Key設定状況: ${hasOpenAIKey ? '設定済み' : '未設定'}`);

    // threads-auto-reply関数を直接呼び出してテスト
    console.log(`🚀 threads-auto-reply関数呼び出し開始`);
    
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('threads-auto-reply', {
      body: {
        postContent: '',
        replyContent: replyData.reply_text,
        replyId: replyData.reply_id,
        personaId: persona.id,
        userId: persona.user_id
      }
    });

    console.log(`📋 threads-auto-reply応答:`, { aiResponse, aiError });

    return new Response(JSON.stringify({ 
      success: true,
      replyData,
      persona: {
        name: persona.name,
        auto_reply_enabled: persona.auto_reply_enabled,
        ai_auto_reply_enabled: persona.ai_auto_reply_enabled
      },
      hasOpenAIKey,
      aiResponse,
      aiError
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ テスト処理エラー:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});