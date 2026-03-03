import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { getUserApiKeyDecrypted } from '../_shared/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://threads-genius-ai.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 🚨 CRITICAL: Check system-wide posting pause before ANY posting operations
async function checkSystemPause(): Promise<{ paused: boolean; reason?: string }> {
  try {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('posting_paused, pause_reason')
      .limit(1)
      .single();
    
    if (error || !settings) {
      console.log('No system settings found, defaulting to allowed');
      return { paused: false };
    }
    
    return { paused: settings.posting_paused, reason: settings.pause_reason };
  } catch (error) {
    console.error('Failed to check system pause status:', error);
    return { paused: false }; // Fail safe
  }
}

// Rate limiting to prevent API quota exhaustion
const RATE_LIMITS = {
  MAX_POSTS_PER_PERSONA_PER_HOUR: 10,
  MAX_TOTAL_POSTS_PER_RUN: 5,
  GEMINI_RETRY_LIMIT: 3, // Reduced from 10
  COOLDOWN_AFTER_FAILURE: 60 * 60 * 1000 // 1 hour in ms
};

const AUTO_POST_CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

async function releaseExpiredAutoPostClaims(nowIso: string): Promise<number> {
  const { data, error } = await supabase
    .from('auto_post_configs')
    .update({
      processing_status: 'idle',
      claim_token: null,
      claim_expires_at: null,
      processing_started_at: null,
      updated_at: nowIso
    })
    .in('processing_status', ['claimed', 'processing'])
    .lt('claim_expires_at', nowIso)
    .select('id');

  if (error) {
    console.error('Failed to release expired auto-post claims:', error);
    return 0;
  }

  return data?.length || 0;
}

async function claimAutoPostConfig(cfgId: string, expectedNextRunAt: string, workerId: string): Promise<string | null> {
  const nowIso = new Date().toISOString();
  const claimToken = `${workerId}:${crypto.randomUUID()}`;
  const claimExpiresAt = new Date(Date.now() + AUTO_POST_CLAIM_TIMEOUT_MS).toISOString();

  const { data, error } = await supabase
    .from('auto_post_configs')
    .update({
      processing_status: 'claimed',
      claim_token: claimToken,
      claim_expires_at: claimExpiresAt,
      processing_started_at: nowIso,
      updated_at: nowIso
    })
    .eq('id', cfgId)
    .eq('is_active', true)
    .eq('next_run_at', expectedNextRunAt)
    .or(`processing_status.is.null,processing_status.eq.idle,claim_expires_at.lt.${nowIso}`)
    .select('id, claim_token')
    .maybeSingle();

  if (error) {
    console.error(`Failed to claim auto-post config ${cfgId}:`, error);
    return null;
  }

  if (!data?.claim_token) {
    return null;
  }

  return data.claim_token;
}

async function moveClaimToProcessing(cfgId: string, claimToken: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('auto_post_configs')
    .update({
      processing_status: 'processing',
      updated_at: new Date().toISOString()
    })
    .eq('id', cfgId)
    .eq('claim_token', claimToken)
    .eq('processing_status', 'claimed')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error(`Failed to move config ${cfgId} claim to processing:`, error);
    return false;
  }

  return Boolean(data?.id);
}

