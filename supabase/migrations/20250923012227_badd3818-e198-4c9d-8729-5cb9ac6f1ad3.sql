-- Priority 2-1: リプライチェック設定のリセット（停止原因の修正）
UPDATE reply_check_settings 
SET 
  last_check_at = now() - INTERVAL '10 minutes',
  updated_at = now()
WHERE is_active = true 
  AND (last_check_at IS NULL OR last_check_at < now() - INTERVAL '2 hours');

-- Priority 2-2: 失敗した旧draft投稿のクリーンアップ
DELETE FROM post_queue 
WHERE status = 'failed'
  AND post_id IN (
    SELECT p.id 
    FROM posts p 
    WHERE p.status = 'draft' 
      AND p.auto_schedule = true
      AND p.created_at < '2025-09-23 00:00:00'
  );

-- Priority 2-3: 孤立投稿のクリーンアップ
DELETE FROM posts 
WHERE NOT EXISTS (
  SELECT 1 FROM personas per WHERE per.id = posts.persona_id
);