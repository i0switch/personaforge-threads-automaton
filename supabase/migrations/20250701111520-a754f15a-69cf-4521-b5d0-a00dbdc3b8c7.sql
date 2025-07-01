
-- 問題のユーザーIDの user_account_status レコードを確認
SELECT * FROM user_account_status WHERE user_id = '6f8aa09e-68bc-4f10-985a-087bde36d9ff';

-- 重複したレコードがある場合は、最新のもの以外を削除
DELETE FROM user_account_status 
WHERE user_id = '6f8aa09e-68bc-4f10-985a-087bde36d9ff' 
AND id NOT IN (
  SELECT id FROM user_account_status 
  WHERE user_id = '6f8aa09e-68bc-4f10-985a-087bde36d9ff' 
  ORDER BY updated_at DESC 
  LIMIT 1
);

-- check_persona_limit 関数を修正して、最新のレコードのみを使用するように変更
CREATE OR REPLACE FUNCTION public.check_persona_limit(user_id_param UUID)
RETURNS TABLE(
  current_count BIGINT,
  persona_limit INTEGER,
  can_create BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(p.id) as current_count,
    COALESCE(uas.persona_limit, 1) as persona_limit,
    (COUNT(p.id) < COALESCE(uas.persona_limit, 1)) as can_create
  FROM public.personas p
  RIGHT JOIN (
    SELECT DISTINCT ON (user_id) user_id, persona_limit
    FROM public.user_account_status 
    WHERE user_id = user_id_param
    ORDER BY user_id, updated_at DESC
  ) uas ON uas.user_id = user_id_param
  WHERE p.user_id = user_id_param OR p.user_id IS NULL
  GROUP BY uas.persona_limit;
END;
$$;

-- user_account_status テーブルに unique constraint を追加して今後の重複を防ぐ
ALTER TABLE user_account_status ADD CONSTRAINT unique_user_account_status UNIQUE (user_id);
