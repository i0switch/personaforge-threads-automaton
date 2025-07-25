-- 重要なセキュリティ問題の修正 - RLS有効化

-- 1. activity_logsテーブル
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 2. analyticsテーブル
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

-- 3. auto_repliesテーブル
ALTER TABLE public.auto_replies ENABLE ROW LEVEL SECURITY;

-- 4. personasテーブル
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

-- 5. post_queueテーブル
ALTER TABLE public.post_queue ENABLE ROW LEVEL SECURITY;

-- 6. postsテーブル
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 7. reply_check_settingsテーブル
ALTER TABLE public.reply_check_settings ENABLE ROW LEVEL SECURITY;

-- 8. scheduling_settingsテーブル
ALTER TABLE public.scheduling_settings ENABLE ROW LEVEL SECURITY;

-- 9. thread_repliesテーブル
ALTER TABLE public.thread_replies ENABLE ROW LEVEL SECURITY;

-- 10. webhook_settingsテーブル
ALTER TABLE public.webhook_settings ENABLE ROW LEVEL SECURITY;