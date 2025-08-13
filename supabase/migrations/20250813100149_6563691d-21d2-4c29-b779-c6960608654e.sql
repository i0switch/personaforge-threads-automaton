-- Phase 1: 高優先度 - RLSポリシー強化
-- 主要テーブルのINSERTポリシーにuser_id検証を追加

-- user_api_keysテーブルのINSERTポリシー強化
DROP POLICY IF EXISTS "Users can create their own API keys" ON public.user_api_keys;
CREATE POLICY "Users can create their own API keys" 
ON public.user_api_keys 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- personasテーブルのINSERTポリシー強化
DROP POLICY IF EXISTS "Users can create their own personas" ON public.personas;
CREATE POLICY "Users can create their own personas" 
ON public.personas 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- postsテーブルのINSERTポリシー強化
DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
CREATE POLICY "Users can create their own posts" 
ON public.posts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- auto_repliesテーブルのINSERTポリシー強化
DROP POLICY IF EXISTS "Users can create their own auto replies" ON public.auto_replies;
CREATE POLICY "Users can create their own auto replies" 
ON public.auto_replies 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- security_eventsテーブルのINSERTポリシー強化（サービス以外はuser_id必須）
DROP POLICY IF EXISTS "Authenticated users can insert security events" ON public.security_events;
CREATE POLICY "Authenticated users can insert security events" 
ON public.security_events 
FOR INSERT 
WITH CHECK (
  (current_setting('role'::text, true) = 'service_role') OR 
  (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR user_id IS NULL))
);

-- thread_repliesテーブルのINSERTポリシー強化
DROP POLICY IF EXISTS "Users can create their own thread replies" ON public.thread_replies;
CREATE POLICY "Users can create their own thread replies" 
ON public.thread_replies 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- security_configテーブルのINSERTポリシー強化
DROP POLICY IF EXISTS "Users can create their own security config" ON public.security_config;
CREATE POLICY "Users can create their own security config" 
ON public.security_config 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- activity_logsテーブルのINSERTポリシー強化
DROP POLICY IF EXISTS "Users can insert their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can insert their own activity logs" 
ON public.activity_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- cron_job_statusテーブルにRLS追加（管理者のみアクセス可能）
ALTER TABLE public.cron_job_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view cron job status" 
ON public.cron_job_status 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can manage cron jobs" 
ON public.cron_job_status 
FOR ALL 
USING (is_admin(auth.uid()));

-- セキュリティ強化：rate_limitsテーブルのポリシー見直し
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;
CREATE POLICY "Service role can manage rate limits" 
ON public.rate_limits 
FOR ALL 
USING (current_setting('role'::text, true) = 'service_role');

-- ログ記録の強化：ポリシー違反時のログ記録
CREATE OR REPLACE FUNCTION log_policy_violation(
  table_name text,
  operation text,
  user_id_attempted uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
  PERFORM log_security_event(
    'policy_violation',
    auth.uid(),
    NULL,
    NULL,
    jsonb_build_object(
      'table', table_name,
      'operation', operation,
      'attempted_user_id', user_id_attempted,
      'timestamp', now()
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    -- セキュリティログの失敗は他の処理をブロックしない
    NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;