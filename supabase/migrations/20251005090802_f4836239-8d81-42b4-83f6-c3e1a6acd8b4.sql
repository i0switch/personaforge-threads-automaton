-- 既存の completed 状態を sent に統一
UPDATE thread_replies 
SET reply_status = 'sent' 
WHERE reply_status = 'completed';

-- 重複しているreply_idを特定し、最新のもの以外を削除
DELETE FROM thread_replies
WHERE id NOT IN (
  SELECT DISTINCT ON (reply_id) id
  FROM thread_replies
  ORDER BY reply_id, created_at DESC
);

-- reply_id にユニーク制約を追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'thread_replies_reply_id_unique'
  ) THEN
    ALTER TABLE thread_replies 
    ADD CONSTRAINT thread_replies_reply_id_unique UNIQUE (reply_id);
  END IF;
END $$;

-- reply_status の check constraint を追加（既存の制約があれば削除）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'thread_replies_reply_status_check'
  ) THEN
    ALTER TABLE thread_replies DROP CONSTRAINT thread_replies_reply_status_check;
  END IF;
  
  ALTER TABLE thread_replies 
  ADD CONSTRAINT thread_replies_reply_status_check 
  CHECK (reply_status IN ('pending', 'processing', 'scheduled', 'sent', 'failed'));
END $$;

-- インデックスを追加してパフォーマンス向上
CREATE INDEX IF NOT EXISTS idx_thread_replies_auto_reply_sent 
ON thread_replies (auto_reply_sent, reply_status) 
WHERE auto_reply_sent = false;