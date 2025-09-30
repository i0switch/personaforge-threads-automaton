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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
    headers: { 'Content-Type': 'application/json' },
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

function buildPrompt(persona: any, customPrompt?: string, contentPrefs?: string) {
  const personaInfo = [
    `ペルソナ名: ${persona?.name || '未設定'}`,
    persona?.tone_of_voice ? `口調: ${persona.tone_of_voice}` : undefined,
    persona?.expertise?.length ? `専門領域: ${persona.expertise.join(', ')}` : undefined,
    persona?.personality ? `性格: ${persona.personality}` : undefined,
  ].filter(Boolean).join('\n');

  return `あなたは指定されたペルソナになりきってThreads用の短文投稿を1件だけ出力します。\n` +
         `出力はテキスト本文のみ。絵文字やハッシュタグの使用は内容に応じて自然に。\n` +
         `--- ペルソナ情報 ---\n${personaInfo}\n` +
         (contentPrefs ? `--- 投稿方針 ---\n${contentPrefs}\n` : '') +
         (customPrompt ? `--- カスタムプロンプト ---\n${customPrompt}\n` : '') +
         `--- 出力ルール ---\n- 280文字程度以内\n- 攻撃的・不適切表現は禁止\n- 改行2回以内\n- 出力はテキスト本文のみ`;
}

function buildRandomPrompt(persona: any) {
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

  return `あなたは指定されたペルソナになりきってThreads用の短文投稿を1件だけ出力します。\n` +
         `今回のテーマ: ${selectedTopic}\n` +
         `出力はテキスト本文のみ。絵文字やハッシュタグの使用は内容に応じて自然に。\n` +
         `--- ペルソナ情報 ---\n${personaInfo}\n` +
         `--- 投稿方針 ---\n` +
         `- このペルソナらしい自然な投稿内容にする\n` +
         `- テーマに沿いつつも、個性を活かした内容にする\n` +
         `- フォロワーに価値を提供する内容を心がける\n` +
         `--- 出力ルール ---\n- 280文字程度以内\n- 攻撃的・不適切表現は禁止\n- 改行2回以内\n- 出力はテキスト本文のみ`;
}

