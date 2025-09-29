-- 重複キューアイテム検出用関数を作成
CREATE OR REPLACE FUNCTION get_duplicate_queue_items()
RETURNS TABLE(post_id uuid, status text, duplicate_count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    pq.post_id,
    pq.status,
    COUNT(*) as duplicate_count
  FROM post_queue pq
  GROUP BY pq.post_id, pq.status
  HAVING COUNT(*) > 1
  ORDER BY duplicate_count DESC;
$$;