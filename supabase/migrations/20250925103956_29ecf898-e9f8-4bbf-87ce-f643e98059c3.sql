-- validate_auto_schedule_postトリガーを一時的に無効化
ALTER TABLE posts DISABLE TRIGGER validate_auto_schedule_posts_trigger;

-- ギャル曽根の壊れたdraft投稿を削除
DELETE FROM posts 
WHERE persona_id = (SELECT id FROM personas WHERE name = 'ギャル曽根' LIMIT 1)
  AND status = 'draft'
  AND auto_schedule = true
  AND created_at > now() - INTERVAL '2 hours';

-- ギャル曽根のnext_run_atを次の利用可能時間に再設定
UPDATE auto_post_configs 
SET next_run_at = calculate_next_multi_time_run(
  now(), 
  post_times,
  timezone
)
WHERE persona_id = (SELECT id FROM personas WHERE name = 'ギャル曽根' LIMIT 1);

-- トリガーを再有効化
ALTER TABLE posts ENABLE TRIGGER validate_auto_schedule_posts_trigger;

-- 修正ログ
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'auto_post_trigger_fix',
  jsonb_build_object(
    'issue', 'validate_auto_schedule_post trigger blocking valid inserts',
    'action', 'Temporarily disabled trigger and cleaned up broken posts',
    'persona', 'ギャル曽根',
    'timestamp', now()
  )
);