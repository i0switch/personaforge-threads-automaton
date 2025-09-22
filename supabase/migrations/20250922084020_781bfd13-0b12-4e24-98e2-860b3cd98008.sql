-- 安全な外部キー制約追加（データ削除は一切行いません）
-- すべてのデータが有効なユーザーに紐付いていることを確認済み

-- personas テーブルに外部キー制約追加（CASCADE削除で将来の整合性を保つ）
ALTER TABLE public.personas 
ADD CONSTRAINT personas_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- profiles テーブルに外部キー制約追加（CASCADE削除で将来の整合性を保つ）  
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- user_account_status テーブルに外部キー制約追加（CASCADE削除で将来の整合性を保つ）
ALTER TABLE public.user_account_status 
ADD CONSTRAINT user_account_status_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 確認メッセージ
DO $$
BEGIN
  RAISE NOTICE '✅ 外部キー制約を安全に追加しました。既存データは一切削除していません。';
END $$;