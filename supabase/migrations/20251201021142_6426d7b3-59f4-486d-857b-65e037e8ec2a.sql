-- 🔧 STEP 1: 重複削除
DELETE FROM post_queue 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY post_id, status ORDER BY updated_at DESC) as rn
    FROM post_queue
    WHERE status = 'processing'
      AND updated_at < NOW() - INTERVAL '10 minutes'
  ) t
  WHERE t.rn > 1
);

-- 🔧 STEP 2: Stuck itemsクリーンアップ
UPDATE post_queue 
SET status = 'failed', updated_at = NOW()
WHERE status = 'processing' 
  AND updated_at < NOW() - INTERVAL '10 minutes'
  AND post_id IN (SELECT id FROM posts WHERE status = 'failed')
  AND NOT EXISTS (
    SELECT 1 FROM post_queue pq2 
    WHERE pq2.post_id = post_queue.post_id 
    AND pq2.status = 'failed'
    AND pq2.id != post_queue.id
  );

-- 🔧 auto_fix_stuck_processing()改善
CREATE OR REPLACE FUNCTION public.auto_fix_stuck_processing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  dup_deleted integer;
  conflict_deleted integer;
  updated integer;
  total_fixed integer := 0;
  timeout_minutes integer := 10;
  timeout_threshold timestamptz;
BEGIN
  timeout_threshold := now() - INTERVAL '1 minute' * timeout_minutes;
  
  -- 重複削除
  DELETE FROM post_queue 
  WHERE id IN (
    SELECT id FROM (
      SELECT id, 
             ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY updated_at DESC) as rn
      FROM post_queue
      WHERE status = 'processing' AND updated_at < timeout_threshold
    ) t
    WHERE t.rn > 1
  );
  GET DIAGNOSTICS dup_deleted = ROW_COUNT;
  
  -- failedレコード存在時は削除
  DELETE FROM post_queue 
  WHERE status = 'processing' 
    AND updated_at < timeout_threshold
    AND EXISTS (
      SELECT 1 FROM post_queue pq2 
      WHERE pq2.post_id = post_queue.post_id 
      AND pq2.status = 'failed'
    );
  GET DIAGNOSTICS conflict_deleted = ROW_COUNT;
  
  -- unique制約なしの場合UPDATE
  UPDATE post_queue 
  SET status = 'failed', updated_at = now()
  WHERE status = 'processing' 
    AND updated_at < timeout_threshold;
  GET DIAGNOSTICS updated = ROW_COUNT;
  
  total_fixed := dup_deleted + conflict_deleted + updated;
  
  IF total_fixed > 0 THEN
    RAISE NOTICE '🔧 Auto-fixed % stuck processing items', total_fixed;
    
    INSERT INTO security_events (event_type, details)
    VALUES (
      'auto_fix_stuck_processing',
      jsonb_build_object(
        'fixed_count', total_fixed,
        'duplicates_deleted', dup_deleted,
        'conflicts_deleted', conflict_deleted,
        'updated', updated,
        'timeout_minutes', timeout_minutes,
        'timestamp', now()
      )
    );
  END IF;
END;
$function$;

-- 🔧 auto_fix_queue_integrity()改善
CREATE OR REPLACE FUNCTION public.auto_fix_queue_integrity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  orphaned_count integer := 0;
  invalid_status_count integer := 0;
BEGIN
  -- 孤立削除
  DELETE FROM post_queue 
  WHERE post_id NOT IN (SELECT id FROM posts);
  GET DIAGNOSTICS orphaned_count = ROW_COUNT;
  
  -- published→completed
  UPDATE post_queue 
  SET status = 'completed', updated_at = now()
  WHERE post_id IN (SELECT id FROM posts WHERE status = 'published')
    AND status != 'completed';
  
  -- failed投稿: 既存failedがあれば削除
  DELETE FROM post_queue 
  WHERE post_id IN (SELECT id FROM posts WHERE status = 'failed')
    AND status NOT IN ('failed', 'completed')
    AND EXISTS (
      SELECT 1 FROM post_queue pq2 
      WHERE pq2.post_id = post_queue.post_id 
      AND pq2.status = 'failed'
    );
  
  -- failed投稿: UPDATE
  UPDATE post_queue 
  SET status = 'failed', updated_at = now()
  WHERE post_id IN (SELECT id FROM posts WHERE status = 'failed')
    AND status NOT IN ('failed', 'completed');
  GET DIAGNOSTICS invalid_status_count = ROW_COUNT;
  
  IF orphaned_count > 0 OR invalid_status_count > 0 THEN
    RAISE NOTICE '🔧 Queue integrity: % orphaned, % invalid', orphaned_count, invalid_status_count;
    
    INSERT INTO security_events (event_type, details)
    VALUES (
      'auto_fix_queue_integrity',
      jsonb_build_object(
        'orphaned_count', orphaned_count,
        'invalid_status_count', invalid_status_count,
        'timestamp', now()
      )
    );
  END IF;
END;
$function$;