
-- セキュリティ強化のためのSQL修正（修正版）

-- 1. cron_job_status はビューなのでRLS設定をスキップ
-- （ビューは基になるテーブルのRLSポリシーを継承します）

-- 2. security_events テーブルのINSERTポリシーを強化
DROP POLICY IF EXISTS "System can insert security events" ON public.security_events;

-- より厳格なINSERTポリシーを作成
CREATE POLICY "Authenticated users can insert security events" 
ON public.security_events FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL OR 
  current_setting('role') = 'service_role'
);

-- 3. user_account_status テーブルに重複防止制約を追加（既存の場合は無視）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_user_account_status'
  ) THEN
    ALTER TABLE public.user_account_status 
    ADD CONSTRAINT unique_user_account_status UNIQUE (user_id);
  END IF;
END $$;

-- 4. ブルートフォース攻撃対策のためのセキュリティ関数を作成
CREATE OR REPLACE FUNCTION public.check_login_attempts(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 5. セキュリティイベントログ関数の作成
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_user_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 6. パスワード要件チェック関数
CREATE OR REPLACE FUNCTION public.validate_password_strength(password text)
RETURNS jsonb
LANGUAGE plpgsql
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
