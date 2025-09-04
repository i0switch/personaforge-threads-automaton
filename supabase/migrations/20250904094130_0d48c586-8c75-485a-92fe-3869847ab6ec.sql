-- 公開済み投稿なのにqueue_statusが'completed'でないものを修正
UPDATE post_queue 
SET status = 'completed', updated_at = now()
WHERE post_id IN (
  SELECT p.id 
  FROM posts p 
  WHERE p.published_at IS NOT NULL
) 
AND status != 'completed';

-- 公開済み投稿の重複キューエントリを削除（最新のもの以外）
DELETE FROM post_queue 
WHERE id IN (
  SELECT pq.id 
  FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY created_at DESC) as rn
    FROM post_queue 
    WHERE post_id IN (
      SELECT p.id FROM posts p WHERE p.published_at IS NOT NULL
    )
  ) pq
  WHERE pq.rn > 1
);