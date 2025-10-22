-- Add retry and error tracking columns to thread_replies table
ALTER TABLE thread_replies
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS error_details JSONB,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;

-- Add index for efficient failed reply queries
CREATE INDEX IF NOT EXISTS idx_thread_replies_retry 
ON thread_replies(reply_status, retry_count, last_retry_at) 
WHERE reply_status = 'failed';

-- Add index for stuck processing queries
CREATE INDEX IF NOT EXISTS idx_thread_replies_stuck_processing
ON thread_replies(reply_status, updated_at)
WHERE reply_status = 'processing';

-- Comment explaining the columns
COMMENT ON COLUMN thread_replies.retry_count IS 'Number of retry attempts for failed replies';
COMMENT ON COLUMN thread_replies.last_retry_at IS 'Timestamp of last retry attempt';
COMMENT ON COLUMN thread_replies.error_details IS 'JSON containing error details from Threads API';
COMMENT ON COLUMN thread_replies.max_retries IS 'Maximum number of retry attempts allowed';