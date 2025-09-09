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

    // Gemini APIを使用してAI返信を生成
    console.log(`🧠 AI返信生成開始 - リプライ内容: "${replyContent}"`);
    
    // 元投稿とリプライチェーンの情報を取得
    const contextInfo = await getReplyContext(replyId, supabase);
    
    const aiPrompt = `あなたは${persona.name}です。
年齢: ${persona.age || '不明'}
性格: ${persona.personality || 'フレンドリー'}  
話し方: ${persona.tone_of_voice || 'カジュアル'}
専門分野: ${persona.expertise?.join(', ') || 'なし'}

以下の会話に対して、このペルソナとして140文字以内で自然に返信してください。

${contextInfo.originalPost ? `【元投稿】\n${contextInfo.originalPost}\n` : ''}${contextInfo.replyChain ? `【これまでの会話】\n${contextInfo.replyChain}\n` : ''}【今回のリプライ】
${replyContent}`;

    const aiReplyText = await generateWithGeminiRotation(aiPrompt, userId);
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

    // 遅延時間を取得
    const delayMinutes = persona.auto_reply_delay_minutes || 0;
    
    if (delayMinutes > 0) {
      console.log(`⏰ AI自動返信を${delayMinutes}分後にスケジュール - reply: ${replyId}`);
      
      // スケジュール時刻を計算
      const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);
      
      // thread_repliesのscheduled_reply_atを更新
      const { error: updateError } = await supabase
        .from('thread_replies')
        .update({ 
          scheduled_reply_at: scheduledTime.toISOString(),
          reply_status: 'scheduled'
        })
        .eq('reply_id', replyId);
      
      if (updateError) {
        console.error('❌ スケジュール更新エラー:', updateError);
      }
      
      // AI返信内容をメタデータとして保存（後で送信するため）
      await supabase
        .from('activity_logs')
        .insert({
          user_id: userId,
          persona_id: personaId,
          action_type: 'ai_auto_reply_scheduled',
          description: `AI自動返信をスケジュール: "${aiReplyText.substring(0, 50)}..." (${delayMinutes}分後)`,
          metadata: {
            reply_id: replyId,
            ai_response: aiReplyText,
            scheduled_for: scheduledTime.toISOString(),
            delay_minutes: delayMinutes,
            persona_data: {
              id: persona.id,
              name: persona.name,
              user_id: persona.user_id
            }
          }
        });

      console.log(`✅ AI自動返信スケジュール成功 - ${delayMinutes}分後: ${scheduledTime.toISOString()}`);
      return new Response(JSON.stringify({ 
        success: true, 
        scheduled: true,
        aiResponse: aiReplyText,
        scheduledFor: scheduledTime.toISOString(),
        delayMinutes: delayMinutes,
        replyId: replyId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      // 遅延時間が0分の場合は即座に送信
      console.log(`📤 AI自動返信を即座に送信 - reply: ${replyId}`);
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
    }

  } catch (error) {
    console.error('❌ AI自動返信処理エラー:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ユーザーAPIキーを取得する関数
async function getUserApiKey(userId: string, keyName: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', userId)
      .eq('key_name', keyName)
      .single();

    if (error || !data) return null;

    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) return null;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const encryptedData = Uint8Array.from(atob(data.encrypted_key), c => c.charCodeAt(0));
    const iv = encryptedData.slice(0, 12);
    const ciphertext = encryptedData.slice(12);

    // Try current AES-GCM (raw key padded to 32 bytes)
    try {
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        keyMaterial,
        ciphertext
      );
      return decoder.decode(decrypted);
    } catch (_e) {
      // Fallback: legacy PBKDF2-derived AES-GCM
      try {
        const baseKey = await crypto.subtle.importKey(
          'raw',
          encoder.encode(encryptionKey),
          { name: 'PBKDF2' },
          false,
          ['deriveKey']
        );
        const derivedKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: encoder.encode('salt'),
            iterations: 100000,
            hash: 'SHA-256',
          },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          derivedKey,
          ciphertext
        );
        console.log('Legacy key decryption succeeded (PBKDF2 fallback).');
        return decoder.decode(decrypted);
      } catch (e2) {
        console.error('Failed to decrypt user API key with both methods:', e2);
        return null;
      }
    }
  } catch (e) {
    console.error('Failed to get user API key:', e);
    return null;
  }
}

// 全てのGemini APIキーを取得
async function getAllGeminiApiKeys(userId: string): Promise<string[]> {
  const apiKeys: string[] = [];
  
  // Try all possible Gemini API keys (1-10)
  for (let i = 1; i <= 10; i++) {
    const keyName = i === 1 ? 'GEMINI_API_KEY' : `GEMINI_API_KEY_${i}`;
    const apiKey = await getUserApiKey(userId, keyName);
    if (apiKey) {
      apiKeys.push(apiKey);
    }
  }
  
  return apiKeys;
}

