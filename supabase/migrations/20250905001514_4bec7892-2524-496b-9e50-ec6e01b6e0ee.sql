-- 緊急対応：1750件バースト投稿の即時停止
-- 自動生成分のみクリーンアップ（手動予約投稿は絶対保護）

-- 1. 00:47分に集中した自動生成投稿を下書きに戻す
UPDATE posts 
SET status = 'draft',
    scheduled_for = NULL,
    retry_count = 0,
    last_retry_at = NULL,
    updated_at = now()
WHERE status = 'scheduled'
  AND scheduled_for BETWEEN '2025-09-05 00:47:00+00:00' AND '2025-09-05 00:48:00+00:00'
  AND auto_schedule = true  -- 自動生成のみ対象
  AND published_at IS NULL;

-- 2. 該当するキューエントリも削除（自動生成のみ）
DELETE FROM post_queue 
WHERE post_id IN (
  SELECT p.id 
  FROM posts p 
  WHERE p.status = 'draft'
  AND p.scheduled_for IS NULL 
  AND p.auto_schedule = true
  AND p.updated_at > now() - INTERVAL '10 seconds'  -- 直前の更新分のみ
)
AND status IN ('queued', 'pending', 'processing');

-- 3. 安全確認レポート作成
INSERT INTO activity_logs (user_id, persona_id, action_type, description, metadata)
SELECT DISTINCT
  p.user_id, 
  NULL as persona_id,
  'emergency_cleanup',
  'Emergency: Stopped 00:47 burst posting (auto-generated only)',
  jsonb_build_object(
    'cleaned_posts', (
      SELECT COUNT(*) FROM posts 
      WHERE status = 'draft' 
      AND scheduled_for IS NULL 
      AND auto_schedule = true
      AND updated_at > now() - INTERVAL '30 seconds'
    ),
    'manual_posts_protected', (
      SELECT COUNT(*) FROM posts 
      WHERE status = 'scheduled' 
      AND scheduled_for BETWEEN '2025-09-05 00:47:00+00:00' AND '2025-09-05 00:48:00+00:00'
      AND (auto_schedule IS NULL OR auto_schedule = false)
    ),
    'emergency_time', now(),
    'target_minute', '2025-09-05 00:47:00+00:00'
  )
FROM posts p 
WHERE p.status = 'draft' 
AND p.auto_schedule = true
AND p.updated_at > now() - INTERVAL '30 seconds'
LIMIT 1;