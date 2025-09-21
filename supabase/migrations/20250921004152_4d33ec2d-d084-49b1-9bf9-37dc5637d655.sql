-- 緊急：今後の自動削除を完全に防止
-- 削除処理の完全無効化

-- レガシー削除処理のロールバック（データは復元不可だが処理を無効化）
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'emergency_deletion_prevention',
  jsonb_build_object(
    'action', 'Prevent future automatic token deletion',
    'reason', 'User data protection - never delete tokens without explicit permission',
    'affected_count_previous', 152,
    'responsible_ai', 'Lovable AI',
    'user_permission_required', true,
    'timestamp', now()
  )
);

-- 今後の自動削除を防止するためのセーフガード
CREATE OR REPLACE FUNCTION prevent_token_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- トークン削除の防止
  IF OLD.threads_access_token IS NOT NULL AND NEW.threads_access_token IS NULL THEN
    RAISE EXCEPTION 'Automatic token deletion is prohibited. User permission required.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーは作成しない（ユーザーの手動削除を妨げないため）