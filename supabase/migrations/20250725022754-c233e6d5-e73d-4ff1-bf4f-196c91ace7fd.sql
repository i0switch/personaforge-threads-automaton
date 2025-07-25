-- Phase 1: 最重要セキュリティ修正

-- 1. cron_job_statusテーブルのRLS設定
ALTER TABLE public.cron_job_status ENABLE ROW LEVEL SECURITY;

-- cron_job_statusは管理者のみアクセス可能
CREATE POLICY "Only admins can view cron job status"
ON public.cron_job_status
FOR ALL
USING (is_admin(auth.uid()));

-- 2. security_eventsテーブルの管理者削除ポリシー追加
CREATE POLICY "Admins can delete security events"
ON public.security_events
FOR DELETE
USING (is_admin(auth.uid()));

-- 3. activity_logsテーブルの管理者削除ポリシー追加
CREATE POLICY "Admins can delete activity logs"
ON public.activity_logs
FOR DELETE
USING (is_admin(auth.uid()));

-- 4. analyticsテーブルの管理者削除ポリシー追加
CREATE POLICY "Admins can delete analytics"
ON public.analytics
FOR DELETE
USING (is_admin(auth.uid()));

-- 5. セキュリティ設定テーブルの作成
CREATE TABLE IF NOT EXISTS public.security_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  anomaly_detection boolean DEFAULT true,
  activity_logging boolean DEFAULT true,
  security_alerts boolean DEFAULT true,
  auto_security_scan boolean DEFAULT false,
  session_timeout boolean DEFAULT true,
  strong_password_policy boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- security_configテーブルのRLS設定
ALTER TABLE public.security_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own security config"
ON public.security_config
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own security config"
ON public.security_config
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own security config"
ON public.security_config
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all security configs"
ON public.security_config
FOR SELECT
USING (is_admin(auth.uid()));

-- 6. セキュリティアラートテーブルの作成
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  type text NOT NULL,
  category text NOT NULL,
  message text NOT NULL,
  details jsonb,
  resolved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- security_alertsテーブルのRLS設定
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own security alerts"
ON public.security_alerts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own security alerts"
ON public.security_alerts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can create security alerts"
ON public.security_alerts
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) OR 
  (current_setting('role') = 'service_role')
);

CREATE POLICY "Admins can view all security alerts"
ON public.security_alerts
FOR ALL
USING (is_admin(auth.uid()));

-- 7. updated_atカラムの自動更新トリガー
CREATE TRIGGER update_security_config_updated_at
  BEFORE UPDATE ON public.security_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. レート制限テーブルの作成
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  identifier text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(endpoint, identifier)
);

-- rate_limitsテーブルのRLS設定
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage rate limits"
ON public.rate_limits
FOR ALL
USING (current_setting('role') = 'service_role');

CREATE POLICY "Admins can view rate limits"
ON public.rate_limits
FOR SELECT
USING (is_admin(auth.uid()));