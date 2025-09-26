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

    // Facebook Webhook認証のチャレンジレスポンス処理（GETリクエスト）
    if (req.method === 'GET') {
      const challenge = url.searchParams.get('hub.challenge');
      const verifyToken = url.searchParams.get('hub.verify_token');
      
      console.log(`🔐 Facebook Webhook認証 - challenge received, verify_token validation`);
      
      // ペルソナのwebhook_verify_tokenを取得
      const { data: persona } = await supabase
        .from('personas')
        .select('webhook_verify_token')
        .eq('id', personaId)
        .maybeSingle();
      
      if (persona && persona.webhook_verify_token && verifyToken === persona.webhook_verify_token) {
        console.log(`✅ Webhook認証成功 - persona: ${personaId}`);
        return new Response(challenge, {
          headers: { 'Content-Type': 'text/plain' }
        });
      } else {
        console.error(`❌ Webhook認証失敗 - 期待値: ${persona?.webhook_verify_token}, 受信値: ${verifyToken}`);
        return new Response('Forbidden', { status: 403 });
      }
    }

    console.log(`📋 処理開始 - ペルソナID: ${personaId}`);

    // ペルソナ情報を取得（自動返信設定も含む）
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

    console.log(`✅ ペルソナ取得成功: ${persona.name}, 自動返信: ${persona.auto_reply_enabled}`);

    // Webhookペイロードを解析（POSTリクエストの場合のみ）
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Webhookペイロードからリプライデータを抽出
function extractRepliesFromPayload(payload: any): any[] {
  console.log('🔍 リプライデータ抽出開始');
  
  const replies = [];
  
  // Meta/Threadsの標準的なwebhook形式
  if (payload.entry && Array.isArray(payload.entry)) {
    for (const entry of payload.entry) {
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if (change.field === 'mention' && change.value) {
            // メンション形式のリプライ
            replies.push(change.value);
            console.log(`✅ メンションリプライ抽出: ${change.value.id} - "${change.value.text}"`);
          } else if (change.field === 'reply' && change.value) {
            // リプライ形式
            replies.push(change.value);
            console.log(`✅ リプライ抽出: ${change.value.id} - "${change.value.text}"`);
          }
        }
      }
    }
  }
  
  // 既存の形式も保持（後方互換性）
  if (payload.values && Array.isArray(payload.values)) {
    for (const valueItem of payload.values) {
      if (valueItem.field === 'replies' && valueItem.value) {
        replies.push(valueItem.value);
        console.log(`✅ レガシーリプライ抽出: ${valueItem.value.id} - "${valueItem.value.text}"`);
      }
    }
  }
  
  console.log(`📊 合計抽出リプライ数: ${replies.length}`);
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

    // Step 1: リプライをデータベースに保存（重複チェックも兼ねる）
    const saveResult = await saveReplyToDatabaseSafe(persona, reply);
    if (!saveResult.isNew) {
      console.log(`⏭️ 既に処理済みのリプライ: ${reply.id}`);
      return false;
    }

    // Step 2: アクティビティログを記録
    await logActivity(persona.user_id, persona.id, 'reply_received', 
      `新しいリプライを受信: @${reply.username}`, {
        author: reply.username,
        reply_id: reply.id,
        reply_text: reply.text
      });

    // Step 3: 自動返信処理（定型文またはAI自動返信が有効な場合のみ）
    if (!persona.auto_reply_enabled && !persona.ai_auto_reply_enabled) {
      console.log(`ℹ️ 自動返信設定がすべてOFF - persona: ${persona.name}`);
      return true;
    }

    console.log(`🤖 自動返信処理開始 - persona: ${persona.name}`);
    
    try {
      // Step 4: トリガー自動返信（定型文）をチェック（auto_reply_enabledの場合のみ）
      if (persona.auto_reply_enabled) {
        const templateResult = await processTemplateAutoReply(persona, reply);
        if (templateResult.sent) {
          console.log(`✅ 定型文自動返信成功 - reply: ${reply.id}`);
          // 返信が送信された場合、auto_reply_sentフラグを更新
          await updateAutoReplySentFlag(reply.id, true);
          return true;
        }
      }

      // Step 5: AI自動返信をチェック
      if (persona.ai_auto_reply_enabled) {
        const aiResult = await processAIAutoReply(persona, reply);
        if (aiResult.sent) {
          console.log(`✅ AI自動返信成功 - reply: ${reply.id}`);
          // 返信が送信された場合、auto_reply_sentフラグを更新
          await updateAutoReplySentFlag(reply.id, true);
          return true;
        }
      }

      console.log(`ℹ️ 自動返信条件に該当なし - persona: ${persona.name}`);
      return true;
    } catch (error) {
      console.error(`❌ 自動返信処理エラー - reply: ${reply.id}:`, error);
      return false;
    }

  } catch (error) {
    console.error(`❌ リプライ処理エラー (${reply.id}):`, error);
    return false;
  }
}

