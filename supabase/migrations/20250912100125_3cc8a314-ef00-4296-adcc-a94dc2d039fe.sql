-- 🚨 緊急セキュリティ修正 Phase 1: RLS有効化とアクセス制御

-- 1. cron_job_statusテーブルのRLS有効化（現在無保護状態）
ALTER TABLE public.cron_job_status ENABLE ROW LEVEL SECURITY;

-- 2. filtered_activity_logsテーブルのRLS有効化（現在無保護状態）  
ALTER TABLE public.filtered_activity_logs ENABLE ROW LEVEL SECURITY;

-- 3. cron_job_status用の管理者専用アクセスポリシー
CREATE POLICY "Admins only can view cron job status" 
ON public.cron_job_status 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage cron job status" 
ON public.cron_job_status 
FOR ALL 
USING (current_setting('role'::text, true) = 'service_role'::text);

-- 4. filtered_activity_logs用のアクセスポリシー
CREATE POLICY "Users can view their own filtered activity logs" 
ON public.filtered_activity_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all filtered activity logs" 
ON public.filtered_activity_logs 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage filtered activity logs" 
ON public.filtered_activity_logs 
FOR ALL 
USING (current_setting('role'::text, true) = 'service_role'::text);

-- 5. セキュリティログ記録関数
CREATE OR REPLACE FUNCTION public.log_security_fix_applied(fix_type text, details jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO security_events (
    event_type,
    user_id,
    details
  ) VALUES (
    'security_fix_applied',
    auth.uid(),
    jsonb_build_object(
      'fix_type', fix_type,
      'timestamp', now(),
      'details', details
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- セキュリティログの失敗は処理をブロックしない
END;
$$;