import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  console.log(`🤖 AI自動返信処理開始: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postContent, replyContent, replyId, personaId, userId } = await req.json();
    
    console.log(`📝 AI自動返信パラメータ: ペルソナID=${personaId}, リプライID=${replyId}`);

    // ペルソナ情報を取得
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .maybeSingle();

    if (personaError || !persona) {
      console.error('❌ ペルソナが見つかりません:', personaError);
      return new Response(JSON.stringify({ error: 'Persona not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AI自動返信が無効な場合は処理をスキップ
    if (!persona.ai_auto_reply_enabled) {
      console.log(`ℹ️ AI自動返信が無効 - persona: ${persona.name}`);
      return new Response(JSON.stringify({ message: 'AI auto reply disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // OpenAI APIを使用してAI返信を生成
    console.log(`🧠 AI返信生成開始 - リプライ内容: "${replyContent}"`);
    
    const aiPrompt = `
あなたは${persona.name}というペルソナです。
年齢: ${persona.age || '不明'}
性格: ${persona.personality || 'フレンドリー'}
話し方: ${persona.tone_of_voice || 'カジュアル'}
専門分野: ${persona.expertise?.join(', ') || 'なし'}

以下のリプライに対して、このペルソナの性格と話し方で自然に返信してください。
リプライは簡潔で親しみやすく、140文字以内にしてください。

受信したリプライ: "${replyContent}"

返信:`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'あなたは指定されたペルソナとして自然な返信を生成するAIアシスタントです。' },
          { role: 'user', content: aiPrompt }
        ],
        max_tokens: 200,
        temperature: 0.8
      }),
    });

    if (!openaiResponse.ok) {
      console.error('❌ OpenAI APIエラー:', await openaiResponse.text());
      return new Response(JSON.stringify({ error: 'AI response generation failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await openaiResponse.json();
    const aiReplyText = aiData.choices[0].message.content.trim();
    console.log(`✅ AI返信生成完了: "${aiReplyText}"`);

    // アクセストークンを取得
    const accessToken = await getAccessToken(persona);
    if (!accessToken) {
      console.error('❌ アクセストークンの取得に失敗');
      return new Response(JSON.stringify({ error: 'Access token not available' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Threads APIを使用して返信を送信
    const success = await sendThreadsReply(persona, accessToken, replyId, aiReplyText);
    
    if (success) {
      console.log(`🎉 AI自動返信送信成功: "${aiReplyText}"`);
      
      // auto_reply_sentフラグを更新
      await supabase
        .from('thread_replies')
        .update({ auto_reply_sent: true })
        .eq('reply_id', replyId);

      // アクティビティログを記録
      await supabase
        .from('activity_logs')
        .insert({
          user_id: userId,
          persona_id: personaId,
          action_type: 'ai_auto_reply_sent',
          description: `AI自動返信を送信: "${aiReplyText.substring(0, 50)}..."`,
          metadata: {
            reply_id: replyId,
            ai_response: aiReplyText
          }
        });

      return new Response(JSON.stringify({ 
        success: true, 
        aiResponse: aiReplyText,
        replyId: replyId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      console.error('❌ AI自動返信送信失敗');
      return new Response(JSON.stringify({ error: 'Failed to send AI reply' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ AI自動返信処理エラー:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// アクセストークンを取得
async function getAccessToken(persona: any): Promise<string | null> {
  try {
    console.log('🔑 アクセストークン取得開始');

    // retrieve-secret関数を使用してトークンを取得
    try {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('retrieve-secret', {
        body: { 
          key: `threads_access_token_${persona.id}`,
          fallback: persona.threads_access_token
        }
      });

      if (tokenData?.secret && !tokenError) {
        console.log('✅ トークン取得成功（retrieve-secret）');
        return tokenData.secret;
      }
    } catch (error) {
      console.log('🔄 retrieve-secret方式エラー:', error);
    }

    // 暗号化されていないトークンかチェック
    if (persona.threads_access_token?.startsWith('THAA')) {
      console.log('✅ 非暗号化トークン使用');
      return persona.threads_access_token;
    }

    console.error('❌ 全ての方式でアクセストークン取得失敗');
    return null;

  } catch (error) {
    console.error('❌ トークン取得エラー:', error);
    return null;
  }
}

// Threads APIを使用して返信を送信
async function sendThreadsReply(persona: any, accessToken: string, replyToId: string, responseText: string): Promise<boolean> {
  try {
    console.log(`📤 Threads返信送信開始: "${responseText}" (Reply to: ${replyToId})`);

    const userId = persona.threads_user_id || 'me';

    // コンテナを作成
    const createResponse = await fetch(`https://graph.threads.net/v1.0/me/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: responseText,
        reply_to_id: replyToId,
        access_token: accessToken
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ Threads コンテナ作成失敗:', errorText);
      return false;
    }

    const containerData = await createResponse.json();
    console.log(`✅ コンテナ作成成功: ${containerData.id}`);

    // 少し待機してから投稿
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 投稿を公開
    const publishResponse = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: accessToken
      })
    });

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      console.error('❌ Threads 投稿公開失敗:', errorText);
      return false;
    }

    const publishData = await publishResponse.json();
    console.log(`🎉 AI返信送信成功: ${publishData.id}`);
    return true;

  } catch (error) {
    console.error('❌ Threads返信送信エラー:', error);
    return false;
  }
}