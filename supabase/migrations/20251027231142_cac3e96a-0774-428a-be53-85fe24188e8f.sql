-- 🚨 CRITICAL FIX: calculate_next_multi_time_run関数のタイムゾーン変換バグを修正
-- 問題: timestamp文字列の構築方法が間違っており、2時間のズレが発生していた

CREATE OR REPLACE FUNCTION public.calculate_next_multi_time_run(
  p_current_time timestamp with time zone, 
  time_slots time without time zone[], 
  timezone_name text DEFAULT 'UTC'::text
)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  local_now timestamp;
  target_date date;
  next_slot time;
  next_run timestamptz;
  slot time;
  current_local_time time;
  found_today boolean := false;
  local_datetime_str text;
BEGIN
  -- Convert current time to specified timezone
  local_now := p_current_time AT TIME ZONE timezone_name;
  target_date := local_now::date;
  current_local_time := local_now::time;
  
  -- Find next available time slot today
  FOREACH slot IN ARRAY time_slots
  LOOP
    -- Use 30-second buffer for sequential posting
    IF slot > (current_local_time + INTERVAL '30 seconds') THEN
      next_slot := slot;
      found_today := true;
      EXIT;
    END IF;
  END LOOP;
  
  -- If no slot found today, use first slot tomorrow
  IF NOT found_today THEN
    next_slot := time_slots[1];
    target_date := target_date + INTERVAL '1 day';
  END IF;
  
  -- 🚨 CRITICAL FIX: 正しいISO 8601形式でタイムゾーン付き文字列を構築
  -- Asia/Tokyoの場合は+09:00オフセットを明示的に指定
  IF timezone_name = 'Asia/Tokyo' THEN
    -- YYYY-MM-DDTHH:MM:SS+09:00形式で構築
    local_datetime_str := target_date::text || 'T' || next_slot::text || '+09:00';
    next_run := local_datetime_str::timestamptz;
  ELSE
    -- 他のタイムゾーンの場合は従来の方法を使用
    next_run := (target_date::text || ' ' || next_slot::text)::timestamp AT TIME ZONE timezone_name;
  END IF;
  
  RAISE NOTICE '🕐 Next run calculated: % (timezone: %, date: %, slot: %)', 
    next_run, timezone_name, target_date, next_slot;
  
  RETURN next_run;
END;
$function$;

-- 既存のauto_post_configsのnext_run_atを再計算して修正
UPDATE auto_post_configs
SET 
  next_run_at = calculate_next_multi_time_run(
    now(),
    post_times,
    COALESCE(timezone, 'Asia/Tokyo')
  ),
  updated_at = now()
WHERE is_active = true
  AND multi_time_enabled = true
  AND post_times IS NOT NULL
  AND array_length(post_times, 1) > 0;

-- 修正ログを記録
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'timezone_calculation_fixed',
  jsonb_build_object(
    'issue', '2-hour timezone offset bug in calculate_next_multi_time_run',
    'solution', 'Explicitly use ISO 8601 format with +09:00 offset for Asia/Tokyo',
    'affected_function', 'calculate_next_multi_time_run',
    'fixed_at', now()
  )
);