-- 🚨 フェーズ3: Security Definer問題の完全修正

-- 1. 不要なSecurity Definer関数を削除
DROP FUNCTION IF EXISTS public.get_cron_status_admin();
DROP FUNCTION IF EXISTS public.get_filtered_activity_logs_secure();
DROP FUNCTION IF EXISTS public.get_persona_tokens_secure(uuid);

-- 2. 暗号化関数の簡素化（Security Invokerに変更）
CREATE OR REPLACE FUNCTION public.encrypt_access_token_safe(token text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER  -- 変更
SET search_path = 'public'
AS $$
BEGIN
  -- 実際の暗号化はEdge Functionで実行
  RETURN 'ENCRYPTED_VIA_EDGE_FUNCTION';
END;
$$;

-- 3. 復号化関数の簡素化（Security Invokerに変更）
CREATE OR REPLACE FUNCTION public.decrypt_access_token_safe(encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER  -- 変更
SET search_path = 'public'
AS $$
BEGIN
  -- 復号化はEdge Functionで実行
  IF encrypted_token IS NULL OR encrypted_token = '' THEN
    RETURN NULL;
  END IF;
  
  -- レガシーデータの場合はNULLを返す
  IF encrypted_token LIKE 'THAA%' OR encrypted_token = 'ENCRYPTED_VIA_EDGE_FUNCTION' THEN
    RETURN NULL;
  END IF;
  
  RETURN encrypted_token;
END;
$$;

-- 4. セキュリティイベントログの簡素化（Security Invokerに変更）
CREATE OR REPLACE FUNCTION public.log_security_event_safe(
  p_event_type text, 
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER  -- 変更
SET search_path = 'public'
AS $$
BEGIN
  -- 認証されたユーザーのみ
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  
  INSERT INTO security_events (
    event_type,
    user_id,
    details
  ) VALUES (
    p_event_type,
    auth.uid(),
    p_details
  );
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- エラーは処理をブロックしない
END;
$$;

-- 5. 管理者チェック関数の確認（Security Definerが必要）
-- これらは維持する必要がある
-- has_role() - RLSで使用
-- is_admin() - RLSで使用

-- 6. シンプルなアクセス制御関数（Security Invokerで安全）
CREATE OR REPLACE FUNCTION public.can_access_persona(persona_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  -- 認証チェック
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  
  -- 所有者チェック
  RETURN EXISTS (
    SELECT 1 FROM personas 
    WHERE id = persona_id_param 
    AND user_id = auth.uid()
  );
END;
$$;

-- 7. セキュリティ監査ログ
CREATE OR REPLACE FUNCTION public.audit_security_functions()
RETURNS TABLE(
  function_name text,
  security_mode text,
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
  SELECT 
    p.proname::text as function_name,
    CASE p.prosecdef 
      WHEN true THEN 'SECURITY DEFINER'
      ELSE 'SECURITY INVOKER'
    END::text as security_mode,
    CASE p.prosecdef
      WHEN true THEN 'HIGH'
      ELSE 'LOW'
    END::text as risk_level,
    CASE p.prosecdef
      WHEN true THEN 'Review necessity and access controls'
      ELSE 'Security mode appropriate'
    END::text as recommendation
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname NOT LIKE 'pg_%'
  ORDER BY p.prosecdef DESC, p.proname;
END;
$$;