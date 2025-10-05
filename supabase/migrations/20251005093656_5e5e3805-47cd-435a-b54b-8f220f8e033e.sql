-- Add unique constraint to reply_id to prevent duplicates
DO $$
BEGIN
  -- First, remove any duplicates that may exist
  DELETE FROM thread_replies
  WHERE id NOT IN (
    SELECT DISTINCT ON (reply_id) id
    FROM thread_replies
    ORDER BY reply_id, created_at DESC
  );
  
  -- Add unique constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'thread_replies_reply_id_unique'
  ) THEN
    ALTER TABLE thread_replies 
    ADD CONSTRAINT thread_replies_reply_id_unique UNIQUE (reply_id);
  END IF;
END $$;

-- Add performance index for auto_reply_sent queries
CREATE INDEX IF NOT EXISTS idx_thread_replies_auto_reply_sent 
ON thread_replies (auto_reply_sent, reply_status) 
WHERE auto_reply_sent = false;