async function finalizeAutoPostClaim(
  cfgId: string,
  claimToken: string,
  updates: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase
    .from('auto_post_configs')
    .update({
      ...updates,
      processing_status: 'idle',
      claim_token: null,
      claim_expires_at: null,
      processing_started_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', cfgId)
    .eq('claim_token', claimToken);

  if (error) {
    console.error(`Failed to finalize claim for config ${cfgId}:`, error);
  }
}

async function checkPersonaRateLimit(personaId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const { data: recentPosts, error } = await supabase
    .from('posts')
    .select('id')
    .eq('persona_id', personaId)
    .eq('auto_schedule', true)
    .gte('created_at', oneHourAgo.toISOString());
    
  if (error) {
    console.error('Rate limit check failed:', error);
    return false; // Fail safe - deny
  }
  
  const count = recentPosts?.length || 0;
  console.log(`Rate limit check for persona ${personaId}: ${count}/${RATE_LIMITS.MAX_POSTS_PER_PERSONA_PER_HOUR} posts in last hour`);
  
  return count < RATE_LIMITS.MAX_POSTS_PER_PERSONA_PER_HOUR;
}

async function getUserApiKey(userId: string, keyName: string): Promise<string | null> {
  return getUserApiKeyDecrypted(supabase, userId, keyName);
}

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

async function generateWithGeminiRotation(prompt: string, userId: string): Promise<string> {
  const apiKeys = await getAllGeminiApiKeys(userId);
  
  if (apiKeys.length === 0) {
    throw new Error('No Gemini API keys configured');
  }
  
  let lastError: Error | null = null;
  
  // 🚨 CRITICAL: Limit retries to prevent quota exhaustion (最大2回まで)
  const maxTries = Math.min(apiKeys.length, 2); // さらに制限強化
  
  for (let i = 0; i < maxTries; i++) {
    const apiKey = apiKeys[i];
    console.log(`Trying Gemini API key ${i + 1}/${maxTries} (limited from ${apiKeys.length} available)`);
    
    try {
      const result = await generateWithGemini(prompt, apiKey);
      console.log(`Successfully generated content with API key ${i + 1}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`API key ${i + 1} failed:`, errorMessage);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if it's a quota/rate limit error
      if (errorMessage.includes('429') || 
          errorMessage.includes('quota') || 
          errorMessage.includes('RESOURCE_EXHAUSTED') ||
          errorMessage.includes('Rate limit')) {
        console.log(`Rate limit/quota error detected, trying next API key...`);
        continue;
      } else {
        // For other errors, don't continue trying other keys
        console.error(`Non-quota error detected, stopping retry attempts: ${errorMessage}`);
        throw error;
      }
    }
  }
  
  // If all limited keys failed, throw the last error
  throw lastError || new Error(`All ${maxTries} Gemini API keys failed (quota exhausted)`);
}

async function generateWithGemini(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error('Gemini API key is not configured');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${txt}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini returned empty content');
  return text.trim();
}

function getTimeOfDay(scheduledTime?: string): string {
  if (!scheduledTime) return '';
  
  const date = new Date(scheduledTime);
  const hour = date.getUTCHours();
  
  // JST時間に変換（UTC+9）
  const jstHour = (hour + 9) % 24;
  
  if (jstHour >= 5 && jstHour < 11) {
    return '朝';
  } else if (jstHour >= 11 && jstHour < 15) {
    return '昼';
  } else if (jstHour >= 15 && jstHour < 19) {
    return '夕方';
  } else {
    return '夜';
  }
}

function buildPrompt(persona: any, customPrompt?: string, contentPrefs?: string, scheduledTime?: string) {
  const personaInfo = [
    `ペルソナ名: ${persona?.name || '未設定'}`,
    persona?.tone_of_voice ? `口調: ${persona.tone_of_voice}` : undefined,
    persona?.expertise?.length ? `専門領域: ${persona.expertise.join(', ')}` : undefined,
    persona?.personality ? `性格: ${persona.personality}` : undefined,
  ].filter(Boolean).join('\n');

  const timeOfDay = getTimeOfDay(scheduledTime);
  const timeContext = timeOfDay ? `この投稿は「${timeOfDay}」に投稿されます。投稿内容は投稿時間帯に適した内容にしてください。` : '';

  return `あなたは指定されたペルソナになりきってThreads用の短文投稿を1件だけ出力します。\n` +
         `出力はテキスト本文のみ。絵文字やハッシュタグの使用は内容に応じて自然に。\n` +
         `--- ペルソナ情報 ---\n${personaInfo}\n` +
         (timeContext ? `--- 投稿時間帯 ---\n${timeContext}\n` : '') +
         (contentPrefs ? `--- 投稿方針 ---\n${contentPrefs}\n` : '') +
         (customPrompt ? `--- カスタムプロンプト ---\n${customPrompt}\n` : '') +
         `--- 出力ルール ---\n- 280文字程度以内\n- 攻撃的・不適切表現は禁止\n- 改行2回以内\n- 出力はテキスト本文のみ`;
}

function buildRandomPrompt(persona: any, scheduledTime?: string) {
  const personaInfo = [
    `ペルソナ名: ${persona?.name || '未設定'}`,
    persona?.tone_of_voice ? `口調: ${persona.tone_of_voice}` : undefined,
    persona?.expertise?.length ? `専門領域: ${persona.expertise.join(', ')}` : undefined,
    persona?.personality ? `性格: ${persona.personality}` : undefined,
  ].filter(Boolean).join('\n');

  const randomTopics = [
    '今日の体験や気づき',
    '専門分野についての洞察',
    '日常の小さな発見',
    'おすすめの方法やコツ',
    '最近感じたこと',
    '役立つ情報の共有',
    'トレンドについての意見',
    '個人的な価値観'
  ];

  const selectedTopic = randomTopics[Math.floor(Math.random() * randomTopics.length)];
  
  const timeOfDay = getTimeOfDay(scheduledTime);
  const timeContext = timeOfDay ? `この投稿は「${timeOfDay}」に投稿されます。投稿内容は投稿時間帯に適した内容にしてください。` : '';

  return `あなたは指定されたペルソナになりきってThreads用の短文投稿を1件だけ出力します。\n` +
         `今回のテーマ: ${selectedTopic}\n` +
         `出力はテキスト本文のみ。絵文字やハッシュタグの使用は内容に応じて自然に。\n` +
         `--- ペルソナ情報 ---\n${personaInfo}\n` +
         (timeContext ? `--- 投稿時間帯 ---\n${timeContext}\n` : '') +
         `--- 投稿方針 ---\n` +
         `- このペルソナらしい自然な投稿内容にする\n` +
         `- テーマに沿いつつも、個性を活かした内容にする\n` +
         `- フォロワーに価値を提供する内容を心がける\n` +
         `--- 出力ルール ---\n- 280文字程度以内\n- 攻撃的・不適切表現は禁止\n- 改行2回以内\n- 出力はテキスト本文のみ`;
}

function calculateRandomNextRun(randomTimes: string[], timezone: string = 'Asia/Tokyo'): string {
  if (!randomTimes || randomTimes.length === 0) {
    // デフォルト時間（9時、12時、18時）から選択
    const defaultTimes = ['09:00:00', '12:00:00', '18:00:00'];
    randomTimes = defaultTimes;
  }

  const nowUTC = new Date();
  
  // 現在のタイムゾーンでの日付と時刻を取得
  const jstDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(nowUTC);
  
  const jstTimeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(nowUTC);
  
  // ランダムに時刻を選択
  const randomTime = randomTimes[Math.floor(Math.random() * randomTimes.length)];
  const timeStr = randomTime.length === 8 ? randomTime : `${randomTime}:00`;
  
  // 今日の指定時刻がまだ来ていないかチェック
  if (timeStr > jstTimeStr) {
    // 今日の指定時刻（JST）をUTCに変換
    const jstDateTime = new Date(`${jstDateStr}T${timeStr}+09:00`);
    console.log(`✅ Next run scheduled for today: ${jstDateTime.toISOString()} (JST: ${jstDateStr} ${timeStr})`);
    return jstDateTime.toISOString();
  }
  
  // 今日の時刻が過ぎている場合は、翌日の指定時刻を設定
  const tomorrow = new Date(nowUTC.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowJstDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(tomorrow);
  
  // 翌日の指定時刻（JST）をUTCに変換
  const tomorrowJstDateTime = new Date(`${tomorrowJstDateStr}T${timeStr}+09:00`);
  console.log(`✅ Next run scheduled for tomorrow: ${tomorrowJstDateTime.toISOString()} (JST: ${tomorrowJstDateStr} ${timeStr})`);
  return tomorrowJstDateTime.toISOString();
}

// タイムゾーンオフセットを取得する関数
function getTimezoneOffset(timezone: string): number {
  const now = new Date();
  const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
  const targetTime = new Date(utc.toLocaleString("en-US", {timeZone: timezone}));
  return (utc.getTime() - targetTime.getTime()) / (1000 * 60);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🛡️ SAFETY CHECK: Checking system posting pause status...');
    
    // 🚨 CRITICAL: Check system pause first
    const pauseStatus = await checkSystemPause();
    if (pauseStatus.paused) {
      console.log('🛑 SYSTEM PAUSED: Auto-posting is currently disabled');
      console.log('Pause reason:', pauseStatus.reason);
      
      return new Response(
        JSON.stringify({ 
          message: 'System paused - auto-posting disabled',
          reason: pauseStatus.reason,
          processed: 0, 
          posted: 0, 
          failed: 0,
          paused: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('✅ System posting allowed, proceeding with auto-post generation');

    const now = new Date();
    const nowIso = now.toISOString();
    const workerId = crypto.randomUUID();

    const releasedClaims = await releaseExpiredAutoPostClaims(nowIso);
    if (releasedClaims > 0) {
      console.warn(`🔓 Released ${releasedClaims} expired auto-post claims before processing`);
    }

    // 1. ランダムポスト設定がアクティブなペルソナIDを取得
    const { data: randomActivePersonas, error: randomPersonaError } = await supabase
      .from('random_post_configs')
      .select('persona_id')
      .eq('is_active', true);

    if (randomPersonaError) throw randomPersonaError;

    const excludePersonaIds = (randomActivePersonas || []).map(r => r.persona_id);
    console.log('🚫 Personas with active random post configs (will skip auto-post):', excludePersonaIds);

    // 2. 通常のオートポスト設定を取得（ランダムポスト設定がアクティブなペルソナは除外）
    let configsQuery = supabase
      .from('auto_post_configs')
      .select('*')
      .eq('is_active', true)  // 🔒 アクティブな設定のみ対象
      .lte('next_run_at', nowIso)
      .limit(RATE_LIMITS.MAX_TOTAL_POSTS_PER_RUN); // 🚨 CRITICAL: Global limit

    // ランダムポスト設定がアクティブなペルソナは除外
    if (excludePersonaIds.length > 0) {
      configsQuery = configsQuery.not('persona_id', 'in', `(${excludePersonaIds.join(',')})`);
      console.log(`⚠️ Excluding ${excludePersonaIds.length} personas from auto-post due to active random posting`);
    }

    const { data: configs, error: cfgError } = await configsQuery;

    if (cfgError) throw cfgError;

    console.log(`📋 Found ${configs?.length || 0} auto-post configs to process (after random post exclusion, global limit: ${RATE_LIMITS.MAX_TOTAL_POSTS_PER_RUN})`);
    
    // ランダムポスト有効ペルソナの除外確認ログ
    if (configs && excludePersonaIds.length > 0) {
      const conflictingConfigs = configs.filter(cfg => excludePersonaIds.includes(cfg.persona_id));
      if (conflictingConfigs.length > 0) {
        console.error('⚠️ CONFLICT: Found auto-post configs for personas with active random posting:', 
          conflictingConfigs.map(c => c.persona_id));
      }
    }

    // 3. ランダムポスト設定を取得（制限付き）
    const { data: randomConfigs, error: randomCfgError } = await supabase
      .from('random_post_configs')
      .select(`
        *,
        personas!fk_random_post_configs_persona_id(id, user_id, name, tone_of_voice, expertise, personality)
      `)
      .eq('is_active', true)
      .limit(RATE_LIMITS.MAX_TOTAL_POSTS_PER_RUN); // 🚨 CRITICAL: Limit random posts too

    if (randomCfgError) throw randomCfgError;

    let processed = 0, posted = 0, failed = 0;

    // 4. 通常のオートポスト処理（厳格な制限付き）
    for (const cfg of configs || []) {
      let claimToken: string | null = null;

      try {
        claimToken = await claimAutoPostConfig(cfg.id, cfg.next_run_at, workerId);
        if (!claimToken) {
          console.log(`⏭️ Config ${cfg.id} is already claimed or processed by another worker, skipping`);
          continue;
        }

        processed++;

        // 🚨 CRITICAL: Rate limiting check
        const rateLimitOk = await checkPersonaRateLimit(cfg.persona_id);
        if (!rateLimitOk) {
          console.log(`🛑 Rate limit exceeded for persona ${cfg.persona_id}, skipping`);

          await finalizeAutoPostClaim(cfg.id, claimToken, {
            next_run_at: new Date(Date.now() + RATE_LIMITS.COOLDOWN_AFTER_FAILURE).toISOString()
          });
          continue;
        }

        // ペルソナ情報取得
        const { data: persona, error: personaError } = await supabase
          .from('personas')
          .select('id, user_id, name, tone_of_voice, expertise, personality')
          .eq('id', cfg.persona_id)
          .eq('is_active', true) // 🚨 CRITICAL: Only process active personas
          .single();
          
        if (personaError || !persona) {
          console.log(`❌ Persona ${cfg.persona_id} not found or inactive, skipping config ${cfg.id}`);
          await finalizeAutoPostClaim(cfg.id, claimToken, {
            next_run_at: new Date(Date.now() + RATE_LIMITS.COOLDOWN_AFTER_FAILURE).toISOString()
          });
          continue;
        }

        const movedToProcessing = await moveClaimToProcessing(cfg.id, claimToken);
        if (!movedToProcessing) {
          console.log(`⏭️ Claim for config ${cfg.id} was lost before processing step, skipping`);
          continue;
        }

        // APIキー解決とコンテンツ生成（制限付きローテーション）
        const prompt = buildPrompt(persona, cfg.prompt_template, cfg.content_prefs, cfg.next_run_at);
        const content = await generateWithGeminiRotation(prompt, cfg.user_id);

        console.log(`📝 Creating scheduled post for persona ${persona.name} at ${cfg.next_run_at}`);
        
        // 【重要】スケジュール時刻と状態を確実に設定
        const scheduledTime = cfg.next_run_at;
        if (!scheduledTime) {
          throw new Error(`No scheduled time available for persona ${persona.name}`);
        }
        
        console.log(`📊 About to create post with scheduled_for: ${scheduledTime}`);
        
        // postsへ作成（予約投稿）- トランザクションで確実に作成
        const { data: inserted, error: postErr } = await supabase
          .from('posts')
          .insert({
            user_id: cfg.user_id,
            persona_id: cfg.persona_id,
            content,
            status: 'scheduled',
            scheduled_for: scheduledTime,
            auto_schedule: true,
            platform: 'threads'
          })
          .select('id, status, scheduled_for, auto_schedule')
          .single();
          
        if (postErr) {
          console.error(`❌ Failed to create scheduled post for persona ${persona.name}:`, postErr);
          throw new Error(`Database error creating post: ${postErr.message}`);
        }
        
        if (!inserted) {
          throw new Error(`No data returned from post insertion for persona ${persona.name}`);
        }
        
        console.log(`✅ Post created with ID ${inserted.id}:`, {
          status: inserted.status,
          scheduled_for: inserted.scheduled_for,
          auto_schedule: inserted.auto_schedule
        });
        
        // 【重要】作成後の検証 - 問題があれば即座にエラー
        if (inserted.status !== 'scheduled') {
          const errorMsg = `CRITICAL: Post ${inserted.id} created with wrong status: ${inserted.status} (expected: scheduled)`;
          console.error(`🚨 ${errorMsg}`);
          
          // 🚨 CRITICAL: 壊れた投稿を即座に削除
          await supabase.from('posts').delete().eq('id', inserted.id);
          console.log(`🗑️ Deleted broken post ${inserted.id}`);
          
          throw new Error(errorMsg);
        }
        if (!inserted.scheduled_for) {
          const errorMsg = `CRITICAL: Post ${inserted.id} created without scheduled_for date`;
          console.error(`🚨 ${errorMsg}`);
          
          // 🚨 CRITICAL: 壊れた投稿を即座に削除
          await supabase.from('posts').delete().eq('id', inserted.id);
          console.log(`🗑️ Deleted broken post ${inserted.id}`);
          
          throw new Error(errorMsg);
        }

        // post_queueに投入（オートスケジューラが処理）
        const { error: queueErr } = await supabase
          .from('post_queue')
          .insert({
            user_id: cfg.user_id,
            post_id: inserted.id,
            scheduled_for: cfg.next_run_at,
            queue_position: 0,
            status: 'queued'
          });
        if (queueErr) {
          console.error(`❌ Failed to enqueue post ${inserted.id}, deleting post for rollback`);
          await supabase.from('posts').delete().eq('id', inserted.id);
          throw queueErr;
        }

        // 次回実行時刻を計算（複数時間対応）
        let nextRunAt: string;
        
        if (cfg.multi_time_enabled && cfg.post_times && cfg.post_times.length > 0) {
          // 複数時間設定の場合：次の時間スロットを計算
          const { data: nextTime, error: calcErr } = await supabase
            .rpc('calculate_next_multi_time_run', {
              p_current_time: now.toISOString(), // 現在時刻を使用
              time_slots: cfg.post_times,
              timezone_name: cfg.timezone || 'Asia/Tokyo'
            });
          
          if (calcErr) {
            console.error('Failed to calculate next multi-time run:', calcErr);
            // フォールバック: 翌日の最初の時間スロットを使用
            const firstTime = cfg.post_times[0];
            const nextDay = new Date(now);
            nextDay.setDate(nextDay.getDate() + 1);
            const [hours, minutes] = firstTime.split(':').map(Number);
            
            // タイムゾーンを考慮して翌日の最初の時間を設定
            if (cfg.timezone === 'Asia/Tokyo') {
              // JST（UTC+9）の場合の正しい計算
              if (cfg.timezone === 'Asia/Tokyo') {
                // JST での翌日の日付文字列を取得
                const formatter = new Intl.DateTimeFormat('en-CA', {
                  timeZone: 'Asia/Tokyo',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit'
                });
                const tomorrowJST = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                const localDateStr = formatter.format(tomorrowJST);
                const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
                
                // JSTの日時文字列を作成してUTCに変換
                const jstDateTime = new Date(`${localDateStr}T${timeStr}+09:00`);
                nextRunAt = jstDateTime.toISOString();
              } else {
                // その他のタイムゾーンの場合はgetTimezoneOffsetを使用
                const formatter = new Intl.DateTimeFormat('en-CA', {
                  timeZone: cfg.timezone,
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit'
                });
                const tomorrowLocal = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                const localDateStr = formatter.format(tomorrowLocal);
                const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
                
                const localDateTime = new Date(`${localDateStr}T${timeStr}`);
                const utcOffset = getTimezoneOffset(cfg.timezone);
                const utcTime = new Date(localDateTime.getTime() - utcOffset * 60 * 1000);
                nextRunAt = utcTime.toISOString();
              }
            } else {
              nextDay.setHours(hours, minutes, 0, 0);
              nextRunAt = nextDay.toISOString();
            }
          } else {
            nextRunAt = nextTime;
          }
          
          console.log(`📅 Multi-time persona ${cfg.persona_id}: Next run calculated as ${nextRunAt}`);
        } else {
          // 従来の単一時間設定：タイムゾーン考慮した次の日の同時刻
          const { data: nextTimeCalculated, error: calcErr } = await supabase
            .rpc('calculate_timezone_aware_next_run', {
              current_schedule_time: cfg.next_run_at,
              timezone_name: cfg.timezone || 'Asia/Tokyo'
            });
            
          if (calcErr) {
            console.error('Failed to calculate timezone-aware next run:', calcErr);
            const next = new Date(cfg.next_run_at);
            next.setDate(next.getDate() + 1);
            nextRunAt = next.toISOString();
          } else {
            nextRunAt = nextTimeCalculated;
          }
        }

        await finalizeAutoPostClaim(cfg.id, claimToken, {
          next_run_at: nextRunAt
        });

        console.log(`✅ Config ${cfg.id} finalized with next_run_at: ${nextRunAt}`);

        claimToken = null;

        posted++;
      } catch (e) {
        console.error('❌ Auto post generation failed for config', cfg.id, ':', e);
        failed++;
        if (claimToken) {
          try {
            const cooldownNextRun = new Date(Date.now() + RATE_LIMITS.COOLDOWN_AFTER_FAILURE).toISOString();
            await finalizeAutoPostClaim(cfg.id, claimToken, {
              next_run_at: cooldownNextRun
            });
            console.log(`⏭️ Config ${cfg.id} failure cooldown applied: ${cooldownNextRun}`);
          } catch (updateCatchErr) {
            console.error('Unexpected error updating next_run_at after failure:', updateCatchErr);
          }
        }
      }
    }

    // 5. ランダムポスト処理（厳格な制限付き）
    console.log(`🔍 DEBUG: Starting random post processing loop. Found ${randomConfigs?.length || 0} configs`);
    
    for (const randomCfg of randomConfigs || []) {
      try {
        console.log(`🔍 DEBUG: Processing random config ${randomCfg.id} for persona ${randomCfg.persona_id}`);
        
        const persona = randomCfg.personas;
        if (!persona) {
          console.log(`⚠️ DEBUG: No persona found for config ${randomCfg.id}, skipping`);
          continue;
        }
        
        console.log(`🔍 DEBUG: Persona found: ${persona.name} (${persona.id})`);

        // 🚨 CRITICAL: Rate limiting check for random posts too
        const rateLimitOk = await checkPersonaRateLimit(persona.id);
        if (!rateLimitOk) {
          console.log(`🛑 Rate limit exceeded for random post persona ${persona.id}, skipping`);
          processed++;
          continue;
        }
        
        console.log(`✅ DEBUG: Rate limit OK for ${persona.name}`);

        // 今日の日付を取得（設定のタイムゾーンで）
        const today = new Date().toLocaleDateString('en-CA', { 
          timeZone: randomCfg.timezone || 'Asia/Tokyo'
        });
        
        console.log(`📅 DEBUG: Today date: ${today}, last_posted_date: ${randomCfg.last_posted_date}`);
        
        // 日付が変わったかチェックし、必要に応じてposted_times_todayをリセット
        let postedTimesToday = randomCfg.posted_times_today || [];
        if (randomCfg.last_posted_date !== today) {
          console.log(`🔄 DEBUG: Date changed, resetting posted_times_today`);
          postedTimesToday = [];
          // データベースも更新
          await supabase
            .from('random_post_configs')
            .update({ 
              last_posted_date: today,
              posted_times_today: []
            })
            .eq('id', randomCfg.id);
        }
        
        console.log(`📋 DEBUG: posted_times_today: ${JSON.stringify(postedTimesToday)}`);
        console.log(`⏰ DEBUG: random_times: ${JSON.stringify(randomCfg.random_times)}`);
        console.log(`🌐 DEBUG: timezone: ${randomCfg.timezone}`);
        console.log(`⏰ DEBUG: next_run_at: ${randomCfg.next_run_at}`);

        // 設定された各時間をチェック（制限付き）
        const randomTimes = randomCfg.random_times || ['09:00:00', '12:00:00', '18:00:00'];
        let hasPosted = false;
        let slotsProcessed = 0;

        // 🚨 CRITICAL FIX: タイムゾーンでの現在時刻を取得（HH:mm:ss形式）
        const nowInTz = new Date().toLocaleTimeString('en-US', {
          timeZone: randomCfg.timezone || 'Asia/Tokyo',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }); // 例: "22:59:00" (JST)
        console.log(`🕐 DEBUG: Current time in ${randomCfg.timezone}: ${nowInTz}`);

        for (const timeStr of randomTimes) {
          // 🚨 CRITICAL: Limit slots processed per run
          if (slotsProcessed >= 1) {
            console.log(`⚠️ Limiting random post processing to 1 slot per run for safety`);
            break;
          }
          
          // 既に投稿済みの時間はスキップ
          if (postedTimesToday.includes(timeStr)) {
            console.log(`⏭️ DEBUG: Slot ${timeStr} already posted today, skipping`);
            continue;
          }

          console.log(`🔍 DEBUG: Checking slot ${timeStr} vs current ${nowInTz}`);

          // 🚨 CRITICAL FIX: タイムゾーン内での時刻比較（文字列比較で十分）
          if (nowInTz < timeStr) {
            console.log(`⏰ DEBUG: Slot ${timeStr} not yet reached (current: ${nowInTz}), skipping`);
            continue; // まだ時刻前
          }

          // 60分ウィンドウのチェック（タイムゾーン内での分単位計算）
          const [nowH, nowM] = nowInTz.split(':').map(Number);
          const [targetH, targetM] = timeStr.split(':').map(Number);
          const nowMinutes = nowH * 60 + nowM;
          const targetMinutes = targetH * 60 + targetM;
          const diffMinutes = nowMinutes - targetMinutes;
          
          console.log(`⏱️ DEBUG: Time difference for ${timeStr}: ${diffMinutes} minutes`);

          if (diffMinutes > 60) {
            // 🚨 CRITICAL FIX: スキップ時もslotsProcessedをインクリメント（データベース更新トリガー）
            slotsProcessed++;
            console.log(`⏭️ Skipping heavily outdated random slot ${timeStr} (diff ${diffMinutes} minutes), marking as posted to prevent retry`);
            postedTimesToday.push(timeStr); // 🚨 CRITICAL: スキップ時も記録して無限ループ防止
            break; // 🚨 CRITICAL: breakして即座にデータベース更新に進む
          }

          console.log(`✅ DEBUG: Processing random post for ${persona.name} at ${timeStr}`);
          slotsProcessed++;

          // 🚨 CRITICAL FIX v2: scheduled_forを即座に実行時刻に設定（タイムゾーン問題を完全回避）
          // ランダムポストは「今すぐ投稿」として処理し、auto-schedulerが即座に処理する
          const targetTime = new Date(); // 現在時刻（UTC）
          console.log(`📅 IMMEDIATE EXECUTION: ${targetTime.toISOString()} for slot ${timeStr} (persona: ${persona.name})`);


          // ランダムポスト用のプロンプト生成（独自ロジック）
          const prompt = buildRandomPrompt(persona, targetTime.toISOString());
          const content = await generateWithGeminiRotation(prompt, persona.user_id);

          // postsへ作成（予約投稿）
          const { data: inserted, error: postErr } = await supabase
            .from('posts')
            .insert({
              user_id: persona.user_id,
              persona_id: persona.id,
              content,
              status: 'scheduled',
              scheduled_for: targetTime.toISOString(),
              auto_schedule: true,
              platform: 'threads'
            })
            .select('id')
            .single();
          if (postErr) throw postErr;

          // post_queueに投入（オートスケジューラが処理）
          const { error: queueErr } = await supabase
            .from('post_queue')
            .insert({
              user_id: persona.user_id,
              post_id: inserted.id,
              scheduled_for: targetTime.toISOString(),
              queue_position: 0,
              status: 'queued'
            });
          if (queueErr) throw queueErr;

          // この時間を投稿済みとしてマーク
          postedTimesToday.push(timeStr);
          hasPosted = true;
          posted++;

          console.log(`Successfully processed random post for ${persona.name} at ${timeStr}`);
          break; // 1回の実行で1ポストのみ（大量生成防止）
        }

        // 🚨 CRITICAL: 投稿有無に関わらずposted_times_todayが更新された場合は記録
        if (hasPosted || postedTimesToday.length > (randomCfg.posted_times_today || []).length) {
          // 🚨 CRITICAL: Double-check config is still active before updating
          const { data: stillActive, error: activeErr } = await supabase
            .from('random_post_configs')
            .select('is_active')
            .eq('id', randomCfg.id)
            .single();
            
          if (!activeErr && stillActive?.is_active) {
            // 次回実行時刻を計算
            const allSlotsPosted = randomTimes.every(time => postedTimesToday.includes(time));
            const updateData: any = { 
              posted_times_today: postedTimesToday,
              last_posted_date: today,
              updated_at: new Date().toISOString()
            };
            
            // 🚨 CRITICAL: 全スロット処理済み、またはスキップ含めて処理済みの場合は必ず次回実行時刻を更新
            if (allSlotsPosted || postedTimesToday.length >= randomTimes.length) {
              const nextRunAt = calculateRandomNextRun(randomTimes, randomCfg.timezone || 'Asia/Tokyo');
              updateData.next_run_at = nextRunAt;
              console.log(`📅 All slots processed for persona ${persona.name}, next run: ${nextRunAt}`);
            } else {
              // 🚨 CRITICAL: 部分的に処理した場合も、次の未処理スロットを計算
              const remainingSlots = randomTimes.filter(time => !postedTimesToday.includes(time));
              if (remainingSlots.length > 0) {
                // 次の未処理スロットの時刻を計算
                const nextSlot = remainingSlots[0];
                const nowUTC = new Date();
                
                // 現在のJST日付を取得
                const jstDateStr = new Intl.DateTimeFormat('en-CA', {
                  timeZone: randomCfg.timezone || 'Asia/Tokyo',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit'
                }).format(nowUTC);
                
                // 次のスロット時刻（フォーマット確認）
                const timeStr = nextSlot.length === 8 ? nextSlot : `${nextSlot}:00`;
                
                // JSTの日時をISO 8601形式でUTCに変換
                const jstDateTime = new Date(`${jstDateStr}T${timeStr}+09:00`);
                
                updateData.next_run_at = jstDateTime.toISOString();
                console.log(`📅 Next slot for persona ${persona.name}: ${nextSlot} JST -> UTC: ${updateData.next_run_at}`);
              }
            }
            
            await supabase
              .from('random_post_configs')
              .update(updateData)
              .eq('id', randomCfg.id)
              .eq('is_active', true); // 🚨 Only update if still active
              
            console.log(`✅ Updated random config ${randomCfg.id}`, updateData);
          } else {
            console.log(`⚠️ Random config ${randomCfg.id} was deactivated, skipping state update`);
          }
        }

        if (hasPosted) processed++;
      } catch (e) {
        console.error('❌ Random post generation failed for config', randomCfg.id, ':', e);
        failed++;
        processed++;
        
        // 🚨 CRITICAL: Safe cooldown only if still active
        console.log(`⚠️ Applying cooldown for failed random config ${randomCfg.id}`);
        try {
          const { data: stillActive, error: activeErr } = await supabase
            .from('random_post_configs')
            .select('is_active')
            .eq('id', randomCfg.id)
            .single();
            
          if (!activeErr && stillActive?.is_active) {
            // Long cooldown to prevent rapid failures
            const nextRun = new Date(Date.now() + RATE_LIMITS.COOLDOWN_AFTER_FAILURE);
            await supabase
              .from('random_post_configs')
              .update({ 
                next_run_at: nextRun.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', randomCfg.id)
              .eq('is_active', true);
            console.log(`✅ Applied ${RATE_LIMITS.COOLDOWN_AFTER_FAILURE/1000/60}min cooldown to random config ${randomCfg.id}`);
          } else {
            console.log(`ℹ️ Random config ${randomCfg.id} was deactivated, no cooldown needed`);
          }
        } catch (updateError) {
          console.error(`Failed to apply cooldown to random config ${randomCfg.id}:`, updateError);
        }
      }
    }

    // 6. テンプレート文章ランダムポスト処理（新機能 - 既存機能と共存可能）
    let templatePosted = 0;
    let templateFailed = 0;
    
    console.log('📝 Starting template post boxes processing...');
    
    const { data: templateConfigs, error: templateFetchError } = await supabase
      .from('template_post_boxes')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', now.toISOString())
      .order('next_run_at', { ascending: true });
    
    if (templateFetchError) {
      console.error('Error fetching template random post configs:', templateFetchError);
    }
    
    console.log(`📝 Found ${templateConfigs?.length || 0} template random post configs`);
    
    for (const templateCfg of templateConfigs || []) {
      try {
        console.log(`🔍 DEBUG: Processing template config ${templateCfg.id} for persona ${templateCfg.persona_id}`);
        
        // Fetch persona separately
        const { data: persona, error: personaError } = await supabase
          .from('personas')
          .select('id, name, user_id, is_active, personality, tone_of_voice, expertise, threads_access_token, threads_user_id')
          .eq('id', templateCfg.persona_id)
          .eq('is_active', true)
          .single();
        
        if (personaError || !persona) {
          console.log(`❌ Persona ${templateCfg.persona_id} not found or inactive for template config ${templateCfg.id}`);
          continue;
        }
        
        console.log(`🔍 DEBUG: Persona found: ${persona.name} (${persona.id})`);
        console.log(`📝 Processing template config ${templateCfg.id} for persona ${persona.name}`);
        
        // Rate limit check
        const rateLimitOk = await checkPersonaRateLimit(persona.id);
        if (!rateLimitOk) {
          console.log(`🛑 Rate limit exceeded for template persona ${persona.id}, skipping`);
          continue;
        }
        
        // Timezone-aware processing
        const tz = templateCfg.timezone || 'Asia/Tokyo';
        const nowInTz = new Date().toLocaleString('en-US', { timeZone: tz });
        const localNow = new Date(nowInTz);
        const currentTime = localNow.toTimeString().split(' ')[0].slice(0, 8); // HH:MM:SS
        const todayDate = localNow.toISOString().split('T')[0]; // YYYY-MM-DD
        
        console.log(`🕐 DEBUG: Current time in ${tz}: ${currentTime}`);
        console.log(`📅 DEBUG: Today date: ${todayDate}, last_posted_date: ${templateCfg.last_posted_date}`);
        
        // Reset posted_times_today if it's a new day
        let postedTimesToday = templateCfg.posted_times_today || [];
        if (typeof postedTimesToday === 'string') {
          postedTimesToday = JSON.parse(postedTimesToday);
        }
        
        if (templateCfg.last_posted_date !== todayDate) {
          postedTimesToday = [];
          console.log(`🗓️ New day detected, resetting posted_times_today`);
        }
        
        console.log(`📋 DEBUG: posted_times_today:`, postedTimesToday);
        console.log(`⏰ DEBUG: random_times:`, templateCfg.random_times);
        
        // Find next available time slot
        let shouldPost = false;
        let selectedTime: string | null = null;
        
        for (const slot of templateCfg.random_times || []) {
          console.log(`🔍 DEBUG: Checking slot ${slot} vs current ${currentTime}`);
          
          if (postedTimesToday.includes(slot)) {
            console.log(`⏭️ DEBUG: Slot ${slot} already posted today, skipping`);
            continue;
          }
          
          if (slot <= currentTime) {
            shouldPost = true;
            selectedTime = slot;
            console.log(`✅ DEBUG: Slot ${slot} is ready for posting`);
            break;
          } else {
            console.log(`⏰ DEBUG: Slot ${slot} not yet reached (current: ${currentTime}), skipping`);
          }
        }
        
        if (!shouldPost || !selectedTime) {
          console.log(`⏭️ No available time slot for template config ${templateCfg.id}`);
          continue;
        }
        
        // Select random template
        const templates = Array.isArray(templateCfg.templates) ? templateCfg.templates : [];
        if (templates.length === 0) {
          console.log(`❌ No templates configured for config ${templateCfg.id}`);
          continue;
        }
        
        const randomTemplateObj = templates[Math.floor(Math.random() * templates.length)];
        const templateContent = typeof randomTemplateObj === 'string' 
          ? randomTemplateObj 
          : (randomTemplateObj as any).text || '';
        const templateImages = typeof randomTemplateObj === 'object' && randomTemplateObj !== null
          ? (randomTemplateObj as any).image_urls || []
          : [];
        
        console.log(`📝 Selected template: "${templateContent.substring(0, 50)}..."`);
        if (templateImages && templateImages.length > 0) {
          console.log(`🖼️ Template has ${templateImages.length} image(s)`);
        }
        
        // Create post with selected template
        const postData: any = {
          user_id: templateCfg.user_id,
          persona_id: templateCfg.persona_id,
          content: templateContent,
          status: 'scheduled',
          scheduled_for: new Date().toISOString(), // Post immediately
          auto_schedule: true,
          platform: 'threads',
          app_identifier: 'threads-manager-app'
        };
        
        // Add images if available
        if (templateImages && templateImages.length > 0) {
          postData.images = templateImages;
        }
        
        console.log(`📅 Creating template post for persona ${persona.name}...`);
        
        const { data: newPost, error: postError } = await supabase
          .from('posts')
          .insert(postData)
          .select()
          .single();
        
        if (postError || !newPost) {
          console.error(`❌ Failed to create template post:`, postError);
          templateFailed++;
          continue;
        }
        
        console.log(`✅ Template post created: ${newPost.id}`);
        
        // Add to queue for immediate posting
        const { error: queueError } = await supabase
          .from('post_queue')
          .insert({
            user_id: templateCfg.user_id,
            post_id: newPost.id,
            scheduled_for: new Date().toISOString(),
            status: 'queued',
            queue_position: 0
          });
        
        if (queueError) {
          console.error(`❌ Failed to add template post to queue:`, queueError);
        } else {
          console.log(`✅ Template post added to queue`);
        }
        
        // Update posted_times_today
        const updatedPostedTimes = [...postedTimesToday, selectedTime];
        
        // Calculate next run time with proper timezone handling
        const nextSlots = (templateCfg.random_times || []).filter(
          (s: string) => !updatedPostedTimes.includes(s)
        );
        
        let nextRunAt: string;
        if (nextSlots.length > 0) {
          // Find next slot today
          const nextSlot = nextSlots.find((s: string) => s > currentTime);
          if (nextSlot) {
            // JST（Asia/Tokyo）の場合は正しくUTCに変換
            if (tz === 'Asia/Tokyo') {
              const jstDateTime = new Date(`${todayDate}T${nextSlot}+09:00`);
              nextRunAt = jstDateTime.toISOString();
            } else {
              // その他のタイムゾーン用の処理
              const nextRunDate = new Date(todayDate + 'T' + nextSlot);
              const utcOffset = getTimezoneOffset(tz);
              const utcTime = new Date(nextRunDate.getTime() - utcOffset * 60 * 1000);
              nextRunAt = utcTime.toISOString();
            }
            
            console.log(`📅 Next slot: ${nextSlot} in ${tz} = ${nextRunAt} UTC`);
          } else {
            // No more slots today, schedule for tomorrow's first slot
            const tomorrow = new Date(localNow);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            
            if (tz === 'Asia/Tokyo') {
              const jstDateTime = new Date(`${tomorrowStr}T${templateCfg.random_times[0]}+09:00`);
              nextRunAt = jstDateTime.toISOString();
            } else {
              const tomorrowSlot = new Date(tomorrowStr + 'T' + templateCfg.random_times[0]);
              const utcOffset = getTimezoneOffset(tz);
              const utcTime = new Date(tomorrowSlot.getTime() - utcOffset * 60 * 1000);
              nextRunAt = utcTime.toISOString();
            }
            
            console.log(`📅 All today's slots done, next: tomorrow ${templateCfg.random_times[0]} = ${nextRunAt} UTC`);
          }
        } else {
          // All slots posted today, schedule for tomorrow's first slot
          const tomorrow = new Date(localNow);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split('T')[0];
          
          if (tz === 'Asia/Tokyo') {
            const jstDateTime = new Date(`${tomorrowStr}T${templateCfg.random_times[0]}+09:00`);
            nextRunAt = jstDateTime.toISOString();
          } else {
            const tomorrowSlot = new Date(tomorrowStr + 'T' + templateCfg.random_times[0]);
            const utcOffset = getTimezoneOffset(tz);
            const utcTime = new Date(tomorrowSlot.getTime() - utcOffset * 60 * 1000);
            nextRunAt = utcTime.toISOString();
          }
          
          console.log(`📅 All slots posted, next: tomorrow ${templateCfg.random_times[0]} = ${nextRunAt} UTC`);
        }
        
        // Update config
        const { error: updateError } = await supabase
          .from('template_post_boxes')
          .update({
            posted_times_today: updatedPostedTimes,
            last_posted_date: todayDate,
            next_run_at: nextRunAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', templateCfg.id)
          .eq('is_active', true);
        
        if (updateError) {
          console.error(`❌ Failed to update template config:`, updateError);
        } else {
          console.log(`✅ Template config updated, next_run_at: ${nextRunAt}`);
          templatePosted++;
        }
        
      } catch (e) {
        console.error(`❌ Template random post error for config ${templateCfg.id}:`, e);
        templateFailed++;
        
        // Apply cooldown on failure
        try {
          const { data: stillActive } = await supabase
            .from('template_post_boxes')
            .select('is_active')
            .eq('id', templateCfg.id)
            .single();
          
          if (stillActive?.is_active) {
            const nextRun = new Date(Date.now() + RATE_LIMITS.COOLDOWN_AFTER_FAILURE);
            await supabase
              .from('template_post_boxes')
              .update({
                next_run_at: nextRun.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', templateCfg.id)
              .eq('is_active', true);
            console.log(`✅ Applied cooldown to template config ${templateCfg.id}`);
          }
        } catch (cooldownError) {
          console.error(`Failed to apply cooldown:`, cooldownError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'auto-post-generator completed with enhanced safety controls', 
        processed, 
        posted, 
        failed,
        regular_configs: configs?.length || 0,
        random_configs: randomConfigs?.length || 0,
        template_configs: templateConfigs?.length || 0,
        template_posted: templatePosted,
        template_failed: templateFailed,
        rate_limits_applied: true,
        max_posts_per_run: RATE_LIMITS.MAX_TOTAL_POSTS_PER_RUN
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('auto-post-generator error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
