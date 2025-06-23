
-- ペルソナテーブルにThreadsアプリ設定を追加
ALTER TABLE public.personas 
ADD COLUMN threads_app_id TEXT,
ADD COLUMN threads_app_secret TEXT,
ADD COLUMN webhook_verify_token TEXT;

-- コメントを追加
COMMENT ON COLUMN public.personas.threads_app_id IS 'Threads App ID for this persona';
COMMENT ON COLUMN public.personas.threads_app_secret IS 'Threads App Secret for webhook verification';
COMMENT ON COLUMN public.personas.webhook_verify_token IS 'Webhook verify token for this persona';
