-- 緊急対応: 外部キー制約の復旧
-- データ整合性チェックと制約の再作成

-- 1. posts.persona_id 外部キー制約の復旧
ALTER TABLE public.posts 
ADD CONSTRAINT fk_posts_persona_id 
FOREIGN KEY (persona_id) REFERENCES public.personas(id) 
ON DELETE CASCADE;

-- 2. posts.user_id 外部キー制約の復旧  
ALTER TABLE public.posts 
ADD CONSTRAINT fk_posts_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 3. auto_post_configs.persona_id 外部キー制約の復旧
ALTER TABLE public.auto_post_configs 
ADD CONSTRAINT fk_auto_post_configs_persona_id 
FOREIGN KEY (persona_id) REFERENCES public.personas(id) 
ON DELETE CASCADE;

-- 4. auto_post_configs.user_id 外部キー制約の復旧
ALTER TABLE public.auto_post_configs 
ADD CONSTRAINT fk_auto_post_configs_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 5. random_post_configs.persona_id 外部キー制約の復旧
ALTER TABLE public.random_post_configs 
ADD CONSTRAINT fk_random_post_configs_persona_id 
FOREIGN KEY (persona_id) REFERENCES public.personas(id) 
ON DELETE CASCADE;

-- 6. random_post_configs.user_id 外部キー制約の復旧
ALTER TABLE public.random_post_configs 
ADD CONSTRAINT fk_random_post_configs_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 7. post_queue.post_id 外部キー制約の復旧
ALTER TABLE public.post_queue 
ADD CONSTRAINT fk_post_queue_post_id 
FOREIGN KEY (post_id) REFERENCES public.posts(id) 
ON DELETE CASCADE;

-- 8. post_queue.user_id 外部キー制約の復旧
ALTER TABLE public.post_queue 
ADD CONSTRAINT fk_post_queue_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 9. activity_logs.user_id 外部キー制約の復旧
ALTER TABLE public.activity_logs 
ADD CONSTRAINT fk_activity_logs_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 10. activity_logs.persona_id 外部キー制約の復旧  
ALTER TABLE public.activity_logs 
ADD CONSTRAINT fk_activity_logs_persona_id 
FOREIGN KEY (persona_id) REFERENCES public.personas(id) 
ON DELETE SET NULL;

-- セキュリティログ記録
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'emergency_foreign_key_restoration',
  jsonb_build_object(
    'restored_constraints', ARRAY[
      'fk_posts_persona_id',
      'fk_posts_user_id', 
      'fk_auto_post_configs_persona_id',
      'fk_auto_post_configs_user_id',
      'fk_random_post_configs_persona_id', 
      'fk_random_post_configs_user_id',
      'fk_post_queue_post_id',
      'fk_post_queue_user_id',
      'fk_activity_logs_user_id',
      'fk_activity_logs_persona_id'
    ],
    'restoration_timestamp', now(),
    'reason', 'Emergency response to auto-post-generator 500 errors'
  )
);