-- ギャル曽根の完全自動オートポスト設定を修正
UPDATE auto_post_configs 
SET 
  is_active = true,
  next_run_at = calculate_next_multi_time_run(
    now(), 
    post_times,
    timezone
  ),
  updated_at = now()
WHERE persona_id = (
  SELECT id FROM personas WHERE name = 'ギャル曽根' LIMIT 1
);

-- 修正内容をログに記録
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'auto_post_config_activation',
  jsonb_build_object(
    'persona_name', 'ギャル曽根',
    'action', 'activated_multi_time_auto_post',
    'post_times', ARRAY['16:35:00', '17:59:00', '18:00:00', '19:17:00'],
    'timezone', 'Asia/Tokyo',
    'timestamp', now()
  )
);