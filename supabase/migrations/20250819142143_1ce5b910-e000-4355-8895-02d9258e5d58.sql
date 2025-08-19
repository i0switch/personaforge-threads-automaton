-- ペルソナ削除時に関連データも削除されるよう外部キー制約を修正

-- 既存の外部キー制約を削除して、CASCADE付きで再作成
-- posts テーブル
DO $$
BEGIN
  -- 既存制約があれば削除
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%posts_persona_id%' 
             AND table_name = 'posts') THEN
    ALTER TABLE posts DROP CONSTRAINT posts_persona_id_fkey;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- postsテーブルにCASCADE付き外部キー制約を追加
ALTER TABLE posts 
ADD CONSTRAINT posts_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;

-- auto_post_configs テーブル
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%auto_post_configs_persona_id%' 
             AND table_name = 'auto_post_configs') THEN
    ALTER TABLE auto_post_configs DROP CONSTRAINT auto_post_configs_persona_id_fkey;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE auto_post_configs 
ADD CONSTRAINT auto_post_configs_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;

-- random_post_configs テーブル
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%random_post_configs_persona_id%' 
             AND table_name = 'random_post_configs') THEN
    ALTER TABLE random_post_configs DROP CONSTRAINT random_post_configs_persona_id_fkey;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE random_post_configs 
ADD CONSTRAINT random_post_configs_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;

-- auto_replies テーブル
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%auto_replies_persona_id%' 
             AND table_name = 'auto_replies') THEN
    ALTER TABLE auto_replies DROP CONSTRAINT auto_replies_persona_id_fkey;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE auto_replies 
ADD CONSTRAINT auto_replies_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;

-- 他の関連テーブルも同様に設定
-- post_queue テーブル
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%post_queue_persona_id%' 
             AND table_name = 'post_queue') THEN
    -- post_queueはpersona_idカラムがないため、postsとの関係で間接的に削除される
    NULL;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- thread_replies テーブル  
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%thread_replies_persona_id%' 
             AND table_name = 'thread_replies') THEN
    ALTER TABLE thread_replies DROP CONSTRAINT thread_replies_persona_id_fkey;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE thread_replies 
ADD CONSTRAINT thread_replies_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;

-- self_reply_jobs テーブル
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%self_reply_jobs_persona_id%' 
             AND table_name = 'self_reply_jobs') THEN
    ALTER TABLE self_reply_jobs DROP CONSTRAINT self_reply_jobs_persona_id_fkey;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE self_reply_jobs 
ADD CONSTRAINT self_reply_jobs_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;

-- scheduling_settings テーブル
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%scheduling_settings_persona_id%' 
             AND table_name = 'scheduling_settings') THEN
    ALTER TABLE scheduling_settings DROP CONSTRAINT scheduling_settings_persona_id_fkey;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE scheduling_settings 
ADD CONSTRAINT scheduling_settings_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;

-- self_reply_settings テーブル
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%self_reply_settings_persona_id%' 
             AND table_name = 'self_reply_settings') THEN
    ALTER TABLE self_reply_settings DROP CONSTRAINT self_reply_settings_persona_id_fkey;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE self_reply_settings 
ADD CONSTRAINT self_reply_settings_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;

-- webhook_settings テーブル  
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%webhook_settings_persona_id%' 
             AND table_name = 'webhook_settings') THEN
    ALTER TABLE webhook_settings DROP CONSTRAINT webhook_settings_persona_id_fkey;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE webhook_settings 
ADD CONSTRAINT webhook_settings_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;

-- reply_check_settings テーブル
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%reply_check_settings_persona_id%' 
             AND table_name = 'reply_check_settings') THEN
    ALTER TABLE reply_check_settings DROP CONSTRAINT reply_check_settings_persona_id_fkey;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE reply_check_settings 
ADD CONSTRAINT reply_check_settings_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;

-- analytics テーブル
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%analytics_persona_id%' 
             AND table_name = 'analytics') THEN
    ALTER TABLE analytics DROP CONSTRAINT analytics_persona_id_fkey;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE analytics 
ADD CONSTRAINT analytics_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;

-- activity_logs テーブル
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%activity_logs_persona_id%' 
             AND table_name = 'activity_logs') THEN
    ALTER TABLE activity_logs DROP CONSTRAINT activity_logs_persona_id_fkey;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE activity_logs 
ADD CONSTRAINT activity_logs_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE;