-- ギャル曽根のnext_run_atを今すぐ実行可能な時間に修正
-- 現在時刻が19:58を過ぎている場合、次の利用可能時間に設定
UPDATE auto_post_configs 
SET next_run_at = CASE 
  WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Tokyo') < 20 THEN 
    DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Tokyo') + INTERVAL '20 hours'
  ELSE 
    DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Tokyo') + INTERVAL '1 day' + INTERVAL '18 hours'
END AT TIME ZONE 'Asia/Tokyo',
updated_at = now()
WHERE persona_id = (SELECT id FROM personas WHERE name = 'ギャル曽根' LIMIT 1);

-- システムの自動計算が間違っているため、緊急修正ログ
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'urgent_schedule_fix',
  jsonb_build_object(
    'issue', 'calculate_next_multi_time_run keeps setting next_run to tomorrow',
    'action', 'Manual override to fix immediate scheduling',
    'persona', 'ギャル曽根',
    'missed_times', '["19:41", "19:53", "19:58"]',
    'timestamp', now()
  )
);