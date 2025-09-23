-- Priority 1-1: ランダム投稿の時間未設定を修正
UPDATE random_post_configs 
SET 
  random_times = ARRAY['09:00:00'::time, '12:00:00'::time, '18:00:00'::time, '21:00:00'::time],
  next_run_at = CASE 
    WHEN date_trunc('hour', now() AT TIME ZONE timezone) + INTERVAL '1 hour' < (now() AT TIME ZONE timezone)::date + '09:00'::time
    THEN (now() AT TIME ZONE timezone)::date + '09:00'::time AT TIME ZONE timezone
    WHEN date_trunc('hour', now() AT TIME ZONE timezone) + INTERVAL '1 hour' < (now() AT TIME ZONE timezone)::date + '12:00'::time
    THEN (now() AT TIME ZONE timezone)::date + '12:00'::time AT TIME ZONE timezone
    WHEN date_trunc('hour', now() AT TIME ZONE timezone) + INTERVAL '1 hour' < (now() AT TIME ZONE timezone)::date + '18:00'::time
    THEN (now() AT TIME ZONE timezone)::date + '18:00'::time AT TIME ZONE timezone
    WHEN date_trunc('hour', now() AT TIME ZONE timezone) + INTERVAL '1 hour' < (now() AT TIME ZONE timezone)::date + '21:00'::time
    THEN (now() AT TIME ZONE timezone)::date + '21:00'::time AT TIME ZONE timezone
    ELSE (now() AT TIME ZONE timezone)::date + INTERVAL '1 day' + '09:00'::time AT TIME ZONE timezone
  END,
  updated_at = now()
WHERE is_active = true 
  AND (array_length(random_times, 1) IS NULL OR array_length(random_times, 1) = 0);

-- Priority 1-2: 期限切れ自動投稿設定のnext_run_at更新
UPDATE auto_post_configs 
SET 
  next_run_at = CASE 
    WHEN multi_time_enabled = true AND post_times IS NOT NULL THEN
      -- マルチタイム設定の場合、次の利用可能時間を計算
      calculate_next_multi_time_run(now(), post_times, timezone)
    ELSE
      -- シングルタイム設定の場合
      calculate_timezone_aware_next_run(
        CASE 
          WHEN next_run_at > now() THEN next_run_at 
          ELSE now()
        END + INTERVAL '1 hour',
        timezone
      )
  END,
  updated_at = now()
WHERE is_active = true 
  AND next_run_at < now();