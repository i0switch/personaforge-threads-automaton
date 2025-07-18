-- Add delay settings to personas table
ALTER TABLE public.personas 
ADD COLUMN auto_reply_delay_minutes integer DEFAULT 0;

-- Add delay settings to auto_replies table  
ALTER TABLE public.auto_replies
ADD COLUMN delay_minutes integer DEFAULT 0;

-- Add scheduled reply fields to thread_replies table
ALTER TABLE public.thread_replies
ADD COLUMN scheduled_reply_at timestamp with time zone,
ADD COLUMN reply_status text DEFAULT 'pending' CHECK (reply_status IN ('pending', 'scheduled', 'sent', 'failed'));

-- Create index for efficient scheduled reply queries
CREATE INDEX idx_thread_replies_scheduled ON public.thread_replies(scheduled_reply_at, reply_status) 
WHERE scheduled_reply_at IS NOT NULL;