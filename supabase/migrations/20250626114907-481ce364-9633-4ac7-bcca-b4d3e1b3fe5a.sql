
-- personas テーブルに自動返信設定のカラムを追加
ALTER TABLE public.personas 
ADD COLUMN auto_reply_enabled boolean DEFAULT false,
ADD COLUMN ai_auto_reply_enabled boolean DEFAULT false;

-- reply_mode カラムを削除（もし存在する場合）
ALTER TABLE public.personas 
DROP COLUMN IF EXISTS reply_mode;