// リプライをデータベースに保存（重複チェック付き）
async function saveReplyToDatabaseSafe(persona: any, reply: any): Promise<{ isNew: boolean }> {
  console.log(`💾 リプライをデータベースに保存中: ${reply.id}`);

  try {
    // まず、既存のリプライをチェック
    const { data: existingReply } = await supabase
      .from('thread_replies')
      .select('id, auto_reply_sent')
      .eq('reply_id', reply.id)
      .maybeSingle();

    if (existingReply) {
      console.log(`⏭️ 既に存在するリプライ: ${reply.id}`);
      return { isNew: false };
    }

    // 新しいリプライを挿入（INSERTのみ使用で重複エラーを回避）
    const { error } = await supabase
      .from('thread_replies')
      .insert({
        user_id: persona.user_id,
        persona_id: persona.id,
        original_post_id: reply.replied_to?.id || reply.root_post?.id,
        reply_id: reply.id,
        reply_text: reply.text || '',
        reply_author_id: reply.username,
        reply_author_username: reply.username,
        reply_timestamp: new Date(reply.timestamp || Date.now()).toISOString(),
        auto_reply_sent: false
      });

    if (error) {
      // 重複エラーの場合（unique constraint violation）
      if (error.code === '23505') {
        console.log(`⏭️ 重複によりスキップ: ${reply.id}`);
        return { isNew: false };
      }
      console.error('❌ リプライ保存エラー:', error);
      throw error;
    }

    console.log(`✅ リプライ保存完了: ${reply.id}`);
    return { isNew: true };
  } catch (error) {
    console.error('❌ リプライ保存処理エラー:', error);
    throw error;
  }
}

