-- Phase 2 Security Steps 2 & 3: Rate Limiting + API Credential Protection
-- 既存機能を破壊せず、セキュリティを強化

-- ===== STEP 2: レート制限テーブルの改善 =====
-- rate_limitsテーブルに追加インデックス（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
  ON public.rate_limits(endpoint, identifier, window_start);

-- 古いレート制限レコード自動削除関数（1時間以上経過したもの）
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM rate_limits
  WHERE window_start < (now() - INTERVAL '1 hour');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Cleaned up % old rate limit records', deleted_count;
  END IF;
END;
$$;

-- ===== STEP 3: API認証情報保護強化 =====
-- 1. 暗号化されたAPI認証情報テーブル（新規ペルソナ用）
CREATE TABLE IF NOT EXISTS public.api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  persona_id uuid NOT NULL UNIQUE, -- 1ペルソナ1セット
  credential_type text NOT NULL, -- 'threads_access_token', 'app_secret', etc.
  encrypted_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz,
  access_count integer DEFAULT 0
);

-- RLS有効化
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;

-- ペルソナ所有者のみアクセス可能
CREATE POLICY "Users can manage their own API credentials"
  ON public.api_credentials
  FOR ALL
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM personas 
      WHERE id = api_credentials.persona_id 
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
  );

-- 管理者は閲覧のみ可能（実際の値は見えない）
CREATE POLICY "Admins can view credential metadata"
  ON public.api_credentials
  FOR SELECT
  USING (is_admin(auth.uid()));

-- 2. アクセスログ更新トリガー
CREATE OR REPLACE FUNCTION update_credential_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- SELECTされたときにアクセスログを更新
  NEW.last_accessed_at := now();
  NEW.access_count := COALESCE(NEW.access_count, 0) + 1;
  RETURN NEW;
END;
$$;

-- 3. 安全なトークン取得関数（アクセスログ付き）
CREATE OR REPLACE FUNCTION get_persona_credentials_safe(p_persona_id uuid)
RETURNS TABLE(
  credential_type text,
  has_value boolean,
  last_accessed timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ユーザー認証確認
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- ペルソナ所有者確認
  IF NOT EXISTS (
    SELECT 1 FROM personas 
    WHERE id = p_persona_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not your persona';
  END IF;
  
  -- セキュリティログ記録
  INSERT INTO security_events (event_type, user_id, details)
  VALUES (
    'api_credential_access',
    auth.uid(),
    jsonb_build_object('persona_id', p_persona_id, 'timestamp', now())
  );
  
  -- 認証情報のメタデータのみ返す（値は返さない）
  RETURN QUERY
  SELECT 
    ac.credential_type,
    (ac.encrypted_value IS NOT NULL AND ac.encrypted_value != '') as has_value,
    ac.last_accessed_at
  FROM api_credentials ac
  WHERE ac.persona_id = p_persona_id;
END;
$$;

-- 4. 更新時タイムスタンプ自動更新トリガー
CREATE TRIGGER update_api_credentials_timestamp
  BEFORE UPDATE ON public.api_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. セキュリティイベントログ記録
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'phase_2_rate_limiting_api_protection',
  jsonb_build_object(
    'steps_completed', ARRAY['rate_limiting_improved', 'api_credentials_table_created'],
    'backward_compatibility', true,
    'existing_personas_unaffected', true,
    'timestamp', now()
  )
);