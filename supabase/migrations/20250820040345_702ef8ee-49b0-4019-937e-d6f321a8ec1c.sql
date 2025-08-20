-- 1. cron_job_statusテーブルのRLSを有効化し、管理者のみアクセス可能なポリシーを作成
ALTER TABLE public.cron_job_status ENABLE ROW LEVEL SECURITY;

-- 管理者のみがcron_job_statusを閲覧できるポリシーを作成
CREATE POLICY "Admins can view cron job status" 
ON public.cron_job_status 
FOR SELECT 
USING (is_admin(auth.uid()));

-- 2. データベース関数のsearch_pathを設定（セキュリティ強化）
-- 既存の関数を更新してsearch_pathを設定
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  -- プロフィール作成
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  
  -- アカウント状態作成
  INSERT INTO public.user_account_status (user_id, is_active, is_approved)
  VALUES (NEW.id, false, false);
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_account_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.user_account_status (user_id, is_active, is_approved)
  VALUES (NEW.id, false, false);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_security_event(p_event_type text, p_user_id uuid DEFAULT NULL::uuid, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_details jsonb DEFAULT NULL::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO security_events (
    event_type,
    user_id,
    ip_address,
    user_agent,
    details
  ) VALUES (
    p_event_type,
    p_user_id,
    p_ip_address,
    p_user_agent,
    p_details
  );
EXCEPTION
  WHEN OTHERS THEN
    -- セキュリティログの失敗は他の処理をブロックしない
    NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_login_attempts(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  recent_failures integer;
BEGIN
  -- 過去15分間の失敗回数をカウント
  SELECT COUNT(*) INTO recent_failures
  FROM security_events
  WHERE event_type = 'login_failed'
    AND details->>'email' = user_email
    AND created_at > now() - interval '15 minutes';
  
  -- 5回以上の失敗でブロック
  RETURN recent_failures < 5;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_password_strength(password text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  result jsonb := '{"valid": true, "errors": []}'::jsonb;
  errors text[] := '{}';
BEGIN
  -- 長さチェック
  IF length(password) < 8 THEN
    errors := array_append(errors, 'パスワードは8文字以上である必要があります');
  END IF;
  
  -- 大文字チェック
  IF password !~ '[A-Z]' THEN
    errors := array_append(errors, '大文字を含む必要があります');
  END IF;
  
  -- 小文字チェック
  IF password !~ '[a-z]' THEN
    errors := array_append(errors, '小文字を含む必要があります');
  END IF;
  
  -- 数字チェック
  IF password !~ '[0-9]' THEN
    errors := array_append(errors, '数字を含む必要があります');
  END IF;
  
  -- 特殊文字チェック
  IF password !~ '[!@#$%^&*(),.?":{}|<>]' THEN
    errors := array_append(errors, '特殊文字を含む必要があります');
  END IF;
  
  -- 結果を構築
  IF array_length(errors, 1) > 0 THEN
    result := jsonb_build_object(
      'valid', false,
      'errors', to_jsonb(errors)
    );
  END IF;
  
  RETURN result;
END;
$$;