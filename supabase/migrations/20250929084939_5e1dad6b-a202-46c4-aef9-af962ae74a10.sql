-- 自動修復SQL: スタックしたprocessing状態を修復

-- 1. 10分以上processing状態の項目をfailedに変更
UPDATE post_queue 
SET 
  status = 'failed',
  updated_at = now()
WHERE 
  status = 'processing' 
  AND updated_at < now() - INTERVAL '10 minutes'
  AND id NOT IN (
    SELECT DISTINCT pq2.id 
    FROM post_queue pq2 
    WHERE pq2.post_id = post_queue.post_id 
    AND pq2.status = 'failed'
  );

-- 2. 重複エントリの削除（古い方を残す）
DELETE FROM post_queue 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (
             PARTITION BY post_id, status 
             ORDER BY created_at ASC
           ) as rn
    FROM post_queue
  ) t 
  WHERE rn > 1
);

-- 3. 孤立したキューエントリの削除
DELETE FROM post_queue 
WHERE post_id NOT IN (SELECT id FROM posts);

-- 4. 完了済み投稿のキューを更新
UPDATE post_queue 
SET status = 'completed', updated_at = now()
WHERE post_id IN (SELECT id FROM posts WHERE status = 'published')
  AND status != 'completed';