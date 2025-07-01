
-- user_account_statusテーブルにペルソナ上限フィールドを追加
ALTER TABLE public.user_account_status 
ADD COLUMN persona_limit INTEGER NOT NULL DEFAULT 1;

-- 既存のレコードにもデフォルト値を設定（念のため）
UPDATE public.user_account_status 
SET persona_limit = 1 
WHERE persona_limit IS NULL;

-- ペルソナ上限をチェックする関数を作成
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
  RIGHT JOIN public.user_account_status uas ON uas.user_id = user_id_param
  WHERE p.user_id = user_id_param OR p.user_id IS NULL
  GROUP BY uas.persona_limit;
END;
$$;
