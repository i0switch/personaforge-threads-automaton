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
  console.log(`🧪 文脈付きAI自動返信テスト開始`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // テスト用データ
    const testReplyId = "18076441843832942"; // 最新のリプライID
    const testPersonaId = "55b31a70-4366-4016-8c25-2343e898fd88"; // 9あずさ（AI自動返信有効）

    console.log(`📋 テスト実行 - リプライID: ${testReplyId}, ペルソナID: ${testPersonaId}`);

    // リプライ情報を取得
    const { data: replyData, error: replyError } = await supabase
      .from('thread_replies')
      .select('*')
      .eq('reply_id', testReplyId)
      .single();

    if (replyError || !replyData) {
      console.error('❌ リプライデータ取得失敗:', replyError);
      return new Response(JSON.stringify({ error: 'リプライが見つかりません' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ リプライデータ: "${replyData.reply_text}" by ${replyData.reply_author_username}`);

    // ペルソナ情報を取得
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', testPersonaId)
      .single();

    if (personaError || !persona) {
      console.error('❌ ペルソナ取得失敗:', personaError);
      return new Response(JSON.stringify({ error: 'ペルソナが見つかりません' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ ペルソナ: ${persona.name} (AI自動返信: ${persona.ai_auto_reply_enabled})`);

    // threads-auto-reply関数をテスト呼び出し
    console.log(`🚀 threads-auto-reply関数をテスト呼び出し`);
    
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('threads-auto-reply', {
      body: {
        postContent: '',
        replyContent: replyData.reply_text,
        replyId: replyData.reply_id,
        personaId: persona.id,
        userId: persona.user_id
      }
    });

    console.log(`📋 AI自動返信応答:`, { aiResponse, aiError });

    // 結果を返す
    return new Response(JSON.stringify({
      success: true,
      test: {
        replyText: replyData.reply_text,
        persona: persona.name,
        aiAutoReplyEnabled: persona.ai_auto_reply_enabled
      },
      aiResponse,
      aiError,
      message: "文脈付きAI自動返信テスト完了"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ テスト処理エラー:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});