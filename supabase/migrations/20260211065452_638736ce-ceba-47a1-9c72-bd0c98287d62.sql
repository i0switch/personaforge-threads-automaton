
-- トークンの有効期限を追跡するカラムを追加
ALTER TABLE public.personas 
ADD COLUMN IF NOT EXISTS token_expires_at timestamp with time zone DEFAULT NULL;

-- トークン更新日時を追跡するカラムを追加
ALTER TABLE public.personas
ADD COLUMN IF NOT EXISTS token_refreshed_at timestamp with time zone DEFAULT NULL;
