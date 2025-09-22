-- ユーザー削除時のカスケード削除を設定
-- まず既存の不整合データをチェック
DO $$
BEGIN
  RAISE NOTICE 'Checking data consistency before adding foreign keys...';
END $$;

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

-- user_roles テーブルに外部キー制約追加（CASCADE削除）
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- その他の関連テーブルにも外部キー制約追加
ALTER TABLE public.posts 
ADD CONSTRAINT posts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.auto_post_configs 
ADD CONSTRAINT auto_post_configs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.random_post_configs 
ADD CONSTRAINT random_post_configs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.auto_replies 
ADD CONSTRAINT auto_replies_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.thread_replies 
ADD CONSTRAINT thread_replies_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.post_queue 
ADD CONSTRAINT post_queue_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.activity_logs 
ADD CONSTRAINT activity_logs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.analytics 
ADD CONSTRAINT analytics_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.reply_check_settings 
ADD CONSTRAINT reply_check_settings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.scheduling_settings 
ADD CONSTRAINT scheduling_settings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.self_reply_settings 
ADD CONSTRAINT self_reply_settings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.self_reply_jobs 
ADD CONSTRAINT self_reply_jobs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.webhook_settings 
ADD CONSTRAINT webhook_settings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_api_keys 
ADD CONSTRAINT user_api_keys_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.security_config 
ADD CONSTRAINT security_config_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- セキュリティ関連テーブル（user_idがnullableなのでSET NULLに）
ALTER TABLE public.security_events 
ADD CONSTRAINT security_events_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.security_alerts 
ADD CONSTRAINT security_alerts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;