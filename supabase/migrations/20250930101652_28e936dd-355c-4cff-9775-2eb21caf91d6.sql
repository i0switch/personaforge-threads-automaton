-- 過去の日付で止まっているランダムポスト設定を修正
UPDATE random_post_configs
SET next_run_at = calculate_next_multi_time_run(
  NOW(),
  random_times,
  COALESCE(timezone, 'UTC')
),
updated_at = NOW()
WHERE is_active = true
  AND next_run_at < NOW();