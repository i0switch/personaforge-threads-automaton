-- データ整合性チェック：auth.usersに存在しないuser_idがないか確認
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  -- personas テーブルの孤立データチェック
  SELECT COUNT(*) INTO orphaned_count
  FROM personas p
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);
  
  IF orphaned_count > 0 THEN
    RAISE NOTICE 'Found % orphaned personas records', orphaned_count;
  END IF;

  -- profiles テーブルの孤立データチェック
  SELECT COUNT(*) INTO orphaned_count
  FROM profiles p
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);
  
  IF orphaned_count > 0 THEN
    RAISE NOTICE 'Found % orphaned profiles records', orphaned_count;
  END IF;

  -- user_account_status テーブルの孤立データチェック
  SELECT COUNT(*) INTO orphaned_count
  FROM user_account_status uas
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = uas.user_id);
  
  IF orphaned_count > 0 THEN
    RAISE NOTICE 'Found % orphaned user_account_status records', orphaned_count;
  END IF;

END $$;

-- 最も重要なテーブルから外部キー制約を追加
-- personas テーブルに外部キー制約追加（CASCADE削除）
ALTER TABLE public.personas 
ADD CONSTRAINT personas_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- profiles テーブルに外部キー制約追加（CASCADE削除）  
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- user_account_status テーブルに外部キー制約追加（CASCADE削除）
ALTER TABLE public.user_account_status 
ADD CONSTRAINT user_account_status_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;