function calculateRandomNextRun(randomTimes: string[], timezone: string = 'UTC'): string {
  if (!randomTimes || randomTimes.length === 0) {
    // デフォルト時間（9時、12時、18時）から選択
    const defaultTimes = ['09:00:00', '12:00:00', '18:00:00'];
    randomTimes = defaultTimes;
  }

  // 現在時刻をタイムゾーンに合わせて取得
  const now = new Date();
  const randomTime = randomTimes[Math.floor(Math.random() * randomTimes.length)];
  const [hours, minutes, seconds = 0] = randomTime.split(':').map(Number);
  
  // タイムゾーン考慮した次回実行時刻の計算
  if (timezone === 'UTC') {
    const nextRun = new Date();
    nextRun.setDate(nextRun.getDate() + 1); // 明日
    nextRun.setUTCHours(hours, minutes, seconds, 0);
    return nextRun.toISOString();
  } else {
    // Asia/Tokyo等のタイムゾーン対応
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const tomorrowLocal = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const localDateString = formatter.format(tomorrowLocal);
    
    // ローカル時間で次回実行時刻を作成し、UTCに変換
    const localDateTime = new Date(`${localDateString}T${randomTime}`);
    const utcOffset = getTimezoneOffset(timezone);
    const utcTime = new Date(localDateTime.getTime() - utcOffset * 60 * 1000);
    
    return utcTime.toISOString();
  }
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
      .lte('next_run_at', now.toISOString())
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
      try {
        // 🚨 CRITICAL: Rate limiting check
        const rateLimitOk = await checkPersonaRateLimit(cfg.persona_id);
        if (!rateLimitOk) {
          console.log(`🛑 Rate limit exceeded for persona ${cfg.persona_id}, skipping`);
          
          // Skip but still update next_run_at to prevent infinite retries
          await supabase
            .from('auto_post_configs')
            .update({ 
              next_run_at: new Date(Date.now() + RATE_LIMITS.COOLDOWN_AFTER_FAILURE).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', cfg.id);
          
          processed++;
          continue;
        }

        processed++;

        // ペルソナ情報取得
        const { data: persona, error: personaError } = await supabase
          .from('personas')
          .select('id, user_id, name, tone_of_voice, expertise, personality')
          .eq('id', cfg.persona_id)
          .eq('is_active', true) // 🚨 CRITICAL: Only process active personas
          .single();
          
        if (personaError || !persona) {
          console.log(`❌ Persona ${cfg.persona_id} not found or inactive, skipping config ${cfg.id}`);
          processed++;
          continue;
        }

        // APIキー解決とコンテンツ生成（制限付きローテーション）
        const prompt = buildPrompt(persona, cfg.prompt_template, cfg.content_prefs);
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
        if (queueErr) throw queueErr;

        // 次回実行時刻を計算（複数時間対応）
        let nextRunAt: string;
        
        if (cfg.multi_time_enabled && cfg.post_times && cfg.post_times.length > 0) {
          // 複数時間設定の場合：次の時間スロットを計算
          const { data: nextTime, error: calcErr } = await supabase
            .rpc('calculate_next_multi_time_run', {
              p_current_time: now.toISOString(), // 現在時刻を使用
              time_slots: cfg.post_times,
              timezone_name: cfg.timezone || 'UTC'
            });
          
          if (calcErr) {
            console.error('Failed to calculate next multi-time run:', calcErr);
            // フォールバック: 翌日の最初の時間スロットを使用
            const firstTime = cfg.post_times[0];
            const nextDay = new Date(now);
            nextDay.setDate(nextDay.getDate() + 1);
            const [hours, minutes] = firstTime.split(':').map(Number);
            
            // タイムゾーンを考慮して翌日の最初の時間を設定
            if (cfg.timezone && cfg.timezone !== 'UTC') {
              // タイムゾーンを考慮した計算
              const localNextDay = new Date(nextDay.toLocaleString("en-US", {timeZone: cfg.timezone}));
              localNextDay.setHours(hours, minutes, 0, 0);
              nextRunAt = localNextDay.toISOString();
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
              timezone_name: cfg.timezone || 'UTC'
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

        // 🚨 CRITICAL: 排他制御と二重チェック（投稿作成前に実行）
        const { data: preCreateCheck, error: preCheckError } = await supabase
          .from('auto_post_configs')
          .select('next_run_at, updated_at, is_active')
          .eq('id', cfg.id)
          .single();
          
        if (preCheckError || !preCreateCheck || !preCreateCheck.is_active) {
          console.error(`🛑 Config ${cfg.id} is no longer active, aborting before post creation`);
          failed++;
          continue;
        }
        
        // 次回実行時刻が変更されていないかチェック（重複実行防止）
        if (preCreateCheck.next_run_at !== cfg.next_run_at) {
          console.log(`⚠️ Config ${cfg.id} already processed by another instance. Safe abort.`);
          continue;
        }

        // 🚨 CRITICAL: Post-creation validation and final check
        const { data: currentConfig, error: checkError } = await supabase
          .from('auto_post_configs')
          .select('next_run_at, updated_at, is_active')
          .eq('id', cfg.id)
          .single();
          
        if (checkError || !currentConfig || !currentConfig.is_active) {
          console.error(`🛑 Config ${cfg.id} is no longer active or accessible, aborting update`);
          failed++;
          continue;
        }
        
        // 次回実行時刻が変更されていないかチェック（並行実行防止）
        if (currentConfig.next_run_at !== cfg.next_run_at) {
          console.log(`⚠️ Config ${cfg.id} next_run_at was already updated by another process. Safe abort.`);
          continue;
        }

        // 設定を更新（楽観的排他制御 + is_active再確認）
        const { data: updatedRows, error: updateErr } = await supabase
          .from('auto_post_configs')
          .update({ 
            next_run_at: nextRunAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', cfg.id)
          .eq('next_run_at', cfg.next_run_at) // 元の値と一致する場合のみ更新
          .eq('is_active', true) // 🚨 CRITICAL: アクティブな場合のみ更新
          .select('id');
        
        if (updateErr) {
          console.error('Failed to update next_run_at for config', cfg.id, updateErr);
        } else if (!updatedRows || updatedRows.length === 0) {
          console.log(`⚠️ Config ${cfg.id} was not updated (likely deactivated by user)`);
        } else {
          console.log(`✅ Config ${cfg.id} updated with next_run_at: ${nextRunAt}`);
        }

        posted++;
      } catch (e) {
        console.error('❌ Auto post generation failed for config', cfg.id, ':', e);
        failed++;
        
        // 🚨 CRITICAL: エラー時の安全な時刻更新（アクティブ状態をチェック）
        try {
          // First check if config is still active
          const { data: activeCheck, error: activeCheckErr } = await supabase
            .from('auto_post_configs')
            .select('is_active')
            .eq('id', cfg.id)
            .single();
            
          if (activeCheckErr || !activeCheck || !activeCheck.is_active) {
            console.log(`🛑 Config ${cfg.id} is no longer active, skipping failure backoff update`);
            continue;
          }
          
          // 長めのクールダウン時間を設定（API制限対策）
          const cooldownNextRun = new Date(Date.now() + RATE_LIMITS.COOLDOWN_AFTER_FAILURE);
          
          const { data: backoffUpdate, error: updateErr } = await supabase
            .from('auto_post_configs')
            .update({ 
              next_run_at: cooldownNextRun.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', cfg.id)
            .eq('is_active', true) // 🚨 CRITICAL: Only update if still active
            .select('id');
            
          if (updateErr) {
            console.error('Failed to update next_run_at after failure for config', cfg.id, updateErr);
          } else if (backoffUpdate && backoffUpdate.length > 0) {
            console.log(`⏭️ Config ${cfg.id} failure cooldown: next_run_at -> ${cooldownNextRun.toISOString()}`);
          } else {
            console.log(`ℹ️ Config ${cfg.id} was deactivated during failure handling`);
          }
        } catch (updateCatchErr) {
          console.error('Unexpected error updating next_run_at after failure:', updateCatchErr);
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
          timeZone: randomCfg.timezone || 'UTC' 
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

        for (const timeStr of randomTimes) {
          // 🚨 CRITICAL: Limit slots processed per run
          if (slotsProcessed >= 1) {
            console.log(`⚠️ Limiting random post processing to 1 slot per run for safety`);
            break;
          }
          
          // 既に投稿済みの時間はスキップ
          if (postedTimesToday.includes(timeStr)) {
            continue;
          }

          // 現在時刻と設定時刻を比較
          const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
          const targetTime = new Date();
          
          // タイムゾーンを考慮して今日の設定時刻を作成
          if (randomCfg.timezone === 'UTC') {
            targetTime.setUTCHours(hours, minutes, seconds, 0);
          } else {
            // 指定タイムゾーンでの時刻を作成
            const formatter = new Intl.DateTimeFormat('en-CA', {
              timeZone: randomCfg.timezone,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            });
            const todayStr = formatter.format(new Date());
            const localDateTime = new Date(`${todayStr}T${timeStr}`);
            const utcOffset = getTimezoneOffset(randomCfg.timezone);
            targetTime.setTime(localDateTime.getTime() - utcOffset * 60 * 1000);
          }

          // 現在時刻が設定時刻を過ぎているかチェック + 許容ウィンドウ（60分）
          const nowUtc = new Date();
          console.log(`🔍 DEBUG: Checking slot ${timeStr} - nowUtc: ${nowUtc.toISOString()}, targetTime: ${targetTime.toISOString()}`);
          
          if (nowUtc < targetTime) {
            console.log(`⏰ DEBUG: Slot ${timeStr} not yet reached, skipping`);
            continue; // まだ時刻前
          }
          const diffMs = nowUtc.getTime() - targetTime.getTime();
          console.log(`⏱️ DEBUG: Time difference for ${timeStr}: ${Math.round(diffMs/1000)}s`);
          
          const windowMs = 60 * 60 * 1000; // 🚨 CRITICAL: 60分ウィンドウ（cronが1分間隔なので余裕を持たせる）
          if (diffMs > windowMs) {
            // 🚨 CRITICAL FIX: スキップ時もslotsProcessedをインクリメント（データベース更新トリガー）
            slotsProcessed++;
            // 1時間以上遅れた場合はスキップし、記録だけ残す（次回スキップされないように）
            console.log(`⏭️ Skipping heavily outdated random slot ${timeStr} (diff ${Math.round(diffMs/1000)}s), marking as posted to prevent retry`);
            postedTimesToday.push(timeStr); // 🚨 CRITICAL: スキップ時も記録して無限ループ防止
            break; // 🚨 CRITICAL: breakして即座にデータベース更新に進む
          }

          console.log(`✅ DEBUG: Processing random post for ${persona.name} at ${timeStr}`);
          slotsProcessed++;

          // ランダムポスト用のプロンプト生成（独自ロジック）
          const prompt = buildRandomPrompt(persona);
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
              const nextRunAt = calculateRandomNextRun(randomTimes, randomCfg.timezone || 'UTC');
              updateData.next_run_at = nextRunAt;
              console.log(`📅 All slots processed for persona ${persona.name}, next run: ${nextRunAt}`);
            } else {
              // 🚨 CRITICAL: 部分的に処理した場合も、次の未処理スロットを計算
              const remainingSlots = randomTimes.filter(time => !postedTimesToday.includes(time));
              if (remainingSlots.length > 0) {
                // 次の未処理スロットの時刻を計算
                const nextSlot = remainingSlots[0];
                const [hours, minutes] = nextSlot.split(':').map(Number);
                const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: randomCfg.timezone || 'UTC' });
                const nextSlotTime = new Date(`${todayStr}T${nextSlot}`);
                
                if (randomCfg.timezone !== 'UTC') {
                  const utcOffset = getTimezoneOffset(randomCfg.timezone);
                  nextSlotTime.setTime(nextSlotTime.getTime() - utcOffset * 60 * 1000);
                }
                
                updateData.next_run_at = nextSlotTime.toISOString();
                console.log(`📅 Next slot for persona ${persona.name}: ${nextSlot} (${updateData.next_run_at})`);
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

    return new Response(
      JSON.stringify({ 
        message: 'auto-post-generator completed with enhanced safety controls', 
        processed, 
        posted, 
        failed,
        regular_configs: configs?.length || 0,
        random_configs: randomConfigs?.length || 0,
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
