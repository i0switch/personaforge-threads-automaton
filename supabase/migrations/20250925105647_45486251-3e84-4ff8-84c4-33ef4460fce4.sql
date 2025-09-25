-- ギャル曽根のnext_run_atを今日の20:00（JST）に手動修正
UPDATE auto_post_configs 
SET next_run_at = '2025-09-25 20:00:00+09'::timestamptz,
    updated_at = now()
WHERE persona_id = (SELECT id FROM personas WHERE name = 'ギャル曽根' LIMIT 1);

-- 修正ログ
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'manual_schedule_fix',
  jsonb_build_object(
    'issue', '19:53 post skipped due to incorrect next_run calculation',
    'action', 'Manually set next_run_at to today 20:00 JST',
    'persona', 'ギャル曽根',
    'timestamp', now()
  )
);