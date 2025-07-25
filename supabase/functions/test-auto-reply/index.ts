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
  console.log(`🚀 テスト開始: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { replyId } = await req.json();
    
    if (!replyId) {
      return new Response(JSON.stringify({ error: 'replyId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 テスト対象リプライID: ${replyId}`);

    // リプライ情報を取得
    const { data: reply, error: replyError } = await supabase
      .from('thread_replies')
      .select('*, personas(*)')
      .eq('reply_id', replyId)
      .maybeSingle();

    if (replyError || !reply) {
      console.error('❌ リプライが見つかりません:', replyError);
      return new Response(JSON.stringify({ error: 'Reply not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ リプライ取得成功: "${reply.reply_text}" by ${reply.reply_author_username}`);

    // ペルソナ情報を取得
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', reply.persona_id)
      .maybeSingle();

    if (personaError || !persona) {
      console.error('❌ ペルソナが見つかりません:', personaError);
      return new Response(JSON.stringify({ error: 'Persona not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ ペルソナ取得成功: ${persona.name}, 自動返信: ${persona.auto_reply_enabled}`);

    // 自動返信設定を確認
    if (!persona.auto_reply_enabled) {
      console.log(`ℹ️ 自動返信設定がOFF`);
      return new Response(JSON.stringify({ message: 'Auto reply disabled', persona: persona.name }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 自動返信設定を取得
    const { data: autoRepliesSettings } = await supabase
      .from('auto_replies')
      .select('*')
      .eq('persona_id', persona.id)
      .eq('is_active', true);

    console.log(`📋 自動返信設定: ${autoRepliesSettings?.length || 0}件`);

    if (!autoRepliesSettings || autoRepliesSettings.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No auto reply settings found',
        persona: persona.name 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // キーワードマッチングをテスト
    const replyText = (reply.reply_text || '').trim().toLowerCase();
    console.log(`🔍 リプライテキスト: "${replyText}"`);

    const matches = [];
    for (const setting of autoRepliesSettings) {
      const keywords = setting.trigger_keywords || [];
      console.log(`🔑 チェック中のキーワード:`, keywords);

      for (const keyword of keywords) {
        const cleanKeyword = keyword.trim().toLowerCase();
        if (replyText.includes(cleanKeyword)) {
          matches.push({
            keyword: keyword,
            response: setting.response_template,
            settingId: setting.id
          });
          console.log(`🎉 キーワードマッチ: "${keyword}" → 返信: "${setting.response_template}"`);
        }
      }
    }

    if (matches.length === 0) {
      console.log(`❌ マッチするキーワードなし`);
      return new Response(JSON.stringify({ 
        message: 'No keyword matches',
        replyText: replyText,
        availableKeywords: autoRepliesSettings.map(s => s.trigger_keywords).flat()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // auto_reply_sentフラグを更新
    const { error: updateError } = await supabase
      .from('thread_replies')
      .update({ auto_reply_sent: true })
      .eq('reply_id', replyId);

    if (updateError) {
      console.error('❌ auto_reply_sentフラグ更新エラー:', updateError);
    } else {
      console.log(`✅ auto_reply_sentフラグ更新完了: ${replyId}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      replyText: replyText,
      matches: matches,
      persona: persona.name,
      flagUpdated: !updateError
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ テスト処理エラー:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});