// 既存の関数も保持（後方互換性のため）
async function saveReplyToDatabase(persona: any, reply: any): Promise<void> {
  const result = await saveReplyToDatabaseSafe(persona, reply);
  if (!result.isNew) {
    throw new Error('Reply already exists');
  }
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
      console.log(`🔍 キーワード "${cleanKeyword}" をテキスト "${replyText}" と照合中`);
      
      if (replyText.includes(cleanKeyword)) {
        console.log(`🎉 キーワードマッチ: "${keyword}" → 返信: "${setting.response_template}"`);
        
        try {
          // 遅延時間を取得（定型文設定の遅延時間またはペルソナのデフォルト遅延時間）
          const delayMinutes = setting.delay_minutes || persona.auto_reply_delay_minutes || 0;
          
          if (delayMinutes > 0) {
            console.log(`⏰ 定型文返信を${delayMinutes}分後にスケジュール - reply: ${reply.id}`);
            
            // スケジュール時刻を計算
            const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);
            
            // thread_repliesのscheduled_reply_atを更新
            await supabase
              .from('thread_replies')
              .update({ 
                scheduled_reply_at: scheduledTime.toISOString(),
                reply_status: 'scheduled'
              })
              .eq('reply_id', reply.id);
            
            // アクティビティログを記録
            await logActivity(persona.user_id, persona.id, 'template_auto_reply_scheduled',
              `定型文自動返信をスケジュール: "${setting.response_template.substring(0, 50)}..." (${delayMinutes}分後)`, {
                reply_id: reply.id,
                keyword_matched: keyword,
                response_template: setting.response_template,
                scheduled_for: scheduledTime.toISOString(),
                delay_minutes: delayMinutes
              });

            console.log(`✅ 定型文返信スケジュール成功 - ${delayMinutes}分後: ${scheduledTime.toISOString()}`);
            return { sent: true, method: 'template_scheduled' };
          } else {
            // 遅延時間が0分の場合は即座に送信
            console.log(`📤 定型文返信を即座に送信 - reply: ${reply.id}`);
            const success = await sendThreadsReply(persona, reply.id, setting.response_template);
            
            if (success) {
              console.log(`✅ 定型文返信送信成功`);
              // アクティビティログを記録
              await logActivity(persona.user_id, persona.id, 'template_auto_reply_sent',
                `定型文自動返信を送信: "${setting.response_template.substring(0, 50)}..."`, {
                  reply_id: reply.id,
                  keyword_matched: keyword,
                  response_sent: setting.response_template
                });

              return { sent: true, method: 'template' };
            } else {
              console.error(`❌ 定型文返信送信失敗`);
            }
          }
        } catch (error) {
          console.error(`❌ 定型文返信送信エラー:`, error);
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
    // 元投稿の内容を取得
    let originalPostContent = '';
    if (reply.root_post?.id) {
      try {
        // まず、データベースから元投稿を探す
        const { data: existingPost } = await supabase
          .from('posts')
          .select('content')
          .eq('platform', 'threads')
          .contains('hashtags', [reply.root_post.id])
          .maybeSingle();
        
        if (existingPost?.content) {
          originalPostContent = existingPost.content;
          console.log(`📄 データベースから元投稿取得: "${originalPostContent.substring(0, 50)}..."`);
        } else {
          // データベースにない場合はThreads APIから取得を試行
          const accessToken = await getAccessToken(persona);
          if (accessToken) {
            try {
              console.log(`🔍 Fetching root post data for reply processing`);
              const response = await fetch(`https://graph.threads.net/v1.0/${reply.root_post.id}?fields=text&access_token=${accessToken}`);
              if (response.ok) {
                const postData = await response.json();
                originalPostContent = postData.text || '';
                console.log(`📄 Threads APIから元投稿取得: "${originalPostContent.substring(0, 50)}..."`);
              }
            } catch (error) {
              console.log(`⚠️ Threads APIからの投稿取得失敗:`, error);
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ 元投稿取得エラー:`, error);
      }
    }

    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('generate-auto-reply', {
      body: {
        postContent: originalPostContent,
        replyContent: reply.text,
        replyId: reply.id,
        persona: {
          id: persona.id,
          name: persona.name,
          user_id: persona.user_id,
          age: persona.age,
          personality: persona.personality,
          tone_of_voice: persona.tone_of_voice,
          expertise: persona.expertise
        }
      }
    });

    if (aiError) {
      console.error(`❌ AI自動返信エラー:`, aiError);
      return { sent: false };
    }

    if (!aiResponse?.success || !aiResponse?.reply) {
      console.error(`❌ AI返信生成失敗:`, aiResponse);
      return { sent: false };
    }

    console.log(`✅ AI返信生成成功: "${aiResponse.reply}"`);

    // 生成されたAI返信をThreadsに投稿
    const success = await sendThreadsReply(persona, reply.id, aiResponse.reply);
    
    if (success) {
      console.log(`🎉 AI自動返信投稿成功: "${aiResponse.reply}"`);
      
      // アクティビティログを記録
      await logActivity(persona.user_id, persona.id, 'ai_auto_reply_sent',
        `AI自動返信を送信: "${aiResponse.reply.substring(0, 50)}..."`, {
          reply_id: reply.id,
          ai_response: aiResponse.reply
        });

      return { sent: true, method: 'ai' };
    } else {
      console.error(`❌ AI自動返信投稿失敗`);
      return { sent: false };
    }

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

    // コンテナを作成（エンドポイントとmedia_typeを統一）
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

    // Step 1: 新しい方法でトークンを取得（キー名を統一）
    try {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('retrieve-secret', {
        body: { 
          key: `threads_access_token_${persona.id}`,
          fallback: persona.threads_access_token
        }
      });

      if (tokenData?.value && !tokenError) {
        console.log('✅ トークン取得成功（新方式）');
        return tokenData.value;
      }
      console.log('🔄 新方式でトークン取得失敗、従来方式を試行');
    } catch (error) {
      console.log('🔄 新方式エラー、従来方式を試行:', error);
    }

    // Step 2: 従来方式のフォールバック
    const { data: personaWithToken } = await supabase
      .from('personas')
      .select('threads_access_token')
      .eq('id', persona.id)
      .maybeSingle();

    if (!personaWithToken?.threads_access_token) {
      console.error('❌ アクセストークンが見つかりません');
      return null;
    }

    // Step 3: retrieve-secret関数を使用してトークンを取得
    try {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('retrieve-secret', {
        body: { 
          key: `threads_access_token_${persona.id}`,
          fallback: personaWithToken.threads_access_token
        }
      });

      if (tokenData?.secret && !tokenError) {
        console.log('✅ トークン取得成功（retrieve-secret）');
        return tokenData.secret;
      }
    } catch (error) {
      console.log('🔄 retrieve-secret方式エラー:', error);
    }

    // Step 4: 暗号化されていないトークンかチェック
    if (personaWithToken.threads_access_token.startsWith('THAA')) {
      console.log('✅ 非暗号化トークン使用');
      return personaWithToken.threads_access_token;
    }

    // Step 5: 従来の復号化方式を試行
    try {
      const { data: decryptedToken, error: decryptError } = await supabase
        .rpc('decrypt_access_token', { encrypted_token: personaWithToken.threads_access_token });

      if (decryptedToken && !decryptError) {
        console.log('✅ トークン復号化成功（従来方式）');
        return decryptedToken;
      }
    } catch (error) {
      console.error('❌ 復号化処理エラー:', error);
    }

    console.error('❌ 全ての方式でアクセストークン取得失敗');
    return null;

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