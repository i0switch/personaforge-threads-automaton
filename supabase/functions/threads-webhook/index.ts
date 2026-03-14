import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { decryptIfNeeded, verifyHmacSignature } from '../_shared/crypto.ts';
import { normalizeEmojiAndText, isKeywordMatch } from '../_shared/keyword-matcher.ts';

// Phase 2 Security: Rate limiting function
async function checkRateLimit(
  supabase: any,
  endpoint: string,
  identifier: string
): Promise<{ allowed: boolean; retryAfter?: number; reason?: 'rate_limited' | 'check_failed' | 'update_failed' }> {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    
    const { data: recentRequests, error } = await supabase
      .from('rate_limits')
      .select('request_count, window_start')
      .eq('endpoint', endpoint)
      .eq('identifier', identifier)
      .gte('window_start', oneMinuteAgo)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Rate limit check error:', error);
      return { allowed: false, retryAfter: 60, reason: 'check_failed' };
    }

    const limit = 60; // 60 requests per minute
    
    if (recentRequests && recentRequests.request_count >= limit) {
      const retryAfter = Math.ceil(
        (new Date(recentRequests.window_start).getTime() + 60000 - Date.now()) / 1000
      );
      return { allowed: false, retryAfter, reason: 'rate_limited' };
    }

    // レート制限記録を更新
    try {
      await supabase.rpc('upsert_rate_limit', {
        p_endpoint: endpoint,
        p_identifier: identifier
      });
    } catch (err) {
      console.error('Failed to update rate limit:', err);
      return { allowed: false, retryAfter: 60, reason: 'update_failed' };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Rate limit error:', error);
    return { allowed: false, retryAfter: 60, reason: 'check_failed' };
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://threads-genius-ai.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const MAX_AUTO_REPLY_DEPTH = 3;

// HMAC署名検証は共通モジュール (verifyHmacSignature) を使用

// 🔍 DEBUG: Webhookリクエストをデータベースにログ記録
async function logWebhookRequest(
  personaId: string | null, 
  method: string, 
  status: string, 
  details: any
): Promise<void> {
  try {
    await supabase.from('security_events').insert({
      event_type: `webhook_${status}`,
      details: {
        persona_id: personaId,
        method,
        status,
        ...details,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Failed to log webhook request:', err);
  }
}

// Phase 1 Security: Webhook payload validation schema
const WebhookReplyValueSchema = z.object({
  id: z.string().max(100),
  username: z.string().max(50),
  text: z.string().max(5000),
  media_type: z.string().optional(),
  permalink: z.string().url().optional(),
  replied_to: z.object({
    id: z.string().max(100)
  }).optional(),
  root_post: z.object({
    id: z.string().max(100),
    owner_id: z.string().max(100).optional(),
    username: z.string().max(50).optional()
  }).optional(),
  shortcode: z.string().max(100).optional(),
  timestamp: z.string().optional()
});

const WebhookPayloadSchema = z.object({
  app_id: z.string().optional(),
  topic: z.string().optional(),
  target_id: z.string().optional(),
  time: z.number().optional(),
  subscription_id: z.string().optional(),
  has_uid_field: z.boolean().optional(),
  values: z.array(z.object({
    value: WebhookReplyValueSchema,
    field: z.enum(['replies', 'mentions']).optional()
  })).optional(),
  // Legacy format support
  entry: z.array(z.object({
    changes: z.array(z.object({
      field: z.enum(['replies', 'mentions']).optional(),
      value: WebhookReplyValueSchema.optional()
    })).optional()
  })).optional()
});

serve(async (req) => {
  const requestTimestamp = new Date().toISOString();
  console.log(`🚀 Webhook受信: ${req.method} ${req.url} at ${requestTimestamp}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ペルソナIDを取得
    const url = new URL(req.url);
    const personaId = url.searchParams.get('persona_id');
    
    // 🔍 DEBUG: 全リクエストをログ記録（persona_idがなくても記録）
    const debugHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      debugHeaders[key] = value;
    });
    
    console.log(`📥 リクエスト詳細:`, {
      method: req.method,
      url: req.url,
      personaId,
      headers: debugHeaders,
      timestamp: requestTimestamp
    });
    
    if (!personaId) {
      console.error('❌ ペルソナIDが指定されていません');
      // persona_idなしのリクエストもログ記録
      await logWebhookRequest(null, req.method, 'missing_persona_id', { url: req.url, headers: debugHeaders });
      return new Response(JSON.stringify({ error: 'persona_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Phase 2 Security: Rate limit check
    const rateLimitResult = await checkRateLimit(
      supabase,
      'threads-webhook',
      personaId
    );
    
    if (!rateLimitResult.allowed) {
      console.warn(`⚠️ レート制限超過: persona_id=${personaId}`);
      const retryAfter = rateLimitResult.retryAfter || 60;
      const isRateLimitExceeded = rateLimitResult.reason === 'rate_limited';
      const responseStatus = isRateLimitExceeded ? 429 : 503;

      await logWebhookRequest(
        personaId,
        req.method,
        isRateLimitExceeded ? 'rate_limited' : 'rate_limit_check_failed',
        { retryAfter, reason: rateLimitResult.reason || 'unknown' }
      );

      return new Response(
        JSON.stringify({ 
          error: isRateLimitExceeded ? 'Rate limit exceeded' : 'Rate limit check temporarily unavailable',
          retryAfter
        }),
        { 
          status: responseStatus,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter)
          } 
        }
      );
    }

    // Facebook Webhook認証のチャレンジレスポンス処理（GETリクエスト）
    if (req.method === 'GET') {
      const challenge = url.searchParams.get('hub.challenge');
      const verifyToken = url.searchParams.get('hub.verify_token');
      
      console.log(`🔐 Facebook Webhook認証 - challenge received, verify_token validation`);
      
      // 🔍 DEBUG: GET (verification) リクエストをログ記録
      await logWebhookRequest(personaId, 'GET', 'verification_attempt', { 
        hasChallenge: !!challenge, 
        hasVerifyToken: !!verifyToken 
      });
      
      // ペルソナのwebhook_verify_tokenを取得
      const { data: persona } = await supabase
        .from('personas')
        .select('webhook_verify_token, name')
        .eq('id', personaId)
        .maybeSingle();
      
      if (persona && persona.webhook_verify_token && verifyToken === persona.webhook_verify_token) {
        console.log(`✅ Webhook認証成功 - persona: ${personaId} (${persona.name})`);
        await logWebhookRequest(personaId, 'GET', 'verification_success', { personaName: persona.name });
        return new Response(challenge, {
          headers: { 'Content-Type': 'text/plain' }
        });
      } else {
        console.error(`❌ Webhook認証失敗 - 期待値: ${persona?.webhook_verify_token}, 受信値: ${verifyToken}`);
        await logWebhookRequest(personaId, 'GET', 'verification_failed', { 
          expected: persona?.webhook_verify_token ? '[SET]' : '[NOT SET]',
          received: verifyToken ? '[PROVIDED]' : '[NOT PROVIDED]',
          personaName: persona?.name
        });
        return new Response('Forbidden', { status: 403 });
      }
    }

    console.log(`📋 処理開始 - ペルソナID: ${personaId}`);
    
    // 🔍 DEBUG: POSTリクエスト受信をログ記録
    await logWebhookRequest(personaId, 'POST', 'received', { step: 'start' });

    // === H-01: HMAC署名検証 (X-Hub-Signature-256) ===
    const rawBody = await req.text();
    const hubSignature = req.headers.get('x-hub-signature-256');
    
    // ペルソナ情報を取得（署名検証用のapp_secretも含む）
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .maybeSingle();

    if (personaError || !persona) {
      console.error('❌ ペルソナが見つかりません:', personaError);
      await logWebhookRequest(personaId, 'POST', 'persona_not_found', { error: personaError?.message });
      return new Response(JSON.stringify({ error: 'Persona not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // HMAC署名検証（fail-closed）
    if (!hubSignature) {
      await logWebhookRequest(personaId, 'POST', 'signature_missing', { personaName: persona.name });
      return new Response(JSON.stringify({ error: 'Missing X-Hub-Signature-256' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const appSecret = persona.threads_app_secret;
    if (!appSecret) {
      await logWebhookRequest(personaId, 'POST', 'app_secret_missing', { personaName: persona.name });
      return new Response(JSON.stringify({ error: 'App secret is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const secretForVerify = await decryptIfNeeded(appSecret, `app_secret:${persona.name}`);
    if (!secretForVerify) {
      console.error(`❌ app_secret復号失敗 - persona: ${persona.name}`);
      await logWebhookRequest(personaId, 'POST', 'decrypt_failed', { personaName: persona.name });
      return new Response(JSON.stringify({ error: 'App secret decryption failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isValid = await verifyHmacSignature(rawBody, hubSignature, secretForVerify);
    if (!isValid) {
      console.error(`❌ HMAC署名検証失敗 - persona: ${persona.name}`);
      await logWebhookRequest(personaId, 'POST', 'signature_invalid', { personaName: persona.name });
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log(`✅ HMAC署名検証成功 - persona: ${persona.name}`);

    // Webhookペイロードを解析
    let rawPayload;
    try {
      rawPayload = JSON.parse(rawBody);
    } catch (e) {
      console.error('❌ Invalid JSON payload:', e);
      await logWebhookRequest(personaId, 'POST', 'invalid_json', { error: String(e) });
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 🔍 DEBUG: 受信したペイロードをログ記録（詳細）
    await logWebhookRequest(personaId, 'POST', 'payload_received', {
      personaName: persona.name,
      payloadKeys: Object.keys(rawPayload),
      hasEntry: !!rawPayload.entry,
      hasValues: !!rawPayload.values,
      entryCount: rawPayload.entry?.length || 0,
      valuesCount: rawPayload.values?.length || 0,
      rawPayloadPreview: JSON.stringify(rawPayload).substring(0, 500)
    });

    // Phase 1 Security: Validate webhook payload structure
    let payload;
    try {
      payload = WebhookPayloadSchema.parse(rawPayload);
      console.log(`✅ Webhook payload validation passed`);
    } catch (validationError) {
      console.error('❌ Webhook payload validation failed:', validationError);
      await logWebhookRequest(personaId, 'POST', 'payload_validation_failed', {
        personaName: persona.name,
        error: String(validationError),
      });
      return new Response(JSON.stringify({ error: 'Invalid payload schema' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`📦 Webhookペイロード:`, JSON.stringify(payload, null, 2));

    // リプライデータを抽出
    const replies = extractRepliesFromPayload(payload);
    console.log(`📨 抽出されたリプライ数: ${replies.length}`);

    if (replies.length === 0) {
      console.log('ℹ️ 処理対象のリプライがありません');
      // 🔍 DEBUG: リプライ0件の場合の詳細ログ
      await logWebhookRequest(personaId, 'POST', 'no_replies_extracted', {
        personaName: persona.name,
        payloadKeys: Object.keys(payload),
        entryChanges: payload.entry?.[0]?.changes?.map((c: any) => c.field) || [],
        valuesFields: payload.values?.map((v: any) => v.field) || []
      });
      return new Response(JSON.stringify({ message: 'No replies to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 🔍 DEBUG: リプライ抽出成功ログ
    await logWebhookRequest(personaId, 'POST', 'replies_extracted', {
      personaName: persona.name,
      replyCount: replies.length,
      replyIds: replies.map((r: any) => r.id)
    });

    // 各リプライを処理
    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    for (const reply of replies) {
      const result = await processReply(persona, reply);
      if (result.processed) {
        processedCount++;
      }
      if (result.failed) {
        failedCount++;
        if (result.error) errors.push(result.error);
      }
    }

    console.log(`✅ 処理完了 - 成功:${processedCount} 失敗:${failedCount} / 合計:${replies.length}`);
    
    // 🔍 DEBUG: 処理完了ログ
    await logWebhookRequest(personaId, 'POST', 'processing_complete', {
      personaName: persona.name,
      totalReplies: replies.length,
      processedCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined
    });

    // 全件失敗の場合は success: false を返す
    const allFailed = processedCount === 0 && failedCount > 0;
    return new Response(JSON.stringify({ 
      success: !allFailed, 
      processed: processedCount,
      failed: failedCount,
      total: replies.length,
      ...(errors.length > 0 ? { errors } : {})
    }), {
      status: allFailed ? 207 : 200,
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
  console.log(`📋 受信ペイロード構造: entry=${!!payload.entry}, values=${!!payload.values}, object=${payload.object}`);
  
  const replies = [];
  
  // Meta/Threadsの標準的なwebhook形式 (entry.changes)
  if (payload.entry && Array.isArray(payload.entry)) {
    console.log(`📂 entry配列を処理中: ${payload.entry.length}件`);
    for (const entry of payload.entry) {
      console.log(`  📁 entry処理: id=${entry.id}, changes=${entry.changes?.length || 0}件`);
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          console.log(`    📄 change処理: field="${change.field}", hasValue=${!!change.value}`);
          
          // 🔧 修正: 複数形も単数形もサポート (Meta APIの仕様に対応)
          if ((change.field === 'mentions' || change.field === 'mention') && change.value) {
            // メンション形式のリプライ
            replies.push(change.value);
            console.log(`✅ メンションリプライ抽出: ${change.value.id} - "${change.value.text?.substring(0, 50)}..."`);
          } else if ((change.field === 'replies' || change.field === 'reply') && change.value) {
            // リプライ形式
            replies.push(change.value);
            console.log(`✅ リプライ抽出: ${change.value.id} - "${change.value.text?.substring(0, 50)}..."`);
          } else {
            console.log(`⚠️ 未知のフィールド: "${change.field}" - データ破棄されません、ログのみ`);
          }
        }
      }
    }
  }
  
  // 既存の形式も保持（後方互換性）- values形式
  if (payload.values && Array.isArray(payload.values)) {
    console.log(`📂 values配列を処理中: ${payload.values.length}件`);
    for (const valueItem of payload.values) {
      console.log(`  📄 value処理: field="${valueItem.field}", hasValue=${!!valueItem.value}`);
      // 🔧 修正: 複数形も単数形もサポート
      if ((valueItem.field === 'replies' || valueItem.field === 'reply') && valueItem.value) {
        replies.push(valueItem.value);
        console.log(`✅ レガシーリプライ抽出: ${valueItem.value.id} - "${valueItem.value.text?.substring(0, 50)}..."`);
      } else if ((valueItem.field === 'mentions' || valueItem.field === 'mention') && valueItem.value) {
        replies.push(valueItem.value);
        console.log(`✅ レガシーメンション抽出: ${valueItem.value.id} - "${valueItem.value.text?.substring(0, 50)}..."`);
      }
    }
  }
  
  // 🔧 追加: ペイロードが空の場合のデバッグ情報
  if (replies.length === 0) {
    console.warn(`⚠️ リプライ抽出結果: 0件`);
    console.warn(`   ペイロードキー: ${Object.keys(payload).join(', ')}`);
    if (payload.entry?.[0]?.changes?.[0]) {
      console.warn(`   最初のchangeフィールド: "${payload.entry[0].changes[0].field}"`);
    }
  }
  
  console.log(`📊 合計抽出リプライ数: ${replies.length}`);
  return replies;
}

// リプライを処理
async function processReply(persona: any, reply: any): Promise<{ processed: boolean; failed: boolean; error?: string }> {
  try {
    console.log(`\n🔄 リプライ処理開始: ${reply.id} - "${reply.text}" by ${reply.username}`);

    // 自分自身のリプライをスキップ
    if (reply.username === persona.threads_username || reply.username === persona.name) {
      console.log(`⏭️ 自分のリプライをスキップ: ${reply.id}`);
      return { processed: false, failed: false };
    }

    const safety = await evaluateReplyRoutingSafety(persona, reply);
    if (safety.skip) {
      console.log(`⏭️ ループ防止によりスキップ: ${reply.id} (${safety.reason})`);
      return { processed: false, failed: false };
    }

    // Step 1: リプライをデータベースに保存（重複チェックも兼ねる）
    const saveResult = await saveReplyToDatabaseSafe(persona, reply, safety.replyDepth);
    if (!saveResult.isNew) {
      console.log(`⏭️ 既に処理済みのリプライ: ${reply.id}`);
      return { processed: false, failed: false };
    }

    const { data: claimResult, error: claimError } = await supabase
      .from('thread_replies')
      .update({
        reply_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('reply_id', reply.id)
      .eq('auto_reply_sent', false)
      .eq('reply_status', 'pending')
      .select('id');

    if (claimError || !claimResult || claimResult.length === 0) {
      console.log(`⏭️ Webhook claim失敗（他経路処理中の可能性）: ${reply.id}`);
      return { processed: false, failed: false };
    }

    // Step 2: アクティビティログを記録
    await logActivity(persona.user_id, persona.id, 'reply_received', 
      `新しいリプライを受信: @${reply.username}`, {
        author: reply.username,
        reply_id: reply.id,
        reply_text: reply.text
      });

    // Step 3: 自動返信処理（定型文またはAI自動返信が有効な場合のみ）
    if (!persona.ai_auto_reply_enabled) {
      console.log(`ℹ️ AI自動返信OFF - キーワード自動返信のみチェック - persona: ${persona.name}`);
    }

    console.log(`🤖 自動返信処理開始 - persona: ${persona.name}`);
    
    try {
      // Step 4: トリガー自動返信（定型文）をチェック
      const templateResult = await processTemplateAutoReply(persona, reply);
      if (templateResult.sent) {
        if (templateResult.method === 'template_scheduled') {
          console.log(`⏰ 定型文自動返信スケジュール成功 - reply: ${reply.id} (送信時刻待ち)`);
        } else {
          console.log(`✅ 定型文自動返信即時送信成功 - reply: ${reply.id}`);
          await updateAutoReplySentFlag(reply.id, true);
        }
        return { processed: true, failed: false };
      }

      // Step 5: AI自動返信をチェック（AI自動返信ONの場合のみ）
      // キーワード返信(auto_reply_enabled)のみONの場合、キーワード不一致時はAIフォールバックしない
      if (persona.ai_auto_reply_enabled) {
        console.log(`🔄 AI自動返信実行: ai=${persona.ai_auto_reply_enabled}, keyword=${persona.auto_reply_enabled}`);
        const aiResult = await processAIAutoReply(persona, reply);
        if (aiResult.sent) {
          if (aiResult.method === 'ai_scheduled') {
            console.log(`⏰ AI自動返信スケジュール成功 - reply: ${reply.id} (送信時刻待ち)`);
          } else {
            console.log(`✅ AI自動返信即時送信成功 - reply: ${reply.id}`);
            await updateAutoReplySentFlag(reply.id, true);
          }
          return { processed: true, failed: false };
        }
        // AI返信が sent=false で返ってきた場合は失敗
        if (aiResult.error) {
          return { processed: false, failed: true, error: aiResult.error };
        }
      }

      console.log(`ℹ️ 自動返信条件に該当なし - persona: ${persona.name}`);
      
      // ★ CRITICAL FIX: 自動返信条件に該当しない場合、reply_statusを'completed'に更新
      // これにより、processing状態のまま放置されてタイムアウトする問題を防止
      await supabase
        .from('thread_replies')
        .update({ 
          reply_status: 'completed',
          auto_reply_sent: true,  // 処理完了済みとしてマーク（再処理防止）
          error_details: {
            info: 'No auto-reply condition matched',
            ai_auto_reply_enabled: persona.ai_auto_reply_enabled,
            auto_reply_enabled: persona.auto_reply_enabled,
            timestamp: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('reply_id', reply.id);
      
      return { processed: true, failed: false };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ 自動返信処理エラー - reply: ${reply.id}:`, error);
      
      // DB にエラー詳細を記録 + auto_reply_sent管理
      await supabase
        .from('thread_replies')
        .update({ 
          reply_status: 'failed',
          auto_reply_sent: false,  // ★ リトライ可能にする（エラー時のみ）
          error_details: {
            error_type: 'auto_reply_processing_error',
            error_message: errMsg,
            timestamp: new Date().toISOString()
          }
        })
        .eq('reply_id', reply.id);
      
      return { processed: false, failed: true, error: errMsg };
    }

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ リプライ処理エラー (${reply.id}):`, error);
    return { processed: false, failed: true, error: errMsg };
  }
}

// リプライをデータベースに保存（重複チェック付き）
async function saveReplyToDatabaseSafe(persona: any, reply: any, replyDepth: number): Promise<{ isNew: boolean }> {
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
        auto_reply_sent: false,
        reply_status: 'pending',
        error_details: {
          ingest_source: 'webhook',
          reply_depth: replyDepth,
          loop_guard_version: '2026-03-03'
        }
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
  const result = await saveReplyToDatabaseSafe(persona, reply, 0);
  if (!result.isNew) {
    throw new Error('Reply already exists');
  }
}

async function evaluateReplyRoutingSafety(
  persona: any,
  reply: any
): Promise<{ skip: boolean; reason?: string; replyDepth: number }> {
  const author = String(reply.username || '').toLowerCase();
  const botUsernames = await getBotUsernamesForUser(persona.user_id);

  if (author && botUsernames.has(author)) {
    return { skip: true, reason: 'bot_author_detected', replyDepth: 0 };
  }

  const parentReplyId = reply.replied_to?.id || reply.root_post?.id;
  if (!parentReplyId) {
    return { skip: false, replyDepth: 0 };
  }

  const { data: parentReply } = await supabase
    .from('thread_replies')
    .select('persona_id, error_details')
    .eq('reply_id', parentReplyId)
    .maybeSingle();

  if (!parentReply) {
    return { skip: false, replyDepth: 0 };
  }

  const parentDepthRaw = Number(parentReply.error_details?.reply_depth ?? 0);
  const parentDepth = Number.isFinite(parentDepthRaw) ? parentDepthRaw : 0;
  const replyDepth = parentDepth + 1;

  if (parentReply.persona_id && parentReply.persona_id !== persona.id) {
    return { skip: true, reason: 'cross_persona_parent_detected', replyDepth };
  }

  if (replyDepth > MAX_AUTO_REPLY_DEPTH) {
    return { skip: true, reason: 'reply_depth_limit_exceeded', replyDepth };
  }

  return { skip: false, replyDepth };
}

async function getBotUsernamesForUser(userId: string): Promise<Set<string>> {
  const botUsernames = new Set<string>();

  const { data: personas } = await supabase
    .from('personas')
    .select('name, threads_username')
    .eq('user_id', userId)
    .eq('is_active', true);

  for (const persona of personas || []) {
    if (persona.threads_username) {
      botUsernames.add(String(persona.threads_username).toLowerCase());
    }
    if (persona.name) {
      botUsernames.add(String(persona.name).toLowerCase());
    }
  }

  return botUsernames;
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

  const replyText = reply.text || '';
  const normalizedReply = normalizeEmojiAndText(replyText);
  console.log(`🔍 リプライテキスト: "${replyText}" → 正規化: "${normalizedReply}"`);

  for (const setting of autoRepliesSettings) {
    const keywords = setting.trigger_keywords || [];
    console.log(`🔑 チェック中のキーワード:`, keywords);

    for (const keyword of keywords) {
      const normalizedKeyword = normalizeEmojiAndText(keyword);
      console.log(`🔍 キーワード "${keyword}" → 正規化: "${normalizedKeyword}" をテキストと照合中`);
      
      if (isKeywordMatch(replyText, keyword)) {
        console.log(`🎉 キーワードマッチ成功: "${keyword}" → 返信: "${setting.response_template}"`);
        
        try {
          // 遅延時間を取得（定型文設定の遅延時間またはペルソナのデフォルト遅延時間）
          const delayMinutes = setting.delay_minutes || persona.auto_reply_delay_minutes || 0;
          
          if (delayMinutes > 0) {
            console.log(`⏰ 定型文返信を${delayMinutes}分後にスケジュール - reply: ${reply.id}`);
            
            // スケジュール時刻を計算
            const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);
            
            // thread_repliesのscheduled_reply_atとai_response（定型文）を保存
            await supabase
              .from('thread_replies')
              .update({ 
                ai_response: setting.response_template,  // 定型文を保存
                scheduled_reply_at: scheduledTime.toISOString(),
                reply_status: 'scheduled'  // 遅延送信のためscheduledステータスを使用
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

            // ★ アトミックロック: auto_reply_sent=falseの場合のみtrueに更新（重複送信防止）
            const { data: lockResult, error: lockError } = await supabase
              .from('thread_replies')
              .update({ auto_reply_sent: true, updated_at: new Date().toISOString() })
              .eq('reply_id', reply.id)
              .eq('auto_reply_sent', false)
              .select('id');
            
            if (lockError) {
              console.error(`❌ ロック取得エラー - reply: ${reply.id}:`, lockError);
              return { sent: false };
            }
            
            if (!lockResult || lockResult.length === 0) {
              console.log(`⏭️ 既に返信送信済み（重複スキップ） - reply: ${reply.id}`);
              return { sent: true, method: 'template' }; // 既に送信済みとして扱う
            }
            
            console.log(`🔒 ロック取得成功 - reply: ${reply.id}、送信開始`);
            const sendResult = await sendThreadsReply(persona, reply.id, setting.response_template);
            
            if (sendResult.success) {
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
              console.error(`❌ 定型文返信送信失敗:`, sendResult.error);
              
              // 送信失敗時はロックを解放（auto_reply_sentをfalseに戻す）
              await supabase
                .from('thread_replies')
                .update({ auto_reply_sent: false, updated_at: new Date().toISOString() })
                .eq('reply_id', reply.id);
              
              // Update reply status to failed with error details
              const errorDetails = sendResult.errorDetails || {
                error_type: 'template_reply_send_failed',
                error_message: sendResult.error || 'Unknown error during template reply send',
                timestamp: new Date().toISOString(),
                response_template: setting.response_template
              };
              
              const { error: updateError } = await supabase
                .from('thread_replies')
                .update({ 
                  reply_status: 'failed',
                  error_details: errorDetails,
                  updated_at: new Date().toISOString()
                })
                .eq('reply_id', reply.id);
              
              if (updateError) {
                console.error('Failed to update reply status to failed:', updateError);
              } else {
                console.log('✅ Updated reply status to failed with error details');
              }
              
              await logActivity(persona.user_id, persona.id, 'auto_reply_failed',
                `定型文返信送信失敗: ${sendResult.error || 'Unknown error'}`);
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
async function processAIAutoReply(persona: any, reply: any): Promise<{ sent: boolean, method?: string, error?: string }> {
  console.log(`🧠 AI自動返信処理開始 - persona: ${persona.name}`);

  try {
    // 元投稿の内容を取得
    let originalPostContent = '';
    if (reply.root_post?.id) {
      try {
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
              const response = await fetch(`https://graph.threads.net/v1.0/${reply.root_post.id}?fields=text`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });
              if (response.ok) {
                const postData = await response.json();
                originalPostContent = postData.text || '';
                console.log(`📄 Threads APIから元投稿取得: "${originalPostContent.substring(0, 50)}..."`);
              } else {
                await response.text(); // consume body
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

    // threads-auto-reply関数を呼び出して、AI返信生成とスケジューリングをすべて委譲
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('threads-auto-reply', {
      body: {
        postContent: originalPostContent,
        replyContent: reply.text,
        replyId: reply.id,
        personaId: persona.id,
        userId: persona.user_id
      }
    });

    if (aiError) {
      const errMsg = `AI auto-reply invocation failed: ${aiError.message || String(aiError)}`;
      console.error(`❌ AI自動返信エラー:`, aiError);
      
      // DB にエラー詳細を記録
      await supabase
        .from('thread_replies')
        .update({ 
          reply_status: 'failed',
          error_details: {
            error_type: 'ai_reply_invocation_failed',
            error_message: errMsg,
            timestamp: new Date().toISOString()
          }
        })
        .eq('reply_id', reply.id);
      
      return { sent: false, error: errMsg };
    }

    if (!aiResponse?.success) {
      const errMsg = `AI reply returned failure: ${JSON.stringify(aiResponse?.error || aiResponse)}`;
      console.error(`❌ AI返信処理失敗:`, aiResponse);
      
      // DB にエラー詳細を記録
      await supabase
        .from('thread_replies')
        .update({ 
          reply_status: 'failed',
          error_details: {
            error_type: 'ai_reply_processing_failed',
            error_message: errMsg,
            ai_response: aiResponse,
            timestamp: new Date().toISOString()
          }
        })
        .eq('reply_id', reply.id);
      
      return { sent: false, error: errMsg };
    }

    console.log(`✅ AI返信処理成功: ${aiResponse.scheduled ? 'スケジュール' : '即時送信'}`);
    return { sent: true, method: aiResponse.scheduled ? 'ai_scheduled' : 'ai' };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ AI自動返信処理エラー:`, error);
    
    // DB にエラー詳細を記録
    await supabase
      .from('thread_replies')
      .update({ 
        reply_status: 'failed',
        error_details: {
          error_type: 'ai_reply_exception',
          error_message: errMsg,
          timestamp: new Date().toISOString()
        }
      })
      .eq('reply_id', reply.id);
    
    return { sent: false, error: errMsg };
  }
}

// Threads APIを使用して返信を送信
async function sendThreadsReply(
  persona: any, 
  replyToId: string, 
  responseText: string
): Promise<{ success: boolean; error?: string; errorDetails?: any }> {
  try {
    console.log(`📤 Threads返信送信開始: "${responseText}" (Reply to: ${replyToId})`);

    // アクセストークンを取得
    const accessToken = await getAccessToken(persona);
    if (!accessToken) {
      console.error('❌ アクセストークンの取得に失敗');
      return {
        success: false,
        error: 'Failed to get access token',
        errorDetails: {
          error_type: 'token_retrieval_failed',
          error_message: 'Could not retrieve access token for persona',
          timestamp: new Date().toISOString()
        }
      };
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
      
      let errorDetails;
      try {
        const errorData = JSON.parse(errorText);
        errorDetails = {
          error_type: 'container_creation_failed',
          error_message: errorData.error?.message || errorText,
          error_code: errorData.error?.code,
          error_subcode: errorData.error?.error_subcode,
          http_status: createResponse.status,
          timestamp: new Date().toISOString()
        };
      } catch {
        errorDetails = {
          error_type: 'container_creation_failed',
          error_message: errorText,
          http_status: createResponse.status,
          timestamp: new Date().toISOString()
        };
      }
      
      return {
        success: false,
        error: `Container creation failed: ${errorText}`,
        errorDetails
      };
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
      
      // レート制限エラーを検出
      let errorDetails: Record<string, any>;
      try {
        const errorData = JSON.parse(errorText);
        errorDetails = {
          error_type: 'publish_failed',
          error_message: errorData.error?.message || errorData.error?.error_user_msg || errorText,
          error_code: errorData.error?.code,
          error_subcode: errorData.error?.error_subcode,
          http_status: publishResponse.status,
          timestamp: new Date().toISOString()
        };
        
        // error_code 613: Threads API 返信レート制限
        if (errorData.error?.code === 613) {
          console.warn('🚨 Threads API 返信レート制限 (error 613) 検出');
          
          // activity_logs に記録してUIが通知できるようにする
          await supabase
            .from('activity_logs')
            .insert({
              user_id: persona.user_id,
              persona_id: persona.id,
              action_type: 'threads_reply_rate_limited',
              description: `Threads APIの返信レート制限に達しました (error 613): ペルソナ「${persona.name}」`,
              metadata: {
                error_code: 613,
                error_subcode: errorData.error?.error_subcode,
                error_message: errorData.error?.message,
                persona_name: persona.name,
                timestamp: new Date().toISOString()
              }
            });
          
          errorDetails.rate_limited_613 = true;
          console.log(`✅ error 613 を activity_logs に記録しました`);
        }
        
        if (errorData.error?.error_subcode === 2207051) {
          console.warn('🚨 スパム検出/レート制限を検出 - ペルソナを制限状態に設定');
          
          const rateLimitUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間後
          
          await supabase
            .from('personas')
            .update({
              is_rate_limited: true,
              rate_limit_detected_at: new Date().toISOString(),
              rate_limit_reason: `スパム検出: ${errorData.error?.error_user_msg || 'アクティビティが制限されました'}`,
              rate_limit_until: rateLimitUntil.toISOString()
            })
            .eq('id', persona.id);
          
          console.log(`✅ ペルソナ ${persona.name} をレート制限状態に設定しました`);
          
          errorDetails.rate_limited = true;
          errorDetails.rate_limit_until = rateLimitUntil.toISOString();
        }
      } catch (parseError) {
        console.error('エラーレスポンスのパース失敗:', parseError);
        errorDetails = {
          error_type: 'publish_failed',
          error_message: errorText,
          http_status: publishResponse.status,
          timestamp: new Date().toISOString()
        };
      }
      
      return {
        success: false,
        error: `Publish failed: ${errorText}`,
        errorDetails
      };
    }

    const publishData = await publishResponse.json();
    console.log(`🎉 返信送信成功: ${publishData.id}`);
    return { success: true };

  } catch (error) {
    console.error('❌ Threads返信送信エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: {
        error_type: 'unexpected_error',
        error_message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    };
  }
}

// アクセストークンを取得（共通復号モジュール使用、RPCフォールバック廃止）
async function getAccessToken(persona: any): Promise<string | null> {
  try {
    console.log('🔑 アクセストークン取得開始');

    // Step 1: retrieve-secret経由で取得
    try {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('retrieve-secret', {
        body: { 
          key: `threads_access_token_${persona.id}`,
          fallback: persona.threads_access_token
        }
      });

      if ((tokenData?.secret || tokenData?.value) && !tokenError) {
        console.log('✅ トークン取得成功（retrieve-secret）');
        return tokenData.secret || tokenData.value;
      }
      console.log('🔄 retrieve-secret失敗、直接復号を試行');
    } catch (error) {
      console.log('🔄 retrieve-secretエラー:', error);
    }

    // Step 2: DBから直接取得して共通モジュールで復号
    const { data: personaWithToken } = await supabase
      .from('personas')
      .select('threads_access_token')
      .eq('id', persona.id)
      .maybeSingle();

    if (!personaWithToken?.threads_access_token) {
      console.error('❌ アクセストークンが見つかりません');
      return null;
    }

    const token = await decryptIfNeeded(
      personaWithToken.threads_access_token,
      `access_token:${persona.name}`
    );

    if (token) {
      console.log('✅ トークン復号成功（共通モジュール）');
      return token;
    }

    console.error('❌ 全ての方式でアクセストークン取得失敗');
    return null;

  } catch (error) {
    console.error('❌ トークン取得エラー:', error);
    return null;
  }
}

// auto_reply_sentフラグと返信ステータスを更新
async function updateAutoReplySentFlag(replyId: string, sent: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('thread_replies')
      .update({ 
        auto_reply_sent: sent,
        reply_status: sent ? 'sent' : 'pending',
        error_details: sent
          ? {
              bot_generated: true,
              generation_mode: 'webhook_auto_reply',
              loop_guard_version: '2026-03-03',
              updated_at: new Date().toISOString()
            }
          : {
              loop_guard_version: '2026-03-03',
              updated_at: new Date().toISOString()
            }
      })
      .eq('reply_id', replyId);
    
    if (error) {
      console.error('❌ 返信ステータス更新エラー:', error);
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