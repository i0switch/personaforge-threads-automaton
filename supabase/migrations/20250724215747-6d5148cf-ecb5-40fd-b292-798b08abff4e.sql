-- 重要なセキュリティ問題を修正：RLSの有効化

-- personas_secureテーブルのRLS有効化
ALTER TABLE public.personas_secure ENABLE ROW LEVEL SECURITY;

-- cron_job_statusテーブルのRLS有効化  
ALTER TABLE public.cron_job_status ENABLE ROW LEVEL SECURITY;

-- personas_secureの基本的なRLSポリシー作成
CREATE POLICY "Users can view their own secure personas" 
ON public.personas_secure 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own secure personas" 
ON public.personas_secure 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own secure personas" 
ON public.personas_secure 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own secure personas" 
ON public.personas_secure 
FOR DELETE 
USING (auth.uid() = user_id);

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