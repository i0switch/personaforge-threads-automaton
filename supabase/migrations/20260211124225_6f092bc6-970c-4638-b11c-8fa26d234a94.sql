
-- Fix 2: Delete reply_check_settings with NULL persona_id (unusable records)
DELETE FROM public.reply_check_settings WHERE persona_id IS NULL;

-- Fix 3: Reset old stuck pending replies so they can be retried by process-unhandled-replies
UPDATE public.thread_replies 
SET reply_status = 'failed', 
    error_details = jsonb_build_object(
      'error', 'Stale Pending Cleanup', 
      'message', 'Auto-cleanup: reply stuck in pending for too long, reset for retry',
      'timestamp', now()::text
    ),
    retry_count = 0,
    last_retry_at = NULL
WHERE reply_status = 'pending' 
  AND auto_reply_sent = false 
  AND created_at < now() - interval '2 hours';
