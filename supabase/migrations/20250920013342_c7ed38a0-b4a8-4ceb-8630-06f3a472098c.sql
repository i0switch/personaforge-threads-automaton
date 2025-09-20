-- 🛡️ 完全オートポストモードの品質保証: 自動修復トリガーとタイムアウト処理

-- 1. processing状態のタイムアウト検出・自動修復関数
CREATE OR REPLACE FUNCTION auto_fix_stuck_processing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fixed_count integer := 0;
  timeout_minutes integer := 10; -- 10分でタイムアウト
  timeout_threshold timestamptz;
BEGIN
  timeout_threshold := now() - INTERVAL '1 minute' * timeout_minutes;
  
  -- post_queueでprocessing状態が10分以上続いているものを自動修復
  UPDATE post_queue 
  SET 
    status = 'failed',
    updated_at = now()
  WHERE 
    status = 'processing' 
    AND updated_at < timeout_threshold;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  IF fixed_count > 0 THEN
    RAISE NOTICE '🔧 Auto-fixed % stuck processing queue items', fixed_count;
    
    -- セキュリティログに記録
    INSERT INTO security_events (
      event_type,
      details
    ) VALUES (
      'auto_fix_stuck_processing',
      jsonb_build_object(
        'fixed_count', fixed_count,
        'timeout_minutes', timeout_minutes,
        'timestamp', now()
      )
    );
  END IF;
END;
$$;

-- 2. post_queue整合性チェック・修復関数
CREATE OR REPLACE FUNCTION auto_fix_queue_integrity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  orphaned_count integer := 0;
  invalid_status_count integer := 0;
BEGIN
  -- 孤立したpost_queue項目（対応するpostが存在しない）を削除
  DELETE FROM post_queue 
  WHERE post_id NOT IN (SELECT id FROM posts);
  
  GET DIAGNOSTICS orphaned_count = ROW_COUNT;
  
  -- 無効な状態の組み合わせを修復
  -- published投稿のキューは完了にする
  UPDATE post_queue 
  SET status = 'completed', updated_at = now()
  WHERE post_id IN (SELECT id FROM posts WHERE status = 'published')
    AND status != 'completed';
  
  -- failed投稿のキューは失敗にする  
  UPDATE post_queue 
  SET status = 'failed', updated_at = now()
  WHERE post_id IN (SELECT id FROM posts WHERE status = 'failed')
    AND status NOT IN ('failed', 'completed');
  
  -- draft投稿のキューは失敗にする（本来存在すべきでない）
  UPDATE post_queue 
  SET status = 'failed', updated_at = now()
  WHERE post_id IN (SELECT id FROM posts WHERE status = 'draft')
    AND status != 'failed';
  
  GET DIAGNOSTICS invalid_status_count = ROW_COUNT;
  
  IF orphaned_count > 0 OR invalid_status_count > 0 THEN
    RAISE NOTICE '🔧 Queue integrity fix: % orphaned, % invalid status', orphaned_count, invalid_status_count;
    
    -- セキュリティログに記録
    INSERT INTO security_events (
      event_type,
      details
    ) VALUES (
      'auto_fix_queue_integrity',
      jsonb_build_object(
        'orphaned_count', orphaned_count,
        'invalid_status_count', invalid_status_count,
        'timestamp', now()
      )
    );
  END IF;
END;
$$;

-- 3. 定期自動修復を実行するトリガー関数
CREATE OR REPLACE FUNCTION trigger_auto_fixes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 10%の確率で自動修復を実行（負荷分散）
  IF random() < 0.1 THEN
    PERFORM auto_fix_stuck_processing();
    PERFORM auto_fix_queue_integrity();
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. post_queue更新時に自動修復を実行するトリガー
DROP TRIGGER IF EXISTS auto_fix_trigger ON post_queue;
CREATE TRIGGER auto_fix_trigger
  AFTER UPDATE ON post_queue
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_auto_fixes();

-- 5. 重複防止インデックス強化
DROP INDEX IF EXISTS idx_post_queue_unique_processing;
CREATE UNIQUE INDEX idx_post_queue_unique_processing 
ON post_queue (post_id) 
WHERE status = 'processing';

-- 6. パフォーマンス向上インデックス
CREATE INDEX IF NOT EXISTS idx_post_queue_status_updated 
ON post_queue (status, updated_at);

CREATE INDEX IF NOT EXISTS idx_posts_auto_schedule_status 
ON posts (auto_schedule, status, scheduled_for) 
WHERE auto_schedule = true;