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
  console.log(`🚀 Webhook受信: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ペルソナIDを取得
    const url = new URL(req.url);
    const personaId = url.searchParams.get('persona_id');
    
    if (!personaId) {
      console.error('❌ ペルソナIDが指定されていません');
      return new Response(JSON.stringify({ error: 'persona_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 処理開始 - ペルソナID: ${personaId}`);

    // ペルソナ情報を取得（自動返信設定も含む）
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .single();

    if (personaError || !persona) {
      console.error('❌ ペルソナが見つかりません:', personaError);
      return new Response(JSON.stringify({ error: 'Persona not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ ペルソナ取得成功: ${persona.name}, 自動返信: ${persona.auto_reply_enabled}`);

    // Webhookペイロードを解析
    const payload = await req.json();
    console.log(`📦 Webhookペイロード:`, JSON.stringify(payload, null, 2));

    // リプライデータを抽出
    const replies = extractRepliesFromPayload(payload);
    console.log(`📨 抽出されたリプライ数: ${replies.length}`);

    if (replies.length === 0) {
      console.log('ℹ️ 処理対象のリプライがありません');
      return new Response(JSON.stringify({ message: 'No replies to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 各リプライを処理
    let processedCount = 0;
    for (const reply of replies) {
      const success = await processReply(persona, reply);
      if (success) processedCount++;
    }

    console.log(`✅ 処理完了 - ${processedCount}/${replies.length}件処理しました`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: processedCount,
      total: replies.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Webhook処理エラー:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Webhookペイロードからリプライデータを抽出
function extractRepliesFromPayload(payload: any): any[] {
  console.log('🔍 リプライデータ抽出開始');
  
  const replies = [];
  
  if (payload.values && Array.isArray(payload.values)) {
    for (const valueItem of payload.values) {
      if (valueItem.field === 'replies' && valueItem.value) {
        replies.push(valueItem.value);
        console.log(`✅ リプライ抽出: ${valueItem.value.id} - "${valueItem.value.text}"`);
      }
    }
  }
  
  return replies;
}

// リプライを処理
async function processReply(persona: any, reply: any): Promise<boolean> {
  try {
    console.log(`\n🔄 リプライ処理開始: ${reply.id} - "${reply.text}" by ${reply.username}`);

    // 自分自身のリプライをスキップ
    if (reply.username === persona.threads_username || reply.username === persona.name) {
      console.log(`⏭️ 自分のリプライをスキップ: ${reply.id}`);
      return false;
    }

    // リプライが既に存在するかチェック
    const { data: existingReply } = await supabase
      .from('thread_replies')
      .select('id, auto_reply_sent')
      .eq('reply_id', reply.id)
      .single();

    if (existingReply && existingReply.auto_reply_sent) {
      console.log(`⏭️ 既に処理済みのリプライ: ${reply.id}`);
      return false;
    }

    // Step 1: リプライをデータベースに保存
    await saveReplyToDatabase(persona, reply);

    // Step 2: アクティビティログを記録
    await logActivity(persona.user_id, persona.id, 'reply_received', 
      `新しいリプライを受信: @${reply.username}`, {
        author: reply.username,
        reply_id: reply.id,
        reply_text: reply.text
      });

    // Step 3: 自動返信処理（設定がONの場合のみ）
    if (!persona.auto_reply_enabled) {
      console.log(`ℹ️ 自動返信設定がOFF - persona: ${persona.name}`);
      return true;
    }

    console.log(`🤖 自動返信処理開始 - persona: ${persona.name}`);
    
    // Step 4: トリガー自動返信（定型文）をチェック
    const templateResult = await processTemplateAutoReply(persona, reply);
    if (templateResult.sent) {
      // 返信が送信された場合、auto_reply_sentフラグを更新
      await updateAutoReplySentFlag(reply.id, true);
      return true;
    }

    // Step 5: AI自動返信をチェック
    if (persona.ai_auto_reply_enabled) {
      const aiResult = await processAIAutoReply(persona, reply);
      if (aiResult.sent) {
        // 返信が送信された場合、auto_reply_sentフラグを更新
        await updateAutoReplySentFlag(reply.id, true);
        return true;
      }
    }

    console.log(`ℹ️ 自動返信条件に該当なし - persona: ${persona.name}`);
    return true;

  } catch (error) {
    console.error(`❌ リプライ処理エラー (${reply.id}):`, error);
    return false;
  }
}

// リプライをデータベースに保存
async function saveReplyToDatabase(persona: any, reply: any): Promise<void> {
  console.log(`💾 リプライをデータベースに保存中: ${reply.id}`);

  const { error } = await supabase
    .from('thread_replies')
    .upsert({
      user_id: persona.user_id,
      persona_id: persona.id,
      original_post_id: reply.replied_to?.id || reply.root_post?.id,
      reply_id: reply.id,
      reply_text: reply.text || '',
      reply_author_id: reply.username,
      reply_author_username: reply.username,
      reply_timestamp: new Date(reply.timestamp || Date.now()).toISOString(),
      auto_reply_sent: false
    }, {
      onConflict: 'reply_id'
    });

  if (error) {
    console.error('❌ リプライ保存エラー:', error);
    throw error;
  }

  console.log(`✅ リプライ保存完了: ${reply.id}`);
}

// トリガー自動返信（定型文）を処理
async function processTemplateAutoReply(persona: any, reply: any): Promise<{ sent: boolean, method?: string }> {
  console.log(`🎯 定型文自動返信チェック開始`);

  // 自動返信設定を取得
  const { data: autoRepliesSettings } = await supabase
    .from('auto_replies')
    .select('*')
    .eq('persona_id', persona.id)
    .eq('is_active', true);

  if (!autoRepliesSettings || autoRepliesSettings.length === 0) {
    console.log(`❌ 定型文自動返信設定なし - persona: ${persona.name}`);
    return { sent: false };
  }

  console.log(`✅ 定型文自動返信設定が有効 - persona: ${persona.name}, 設定数: ${autoRepliesSettings.length}`);

  const replyText = (reply.text || '').trim().toLowerCase();
  console.log(`🔍 リプライテキスト: "${replyText}"`);

  for (const setting of autoRepliesSettings) {
    const keywords = setting.trigger_keywords || [];
    console.log(`🔑 チェック中のキーワード:`, keywords);

    for (const keyword of keywords) {
      const cleanKeyword = keyword.trim().toLowerCase();
      if (replyText.includes(cleanKeyword)) {
        console.log(`🎉 キーワードマッチ: "${keyword}" → 返信: "${setting.response_template}"`);
        
        // 定型文返信を送信
        const success = await sendThreadsReply(persona, reply.id, setting.response_template);
        
        if (success) {
          // アクティビティログを記録
          await logActivity(persona.user_id, persona.id, 'template_auto_reply_sent',
            `定型文自動返信を送信: "${setting.response_template.substring(0, 50)}..."`, {
              reply_id: reply.id,
              keyword_matched: keyword,
              response_sent: setting.response_template
            });

          return { sent: true, method: 'template' };
        }
      }
    }
  }

  console.log(`❌ マッチするキーワードなし`);
  return { sent: false };
}

// AI自動返信を処理
async function processAIAutoReply(persona: any, reply: any): Promise<{ sent: boolean, method?: string }> {
  console.log(`🧠 AI自動返信処理開始 - persona: ${persona.name}`);

  try {
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('threads-auto-reply', {
      body: {
        postContent: '', // 元投稿の内容
        replyContent: reply.text,
        replyId: reply.id,
        personaId: persona.id,
        userId: persona.user_id
      }
    });

    if (aiError) {
      console.error(`❌ AI自動返信エラー:`, aiError);
      return { sent: false };
    }

    console.log(`✅ AI自動返信送信完了:`, aiResponse);

    // アクティビティログを記録
    await logActivity(persona.user_id, persona.id, 'ai_auto_reply_sent',
      'AI自動返信を送信', {
        reply_id: reply.id,
        ai_response: aiResponse
      });

    return { sent: true, method: 'ai' };

  } catch (error) {
    console.error(`❌ AI自動返信処理エラー:`, error);
    return { sent: false };
  }
}

// Threads APIを使用して返信を送信
async function sendThreadsReply(persona: any, replyToId: string, responseText: string): Promise<boolean> {
  try {
    console.log(`📤 Threads返信送信開始: "${responseText}" (Reply to: ${replyToId})`);

    // アクセストークンを取得
    const accessToken = await getAccessToken(persona);
    if (!accessToken) {
      console.error('❌ アクセストークンの取得に失敗');
      return false;
    }

    const userId = persona.threads_user_id || 'me';

    // コンテナを作成
    const createResponse = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT_POST',
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
    console.log(`🎉 返信送信成功: ${publishData.id}`);
    return true;

  } catch (error) {
    console.error('❌ Threads返信送信エラー:', error);
    return false;
  }
}

// アクセストークンを取得
async function getAccessToken(persona: any): Promise<string | null> {
  try {
    console.log('🔑 アクセストークン取得開始');

    // 新しい方法でトークンを取得
    const { data: tokenData, error: tokenError } = await supabase.functions.invoke('retrieve-secret', {
      body: { 
        key: `persona_${persona.id}_threads_token`,
        user_id: persona.user_id
      }
    });

    if (tokenData?.value && !tokenError) {
      console.log('✅ トークン取得成功（新方式）');
      return tokenData.value;
    }

    console.log('🔄 従来方式でトークン取得を試行');

    // 従来方式のフォールバック
    const { data: personaWithToken } = await supabase
      .from('personas')
      .select('threads_access_token')
      .eq('id', persona.id)
      .single();

    if (!personaWithToken?.threads_access_token) {
      console.error('❌ アクセストークンが見つかりません');
      return null;
    }

    const { data: decryptedToken, error: decryptError } = await supabase
      .rpc('decrypt_access_token', { encrypted_token: personaWithToken.threads_access_token });

    if (decryptError || !decryptedToken) {
      console.error('❌ トークン復号化失敗:', decryptError);
      return null;
    }

    console.log('✅ トークン取得成功（従来方式）');
    return decryptedToken;

  } catch (error) {
    console.error('❌ トークン取得エラー:', error);
    return null;
  }
}

// auto_reply_sentフラグを更新
async function updateAutoReplySentFlag(replyId: string, sent: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('thread_replies')
      .update({ auto_reply_sent: sent })
      .eq('reply_id', replyId);
    
    if (error) {
      console.error('❌ auto_reply_sentフラグ更新エラー:', error);
    } else {
      console.log(`✅ auto_reply_sentフラグ更新完了: ${replyId} -> ${sent}`);
    }
  } catch (error) {
    console.error('❌ auto_reply_sentフラグ更新エラー:', error);
  }
}

// アクティビティログを記録
async function logActivity(userId: string, personaId: string, actionType: string, description: string, metadata?: any): Promise<void> {
  try {
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        persona_id: personaId,
        action_type: actionType,
        description: description,
        metadata: metadata || {}
      });
    
    console.log(`📝 アクティビティログ記録: ${actionType}`);
  } catch (error) {
    console.error('❌ アクティビティログ記録エラー:', error);
  }
}