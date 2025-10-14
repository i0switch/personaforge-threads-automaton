-- Phase 2 Step 3: API Credentials Protection
-- 既存機能を破壊せず、暗号化保護された認証情報テーブルを追加

-- 1. 暗号化されたAPI認証情報テーブル作成
CREATE TABLE IF NOT EXISTS public.api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  credential_type text NOT NULL CHECK (credential_type IN ('threads_access_token', 'threads_app_secret', 'webhook_verify_token')),
  encrypted_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE(persona_id, credential_type)
);

-- RLS有効化
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の認証情報のみ閲覧・管理可能
CREATE POLICY "Users can view their own API credentials"
  ON public.api_credentials
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API credentials"
  ON public.api_credentials
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API credentials"
  ON public.api_credentials
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API credentials"
  ON public.api_credentials
  FOR DELETE
  USING (auth.uid() = user_id);

-- 管理者は全ての認証情報を閲覧可能（監査用）
CREATE POLICY "Admins can view all API credentials"
  ON public.api_credentials
  FOR SELECT
  USING (is_admin(auth.uid()));

-- 2. 更新時刻を自動更新するトリガー
CREATE TRIGGER update_api_credentials_updated_at
  BEFORE UPDATE ON public.api_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. 安全な認証情報取得関数
CREATE OR REPLACE FUNCTION get_persona_credential(
  p_persona_id uuid,
  p_credential_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted_value text;
  v_user_id uuid;
  v_fallback_value text;
BEGIN
  -- ユーザー認証チェック
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- ペルソナの所有者確認
  SELECT user_id INTO v_user_id
  FROM personas
  WHERE id = p_persona_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Persona not found';
  END IF;
  
  IF v_user_id != auth.uid() AND NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- 新方式: api_credentialsテーブルから取得を試みる
  SELECT encrypted_value INTO v_encrypted_value
  FROM api_credentials
  WHERE persona_id = p_persona_id
    AND credential_type = p_credential_type;
  
  IF v_encrypted_value IS NOT NULL THEN
    -- 使用時刻を更新
    UPDATE api_credentials
    SET last_used_at = now()
    WHERE persona_id = p_persona_id
      AND credential_type = p_credential_type;
    
    -- セキュリティログ記録
    INSERT INTO security_events (event_type, user_id, details)
    VALUES (
      'credential_accessed',
      auth.uid(),
      jsonb_build_object(
        'persona_id', p_persona_id,
        'credential_type', p_credential_type,
        'method', 'api_credentials_table'
      )
    );
    
    RETURN v_encrypted_value;
  END IF;
  
  -- フォールバック: 既存のpersonasテーブルから取得（後方互換性）
  CASE p_credential_type
    WHEN 'threads_access_token' THEN
      SELECT threads_access_token INTO v_fallback_value
      FROM personas WHERE id = p_persona_id;
    WHEN 'threads_app_secret' THEN
      SELECT threads_app_secret INTO v_fallback_value
      FROM personas WHERE id = p_persona_id;
    WHEN 'webhook_verify_token' THEN
      SELECT webhook_verify_token INTO v_fallback_value
      FROM personas WHERE id = p_persona_id;
  END CASE;
  
  IF v_fallback_value IS NOT NULL THEN
    -- セキュリティログ記録
    INSERT INTO security_events (event_type, user_id, details)
    VALUES (
      'credential_accessed',
      auth.uid(),
      jsonb_build_object(
        'persona_id', p_persona_id,
        'credential_type', p_credential_type,
        'method', 'legacy_personas_table'
      )
    );
  END IF;
  
  RETURN v_fallback_value;
END;
$$;

-- 4. セキュリティイベントログ記録
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'phase_2_api_credentials_protection',
  jsonb_build_object(
    'step', 'completed',
    'features', ARRAY[
      'api_credentials_table_created',
      'rls_policies_added',
      'secure_credential_function_added',
      'backward_compatibility_maintained'
    ],
    'backward_compatibility', jsonb_build_object(
      'existing_personas', 'continue_working',
      'fallback_method', 'legacy_personas_table',
      'new_personas', 'use_api_credentials_table'
    ),
    'timestamp', now()
  )
);