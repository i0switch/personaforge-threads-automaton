-- ギャル曽根のランダムポスト設定を修正
UPDATE random_post_configs 
SET 
  is_active = true,
  next_run_at = calculate_next_multi_time_run(
    now(), 
    ARRAY['09:00:00'::time, '12:00:00'::time, '16:33:00'::time, '16:40:00'::time, '18:00:00'::time],
    'Asia/Tokyo'
  ),
  updated_at = now()
WHERE persona_id = '436dc662-253b-4bf7-bfac-d52c475fe238';

-- 修正内容をセキュリティログに記録
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'random_post_config_fixed',
  jsonb_build_object(
    'persona_name', 'ギャル曽根',
    'persona_id', '436dc662-253b-4bf7-bfac-d52c475fe238',
    'action', 'activated_and_rescheduled',
    'timezone', 'Asia/Tokyo',
    'timestamp', now()
  )
);