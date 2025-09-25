-- 緊急修復: 最近作成されたdraftの自動投稿をscheduledに修正
UPDATE posts 
SET 
  status = 'scheduled',
  scheduled_for = CASE 
    WHEN created_at > NOW() - INTERVAL '10 minutes' THEN 
      '2025-09-25 20:13:00+09'::timestamptz
    ELSE 
      created_at + INTERVAL '1 hour'
  END,
  updated_at = now()
WHERE 
  auto_schedule = true 
  AND status = 'draft' 
  AND created_at > NOW() - INTERVAL '2 hours'
  AND published_at IS NULL;

-- 修正された投稿をpost_queueに追加
INSERT INTO post_queue (user_id, post_id, scheduled_for, status)
SELECT 
  p.user_id, 
  p.id, 
  p.scheduled_for,
  'queued'
FROM posts p
JOIN personas per ON p.persona_id = per.id
WHERE 
  per.name = 'ギャル曽根'
  AND p.auto_schedule = true 
  AND p.status = 'scheduled' 
  AND p.created_at > NOW() - INTERVAL '2 hours'
  AND p.published_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM post_queue pq 
    WHERE pq.post_id = p.id
  );