-- 段階的に外部キー制約を追加（既存のものはスキップ）

-- personas テーブルに外部キー制約があるかチェックして追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'personas_user_id_fkey' 
    AND table_name = 'personas'
  ) THEN
    ALTER TABLE public.personas 
    ADD CONSTRAINT personas_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added foreign key constraint to personas table';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists for personas table';
  END IF;
END $$;

-- user_account_status テーブル
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_account_status_user_id_fkey' 
    AND table_name = 'user_account_status'
  ) THEN
    ALTER TABLE public.user_account_status 
    ADD CONSTRAINT user_account_status_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added foreign key constraint to user_account_status table';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists for user_account_status table';
  END IF;
END $$;

-- posts テーブル
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'posts_user_id_fkey' 
    AND table_name = 'posts'
  ) THEN
    ALTER TABLE public.posts 
    ADD CONSTRAINT posts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added foreign key constraint to posts table';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists for posts table';
  END IF;
END $$;