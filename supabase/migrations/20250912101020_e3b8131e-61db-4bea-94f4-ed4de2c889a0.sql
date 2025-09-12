-- 🚨 フェーズ1修正版: personasテーブルとビューアクセス制御

-- 1. personasテーブルの機密データアクセス制御強化
CREATE OR REPLACE FUNCTION public.get_persona_tokens_secure(persona_id_param uuid)
RETURNS TABLE(
  threads_access_token text,
  threads_app_secret text, 
  webhook_verify_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- ユーザー認証必須
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- ペルソナの所有者チェック
  IF NOT EXISTS (
    SELECT 1 FROM personas 
    WHERE id = persona_id_param 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not your persona';
  END IF;
  
  -- セキュリティログ記録
  INSERT INTO security_events (
    event_type, user_id, details
  ) VALUES (
    'sensitive_token_access',
    auth.uid(),
    jsonb_build_object('persona_id', persona_id_param)
  );
  
  RETURN QUERY
  SELECT 
    p.threads_access_token,
    p.threads_app_secret,
    p.webhook_verify_token
  FROM personas p
  WHERE p.id = persona_id_param 
  AND p.user_id = auth.uid();
END;
$$;

-- 2. ビューアクセス制御のSecurity Definer関数群
CREATE OR REPLACE FUNCTION public.get_cron_status_admin()
RETURNS TABLE(
  jobid bigint,
  jobname text,
  schedule text,
  active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- 管理者のみアクセス可能
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  -- セキュリティログ記録
  INSERT INTO security_events (
    event_type, user_id, details
  ) VALUES (
    'admin_cron_access',
    auth.uid(),
    jsonb_build_object('timestamp', now())
  );
  
  RETURN QUERY
  SELECT * FROM public.cron_job_status;
END;
$$;

-- 3. フィルタリングされたアクティビティログアクセス制御
CREATE OR REPLACE FUNCTION public.get_filtered_activity_logs_secure(target_user_id uuid DEFAULT NULL)
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
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- ユーザー認証必須
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- 管理者または自分のログのみ
  IF NOT (is_admin(auth.uid()) OR target_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions';
  END IF;
  
  RETURN QUERY
  SELECT * FROM public.filtered_activity_logs
  WHERE (target_user_id IS NULL AND is_admin(auth.uid())) 
     OR (filtered_activity_logs.user_id = COALESCE(target_user_id, auth.uid()));
END;
$$;

-- 4. トークン暴露検出トリガー
CREATE OR REPLACE FUNCTION public.detect_token_exposure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- トークンが設定された場合のセキュリティログ
  IF (NEW.threads_access_token IS NOT NULL AND NEW.threads_access_token != OLD.threads_access_token) OR
     (NEW.threads_app_secret IS NOT NULL AND NEW.threads_app_secret != OLD.threads_app_secret) OR
     (NEW.webhook_verify_token IS NOT NULL AND NEW.webhook_verify_token != OLD.webhook_verify_token) THEN
    
    INSERT INTO security_events (
      event_type, user_id, details
    ) VALUES (
      'sensitive_token_updated',
      auth.uid(),
      jsonb_build_object(
        'persona_id', NEW.id,
        'updated_fields', ARRAY[
          CASE WHEN NEW.threads_access_token IS NOT NULL THEN 'threads_access_token' END,
          CASE WHEN NEW.threads_app_secret IS NOT NULL THEN 'threads_app_secret' END,
          CASE WHEN NEW.webhook_verify_token IS NOT NULL THEN 'webhook_verify_token' END
        ]
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- トリガー作成
DROP TRIGGER IF EXISTS personas_token_exposure_trigger ON public.personas;
CREATE TRIGGER personas_token_exposure_trigger
  AFTER UPDATE ON public.personas
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_token_exposure();