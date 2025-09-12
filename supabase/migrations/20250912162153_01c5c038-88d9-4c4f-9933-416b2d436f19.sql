-- 🚨 フェーズ4: Security Definer View問題の最終修正

-- 1. 問題のあるビューを削除（安全に）
DROP VIEW IF EXISTS public.filtered_activity_logs CASCADE;

-- 2. cron_job_statusは削除せず、Security Invoker関数でアクセス制御
-- 安全なアクティビティログアクセス関数
CREATE OR REPLACE FUNCTION public.get_user_activity_logs(target_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  persona_id uuid,
  action_type text,
  description text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  -- ユーザー認証必須
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- 管理者または自分のログのみ
  IF NOT (is_admin(auth.uid()) OR COALESCE(target_user_id, auth.uid()) = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions';
  END IF;
  
  RETURN QUERY
  SELECT 
    al.id,
    al.user_id,
    al.persona_id,
    al.action_type,
    al.description,
    al.metadata,
    al.created_at
  FROM activity_logs al
  WHERE al.user_id = COALESCE(target_user_id, auth.uid())
    AND al.action_type NOT IN ('post_publish_failed', 'auto_schedule_cleanup', 'schedule_cleanup', 'safe_cleanup')
  ORDER BY al.created_at DESC;
END;
$$;

-- 3. 安全なCronステータスアクセス関数
CREATE OR REPLACE FUNCTION public.get_system_status()
RETURNS TABLE(
  component text,
  status text,
  details jsonb,
  last_check timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  -- 管理者のみアクセス可能
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  -- セキュリティログ記録
  PERFORM log_security_event_safe('admin_system_status_access', jsonb_build_object('timestamp', now()));
  
  -- システムコンポーネント状態（cronは直接アクセスしない）
  RETURN QUERY
  SELECT 
    'auto_post_configs'::text as component,
    CASE WHEN COUNT(*) > 0 THEN 'active' ELSE 'inactive' END::text as status,
    jsonb_build_object('count', COUNT(*))::jsonb as details,
    now()::timestamptz as last_check
  FROM auto_post_configs WHERE is_active = true
  
  UNION ALL
  
  SELECT 
    'reply_check_settings'::text as component,
    CASE WHEN COUNT(*) > 0 THEN 'active' ELSE 'inactive' END::text as status,
    jsonb_build_object('count', COUNT(*))::jsonb as details,
    now()::timestamptz as last_check
  FROM reply_check_settings WHERE is_active = true
  
  UNION ALL
  
  SELECT 
    'active_personas'::text as component,
    CASE WHEN COUNT(*) > 0 THEN 'active' ELSE 'inactive' END::text as status,
    jsonb_build_object('count', COUNT(*))::jsonb as details,
    now()::timestamptz as last_check
  FROM personas WHERE is_active = true;
END;
$$;

-- 4. セキュリティレポート生成関数
CREATE OR REPLACE FUNCTION public.generate_security_report()
RETURNS TABLE(
  category text,
  item text,
  status text,
  risk_level text,
  recommendation text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  -- 管理者のみ実行可能
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  RETURN QUERY
  -- RLSチェック
  SELECT 
    'RLS Protection'::text as category,
    t.table_name::text as item,
    CASE WHEN t.row_security = 'YES' THEN 'ENABLED' ELSE 'DISABLED' END::text as status,
    CASE WHEN t.row_security = 'YES' THEN 'LOW' ELSE 'CRITICAL' END::text as risk_level,
    CASE WHEN t.row_security = 'YES' THEN 'RLS properly enabled' ELSE 'ENABLE RLS IMMEDIATELY' END::text as recommendation
  FROM information_schema.tables t
  WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
  
  UNION ALL
  
  -- Security Definer関数チェック
  SELECT 
    'Function Security'::text as category,
    p.proname::text as item,
    CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END::text as status,
    CASE WHEN p.prosecdef THEN 'MEDIUM' ELSE 'LOW' END::text as risk_level,
    CASE WHEN p.prosecdef THEN 'Review if DEFINER mode is necessary' ELSE 'Security mode appropriate' END::text as recommendation
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname NOT LIKE 'pg_%'
    AND p.proname IN ('has_role', 'is_admin') -- 主要な関数のみ
  ORDER BY category, risk_level DESC;
END;
$$;

-- 5. セキュリティイベント記録
INSERT INTO security_events (event_type, details) 
VALUES ('security_definer_view_remediation', jsonb_build_object(
  'action', 'Removed problematic Security Definer views',
  'views_removed', ARRAY['filtered_activity_logs'],
  'replacement_functions', ARRAY['get_user_activity_logs', 'get_system_status'],
  'timestamp', now()
));