-- Phase 1 修正: 失敗箇所(cron_job_statusはビュー)を関数+権限で制御

-- 1) 主要テーブルのINSERTポリシー強化（user_id必須）
DROP POLICY IF EXISTS "Users can create their own API keys" ON public.user_api_keys;
CREATE POLICY "Users can create their own API keys"
ON public.user_api_keys
FOR INSERT
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can create their own personas" ON public.personas;
CREATE POLICY "Users can create their own personas"
ON public.personas
FOR INSERT
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
CREATE POLICY "Users can create their own posts"
ON public.posts
FOR INSERT
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can create their own auto replies" ON public.auto_replies;
CREATE POLICY "Users can create their own auto replies"
ON public.auto_replies
FOR INSERT
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can insert their own activity logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can create their own thread replies" ON public.thread_replies;
CREATE POLICY "Users can create their own thread replies"
ON public.thread_replies
FOR INSERT
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can create their own security config" ON public.security_config;
CREATE POLICY "Users can create their own security config"
ON public.security_config
FOR INSERT
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- security_events: サービスロール以外はuser_idの検証を強化
DROP POLICY IF EXISTS "Authenticated users can insert security events" ON public.security_events;
CREATE POLICY "Authenticated users can insert security events"
ON public.security_events
FOR INSERT
WITH CHECK (
  (current_setting('role'::text, true) = 'service_role') OR
  (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR user_id IS NULL))
);

-- rate_limits: サービスロールのみ管理
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;
CREATE POLICY "Service role can manage rate limits"
ON public.rate_limits
FOR ALL
USING (current_setting('role'::text, true) = 'service_role');

-- 2) cron_job_statusはビューのためRLS不可。権限+SECURITY DEFINER関数で制御
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'cron_job_status'
  ) THEN
    -- 公開権限を撤回し、サービスロールのみ直接SELECT可
    REVOKE ALL ON TABLE public.cron_job_status FROM PUBLIC;
    REVOKE ALL ON TABLE public.cron_job_status FROM anon;
    REVOKE ALL ON TABLE public.cron_job_status FROM authenticated;
    GRANT SELECT ON TABLE public.cron_job_status TO service_role;
  END IF;
END
$$;

-- 管理者のみ結果が返るSECURITY DEFINER関数
CREATE OR REPLACE FUNCTION public.get_cron_job_status()
RETURNS SETOF public.cron_job_status
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $fn$
  SELECT *
  FROM public.cron_job_status
  WHERE is_admin(auth.uid());
$fn$;

GRANT EXECUTE ON FUNCTION public.get_cron_job_status() TO authenticated;

-- 3) ポリシー違反ログ用補助関数（冪等）
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
    NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;