
-- 正確なユーザー統計を取得するRPC関数を作成
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS TABLE(
  total_users BIGINT, 
  approved_users BIGINT, 
  pending_users BIGINT, 
  active_subscriptions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(p.user_id) AS total_users,
    COUNT(uas.user_id) FILTER (WHERE uas.is_approved = true) AS approved_users,
    COUNT(p.user_id) - COUNT(uas.user_id) FILTER (WHERE uas.is_approved = true) AS pending_users,
    COUNT(uas.user_id) FILTER (WHERE uas.subscription_status IS NOT NULL AND uas.subscription_status <> 'free') AS active_subscriptions
  FROM public.profiles p
  LEFT JOIN public.user_account_status uas ON p.user_id = uas.user_id;
END;
$$ LANGUAGE plpgsql;

-- 既存のencryption_keyが設定されているか確認（設定されていない場合は設定が必要）
-- このキーはSupabase Secretsで管理されている前提
