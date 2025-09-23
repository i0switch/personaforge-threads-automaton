-- Priority 1-1: ランダム投稿の時間未設定を修正（型キャスト修正版）
UPDATE random_post_configs 
SET 
  random_times = ARRAY['09:00:00'::time, '12:00:00'::time, '18:00:00'::time, '21:00:00'::time],
  next_run_at = CASE 
    WHEN EXTRACT(hour FROM now() AT TIME ZONE timezone) < 8
    THEN (now() AT TIME ZONE timezone)::date + '09:00:00'::time
    WHEN EXTRACT(hour FROM now() AT TIME ZONE timezone) < 11
    THEN (now() AT TIME ZONE timezone)::date + '12:00:00'::time
    WHEN EXTRACT(hour FROM now() AT TIME ZONE timezone) < 17
    THEN (now() AT TIME ZONE timezone)::date + '18:00:00'::time
    WHEN EXTRACT(hour FROM now() AT TIME ZONE timezone) < 20
    THEN (now() AT TIME ZONE timezone)::date + '21:00:00'::time
    ELSE ((now() AT TIME ZONE timezone)::date + INTERVAL '1 day') + '09:00:00'::time
  END AT TIME ZONE timezone,
  updated_at = now()
WHERE is_active = true 
  AND (array_length(random_times, 1) IS NULL OR array_length(random_times, 1) = 0);

-- Priority 1-2: 期限切れ自動投稿設定のnext_run_at更新（簡易版）
UPDATE auto_post_configs 
SET 
  next_run_at = next_run_at + INTERVAL '24 hours',
  updated_at = now()
WHERE is_active = true 
  AND next_run_at < now();