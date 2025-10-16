-- reply_status制約を修正して、scheduledとcompletedを追加
ALTER TABLE public.thread_replies 
DROP CONSTRAINT IF EXISTS thread_replies_reply_status_check;

ALTER TABLE public.thread_replies 
ADD CONSTRAINT thread_replies_reply_status_check 
CHECK (reply_status IN ('pending', 'processing', 'scheduled', 'sent', 'completed', 'failed'));

-- 既存の不正なデータを修正
UPDATE public.thread_replies 
SET reply_status = 'sent' 
WHERE reply_status NOT IN ('pending', 'processing', 'scheduled', 'sent', 'completed', 'failed');

-- インデックスを追加してパフォーマンスを向上
CREATE INDEX IF NOT EXISTS idx_thread_replies_status ON public.thread_replies(reply_status);
CREATE INDEX IF NOT EXISTS idx_thread_replies_scheduled ON public.thread_replies(scheduled_reply_at) 
WHERE reply_status = 'scheduled';