-- 🚨 フェーズ2: WARNING レベルのセキュリティ問題修正

-- 1. publicスキーマの拡張機能を確認・修正
-- pg_cron拡張機能をextensionsスキーマに移動（可能な場合）
-- この操作は必要に応じてSupabase側で実行される

-- 2. セキュリティ設定の強化関数
CREATE OR REPLACE FUNCTION public.get_security_recommendations()
RETURNS TABLE(
  issue_type text,
  severity text,
  description text,
  recommendation text
)
LANGUAGE plpgsql
SECURITY INVOKER  -- Security Definineではなくinvokerを使用
SET search_path = 'public'
AS $$
BEGIN
  -- 管理者権限チェック
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    'otp_expiry'::text as issue_type,
    'WARNING'::text as severity,
    'OTP expiry time is too long (3600s)'::text as description,
    'Reduce OTP expiry to 600s (10 minutes) or less'::text as recommendation
  
  UNION ALL
  
  SELECT 
    'password_protection'::text as issue_type,
    'WARNING'::text as severity,
    'Leaked password protection is disabled'::text as description,
    'Enable leaked password protection in Supabase Auth settings'::text as recommendation
    
  UNION ALL
  
  SELECT 
    'postgres_version'::text as issue_type,
    'WARNING'::text as severity,
    'PostgreSQL version has available security patches'::text as description,
    'Upgrade PostgreSQL to latest version with security patches'::text as recommendation;
END;
$$;

-- 3. トークンアクセス関数の修正（Security Invokerに変更）
CREATE OR REPLACE FUNCTION public.get_persona_tokens_safe(persona_id_param uuid)
RETURNS TABLE(
  access_granted boolean,
  message text
)
LANGUAGE plpgsql
SECURITY INVOKER  -- Invokerに変更してセキュリティ警告を解決
SET search_path = 'public'
AS $$
DECLARE
  persona_exists boolean := false;
  is_owner boolean := false;
BEGIN
  -- ユーザー認証必須
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, 'Authentication required';
    RETURN;
  END IF;
  
  -- ペルソナ存在確認
  SELECT EXISTS (SELECT 1 FROM personas WHERE id = persona_id_param) INTO persona_exists;
  IF NOT persona_exists THEN
    RETURN QUERY SELECT false, 'Persona not found';
    RETURN;
  END IF;
  
  -- 所有者確認
  SELECT EXISTS (
    SELECT 1 FROM personas 
    WHERE id = persona_id_param AND user_id = auth.uid()
  ) INTO is_owner;
  
  IF NOT is_owner THEN
    RETURN QUERY SELECT false, 'Access denied: not your persona';
    RETURN;
  END IF;
  
  -- セキュリティログ記録
  INSERT INTO security_events (
    event_type, user_id, details
  ) VALUES (
    'safe_token_access_check',
    auth.uid(),
    jsonb_build_object('persona_id', persona_id_param)
  );
  
  RETURN QUERY SELECT true, 'Access granted to secure token retrieval';
END;
$$;

-- 4. 管理者機能の修正（Security Invokerに変更）
CREATE OR REPLACE FUNCTION public.check_admin_cron_access()
RETURNS TABLE(
  access_granted boolean,
  message text
)
LANGUAGE plpgsql
SECURITY INVOKER  -- Invokerに変更
SET search_path = 'public'
AS $$
BEGIN
  -- ユーザー認証必須
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, 'Authentication required';
    RETURN;
  END IF;
  
  -- 管理者権限確認
  IF NOT is_admin(auth.uid()) THEN
    RETURN QUERY SELECT false, 'Access denied: admin role required';
    RETURN;
  END IF;
  
  -- セキュリティログ記録
  INSERT INTO security_events (
    event_type, user_id, details
  ) VALUES (
    'admin_cron_access_check',
    auth.uid(),
    jsonb_build_object('timestamp', now())
  );
  
  RETURN QUERY SELECT true, 'Admin access granted for cron status';
END;
$$;

-- 5. セキュリティ設定推奨事項テーブル
CREATE TABLE IF NOT EXISTS public.security_recommendations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,
  priority text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  action_required text NOT NULL,
  is_resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS有効化
ALTER TABLE public.security_recommendations ENABLE ROW LEVEL SECURITY;

-- 管理者のみアクセス可能
CREATE POLICY "Admins can manage security recommendations" 
ON public.security_recommendations 
FOR ALL 
USING (is_admin(auth.uid()));

-- 6. セキュリティ推奨事項の初期データ挿入
INSERT INTO public.security_recommendations (
  category, priority, title, description, action_required
) VALUES 
  ('auth', 'HIGH', 'OTP Expiry Too Long', 'OTP tokens expire after 3600 seconds (1 hour), which is too long for security', 'Reduce OTP expiry to 600 seconds (10 minutes) in Supabase Auth settings'),
  ('auth', 'MEDIUM', 'Password Protection Disabled', 'Leaked password protection is currently disabled', 'Enable leaked password protection in Supabase Auth settings'),
  ('database', 'MEDIUM', 'PostgreSQL Version', 'Current PostgreSQL version has available security patches', 'Upgrade PostgreSQL to latest version'),
  ('schema', 'LOW', 'Extensions in Public Schema', 'Some extensions are installed in public schema', 'Move extensions to dedicated schema if possible')
ON CONFLICT DO NOTHING;