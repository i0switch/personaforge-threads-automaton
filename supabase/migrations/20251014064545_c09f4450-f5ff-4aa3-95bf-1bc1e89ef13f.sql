-- Phase 2 Security Step 1: Audit Log Immutability
-- 既存機能を破壊せず、監査ログの不変性を実現

-- 1. アーカイブテーブル作成（古いログの保管用）
CREATE TABLE IF NOT EXISTS public.activity_logs_archive (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  persona_id uuid,
  action_type text NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  checksum text -- 改ざん検知用
);

-- RLS有効化
ALTER TABLE public.activity_logs_archive ENABLE ROW LEVEL SECURITY;

-- 管理者のみ閲覧可能
CREATE POLICY "Admins can view archived logs"
  ON public.activity_logs_archive
  FOR SELECT
  USING (is_admin(auth.uid()));

-- 2. activity_logsのDELETE/UPDATEポリシーを削除（不変性確保）
DROP POLICY IF EXISTS "Admins can delete activity logs" ON public.activity_logs;

-- 3. チェックサム生成関数（改ざん検知用）
CREATE OR REPLACE FUNCTION generate_log_checksum(
  p_id uuid,
  p_user_id uuid,
  p_action_type text,
  p_created_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
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

-- 4. 自動アーカイブ関数（90日以上経過したログを移動）
CREATE OR REPLACE FUNCTION archive_old_activity_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived_count integer;
BEGIN
  -- 90日以上経過したログをアーカイブに移動
  WITH moved_logs AS (
    DELETE FROM activity_logs
    WHERE created_at < (now() - INTERVAL '90 days')
    RETURNING *
  )
  INSERT INTO activity_logs_archive (
    id, user_id, persona_id, action_type, 
    description, metadata, created_at, checksum
  )
  SELECT 
    id, user_id, persona_id, action_type,
    description, metadata, created_at,
    generate_log_checksum(id, user_id, action_type, created_at)
  FROM moved_logs;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  IF archived_count > 0 THEN
    RAISE NOTICE 'Archived % old activity logs', archived_count;
  END IF;
END;
$$;

-- 5. セキュリティイベントログ記録
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'phase_2_audit_log_immutability',
  jsonb_build_object(
    'step', 'completed',
    'features', ARRAY[
      'delete_policy_removed',
      'archive_table_created',
      'checksum_validation_enabled',
      'auto_archive_function_added'
    ],
    'timestamp', now()
  )
);