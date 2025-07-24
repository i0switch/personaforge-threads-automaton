-- 実際のテーブルのみでRLSを有効化（ビューは除外）

-- cron_job_statusテーブルのRLS有効化のみ実行
ALTER TABLE public.cron_job_status ENABLE ROW LEVEL SECURITY;

-- cron_job_statusは管理者のみアクセス可能
CREATE POLICY "Only admins can manage cron jobs" 
ON public.cron_job_status 
FOR ALL 
USING (is_admin(auth.uid()));

-- 管理者は全てのcron_job_statusを表示可能
CREATE POLICY "Admins can view all cron jobs" 
ON public.cron_job_status 
FOR SELECT 
USING (is_admin(auth.uid()));