// Gemini APIローテーション機能付き生成
async function generateWithGeminiRotation(prompt: string, userId: string): Promise<string> {
  const apiKeys = await getAllGeminiApiKeys(userId);
  
  if (apiKeys.length === 0) {
    throw new Error('Gemini API key is not configured. Please set your API key in Settings.');
  }
  
  let lastError: Error | null = null;
  
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    console.log(`Trying Gemini API key ${i + 1}/${apiKeys.length}`);
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API request failed with key ${i + 1}:`, response.status, response.statusText, errorText);
        throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('No content generated by Gemini API');
      }

      const generatedText = data.candidates[0].content.parts[0].text;
      console.log(`Successfully generated content with API key ${i + 1}`);
      return generatedText;
    } catch (error) {
      console.log(`API key ${i + 1} failed:`, error.message);
      lastError = error;
      
      // Check if it's a quota/rate limit error that should trigger rotation
      if (error.message.includes('429') || 
          error.message.includes('quota') || 
          error.message.includes('RESOURCE_EXHAUSTED') ||
          error.message.includes('Rate limit')) {
        console.log(`Rate limit/quota error detected, trying next API key...`);
        continue;
      } else {
        // For other errors, don't continue trying other keys
        throw error;
      }
    }
  }
  
  // If all keys failed, throw the last error
  throw lastError || new Error('All Gemini API keys failed');
}

// アクセストークンを取得
async function getAccessToken(persona: any): Promise<string | null> {
  try {
    console.log('🔑 アクセストークン取得開始 - ペルソナ:', persona.name);

    // retrieve-secret関数を使用してトークンを取得
    try {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('retrieve-secret', {
        body: { 
          key: `threads_access_token_${persona.id}`,
          fallback: persona.threads_access_token
        }
      });

      if (tokenData?.secret && !tokenError) {
        console.log('✅ 暗号化トークン復号化成功 - persona:', persona.name);
        return tokenData.secret;
      } else if (tokenError) {
        console.error('❌ retrieve-secret エラー:', tokenError);
      }
    } catch (error) {
      console.error('🔄 retrieve-secret方式エラー:', error);
    }

    // 暗号化されていないトークンかチェック
    if (persona.threads_access_token?.startsWith('THAA')) {
      console.log('✅ 非暗号化トークン使用 - persona:', persona.name);
      return persona.threads_access_token;
    }

    console.error('❌ 全ての方式でアクセストークン取得失敗 - persona:', persona.name, {
      hasToken: !!persona.threads_access_token,
      tokenPrefix: persona.threads_access_token?.substring(0, 8) + '...'
    });
    return null;

  } catch (error) {
    console.error('❌ トークン取得エラー - persona:', persona.name, error);
    return null;
  }
}

// リプライの文脈情報を取得する関数
async function getReplyContext(replyId: string, supabase: any) {
  try {
    // 現在のリプライ情報を取得
    const { data: currentReply, error: replyError } = await supabase
      .from('thread_replies')
      .select('thread_id, parent_id, content')
      .eq('reply_id', replyId)
      .single();

    if (replyError || !currentReply) {
      console.log('⚠️ リプライ情報取得失敗、リプライのみで返信生成');
      return { originalPost: null, replyChain: null };
    }

    const threadId = currentReply.thread_id;
    let originalPost = null;
    let replyChain = null;

    // 元投稿を取得（thread_idで検索）
    try {
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('content')
        .eq('threads_post_id', threadId)
        .single();

      if (!postError && postData) {
        originalPost = postData.content;
      }
    } catch (e) {
      console.log('📝 元投稿情報なし（外部投稿の可能性）');
    }

    // リプライチェーンを取得（同じthread_idの過去のリプライを時系列順で）
    try {
      const { data: chainData, error: chainError } = await supabase
        .from('thread_replies')
        .select('content, created_at, reply_id')
        .eq('thread_id', threadId)
        .neq('reply_id', replyId) // 現在のリプライは除外
        .order('created_at', { ascending: true })
        .limit(10); // 最大10件の過去リプライ

      if (!chainError && chainData && chainData.length > 0) {
        replyChain = chainData
          .map((reply: any, index: number) => `${index + 1}. ${reply.content}`)
          .join('\n');
      }
    } catch (e) {
      console.log('🔄 リプライチェーン取得エラー:', e);
    }

    console.log(`📖 文脈情報取得完了 - 元投稿: ${originalPost ? 'あり' : 'なし'}, チェーン: ${replyChain ? 'あり' : 'なし'}`);
    return { originalPost, replyChain };

  } catch (error) {
    console.error('❌ 文脈情報取得エラー:', error);
    return { originalPost: null, replyChain: null };
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