-- Update the check constraint to remove 'scheduled' state
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'thread_replies_reply_status_check'
  ) THEN
    ALTER TABLE thread_replies DROP CONSTRAINT thread_replies_reply_status_check;
  END IF;
  
  -- Add correct check constraint (without 'scheduled')
  ALTER TABLE thread_replies 
  ADD CONSTRAINT thread_replies_reply_status_check 
  CHECK (reply_status IN ('pending', 'processing', 'sent', 'failed'));
END $$;