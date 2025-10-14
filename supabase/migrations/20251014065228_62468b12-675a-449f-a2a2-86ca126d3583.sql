-- Phase 2 Step 1: Fix security warnings for newly added functions
-- 今回のマイグレーションで追加された関数のセキュリティ警告を修正

-- generate_log_checksum関数にsearch_pathを設定
CREATE OR REPLACE FUNCTION generate_log_checksum(
  p_id uuid,
  p_user_id uuid,
  p_action_type text,
  p_created_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN encode(
    digest(
      p_id::text || p_user_id::text || p_action_type || p_created_at::text,
      'sha256'
    ),
    'hex'
  );
END;
$$;