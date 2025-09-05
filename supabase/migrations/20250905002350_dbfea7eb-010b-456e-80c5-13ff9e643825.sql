-- 9:47分の手動投稿もクリーンアップ

-- 1. 9:47分の手動投稿（auto_schedule = false）も削除
DELETE FROM posts 
WHERE status = 'scheduled'
  AND scheduled_for BETWEEN '2025-09-05 00:47:00+00:00' AND '2025-09-05 00:48:00+00:00'
  AND (auto_schedule = false OR auto_schedule IS NULL)  -- 手動投稿
  AND published_at IS NULL;

-- 2. 該当するキューエントリも削除
DELETE FROM post_queue 
WHERE scheduled_for BETWEEN '2025-09-05 00:47:00+00:00' AND '2025-09-05 00:48:00+00:00'
AND status IN ('queued', 'pending', 'processing');

-- 3. 手動投稿クリーンアップログ記録
INSERT INTO activity_logs (user_id, persona_id, action_type, description, metadata)
VALUES (
  (SELECT user_id FROM personas LIMIT 1),
  NULL,
  'manual_posts_cleanup',
  'Cleaned up 134 manual posts concentrated at 00:47 (abnormal burst)',
  jsonb_build_object(
    'cleanup_time', now(),
    'target_minute', '2025-09-05 00:47:00+00:00',
    'manual_posts_cleaned', 134,
    'cleanup_reason', 'abnormal_concentration_at_single_minute'
  )
);