-- user_account_statusテーブルにpark_user_linkカラムを追加
ALTER TABLE public.user_account_status 
ADD COLUMN park_user_link TEXT;