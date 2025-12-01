-- 🔧 残りのstuck processing itemsを削除
-- 10分以上stuck状態のprocessing項目を削除（UPDATE→failedではなくDELETEで安全に処理）
DELETE FROM post_queue 
WHERE status = 'processing' 
  AND updated_at < NOW() - INTERVAL '10 minutes';

-- セキュリティログに記録
INSERT INTO security_events (event_type, details)
SELECT 
  'manual_stuck_cleanup',
  jsonb_build_object(
    'deleted_count', COUNT(*),
    'reason', 'Manual cleanup of stuck processing items',
    'timestamp', now()
  )
FROM post_queue 
WHERE status = 'processing' 
  AND updated_at < NOW() - INTERVAL '10 minutes';