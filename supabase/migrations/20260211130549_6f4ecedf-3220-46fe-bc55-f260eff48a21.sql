
-- 根本原因1: reply_check_settings.persona_id に NOT NULL 制約を追加
-- これにより、persona_id が NULL のレコードが今後作成されることを防止
ALTER TABLE public.reply_check_settings 
ALTER COLUMN persona_id SET NOT NULL;

-- 根本原因2: スタック返信を自動クリーンアップするDB関数を作成
CREATE OR REPLACE FUNCTION public.auto_cleanup_stuck_replies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 2時間以上pendingのままの返信をfailedにリセット（再処理対象にする）
  UPDATE public.thread_replies 
  SET reply_status = 'failed',
      error_details = jsonb_build_object(
        'error', 'Auto Cleanup',
        'message', 'Auto-cleanup: reply stuck in pending for over 2 hours',
        'cleanup_at', now()::text
      ),
      retry_count = 0,
      last_retry_at = NULL
  WHERE reply_status = 'pending'
    AND auto_reply_sent = false
    AND created_at < now() - interval '2 hours';

  -- 24時間以上processingのままの返信もリセット
  UPDATE public.thread_replies 
  SET reply_status = 'failed',
      error_details = jsonb_build_object(
        'error', 'Processing Timeout',
        'message', 'Auto-cleanup: reply stuck in processing for over 24 hours',
        'cleanup_at', now()::text
      ),
      retry_count = 0,
      last_retry_at = NULL
  WHERE reply_status = 'processing'
    AND updated_at < now() - interval '24 hours';
END;
$$;
