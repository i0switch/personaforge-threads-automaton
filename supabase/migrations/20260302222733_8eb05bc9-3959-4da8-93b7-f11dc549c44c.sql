-- 7日以上前のスケジュール済み投稿を期限切れとして失敗扱いにする
UPDATE posts 
SET status = 'failed',
    failure_reason = 'スケジュール期限切れ（7日以上経過）',
    failure_category = 'expired',
    retry_count = 99,
    updated_at = now()
WHERE status = 'scheduled' 
  AND scheduled_for < now() - interval '7 days';

-- 対応するpost_queueもクリーンアップ
UPDATE post_queue 
SET status = 'failed', updated_at = now()
WHERE post_id IN (
  SELECT id FROM posts 
  WHERE status = 'failed' 
  AND failure_category = 'expired'
)
AND status IN ('queued', 'pending');