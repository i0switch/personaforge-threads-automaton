-- 🚨 緊急修正: processing状態で詰まったpost_queueのクリーンアップ

-- 1. post=draft の場合 → queue=failed に変更
UPDATE post_queue 
SET status = 'failed', updated_at = now()
WHERE status = 'processing' 
  AND post_id IN (
    SELECT id FROM posts WHERE status = 'draft'
  );

-- 2. post=failed の場合 → queue=failed に変更
UPDATE post_queue 
SET status = 'failed', updated_at = now()
WHERE status = 'processing' 
  AND post_id IN (
    SELECT id FROM posts WHERE status = 'failed'
  );

-- 3. post=scheduled の場合 → queue=queued に変更
UPDATE post_queue 
SET status = 'queued', updated_at = now()
WHERE status = 'processing' 
  AND post_id IN (
    SELECT id FROM posts WHERE status = 'scheduled'
  );