-- ギャル曽根のランダムポスト設定を確実に修正
UPDATE random_post_configs 
SET 
  is_active = true,
  next_run_at = calculate_next_multi_time_run(
    now(), 
    random_times,
    timezone
  ),
  updated_at = now()
WHERE persona_id = (
  SELECT id FROM personas WHERE name = 'ギャル曽根' LIMIT 1
);

-- 修正結果を確認用に記録
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'random_post_config_activation_confirmed',
  jsonb_build_object(
    'persona_name', 'ギャル曽根',
    'action', 'force_activation_and_reschedule',
    'timestamp', now()
  )
);