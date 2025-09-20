-- 緊急修復: 外部キー制約の再作成（正しい名前で）
-- PGRST201エラーの解決

-- auto_post_configs テーブルの外部キー制約復旧
ALTER TABLE public.auto_post_configs 
ADD CONSTRAINT auto_post_configs_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES public.personas(id) 
ON DELETE CASCADE;

ALTER TABLE public.auto_post_configs 
ADD CONSTRAINT auto_post_configs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- random_post_configs テーブルの外部キー制約復旧 
ALTER TABLE public.random_post_configs 
ADD CONSTRAINT random_post_configs_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES public.personas(id) 
ON DELETE CASCADE;

-- セキュリティログ記録
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'emergency_constraint_restoration',
  jsonb_build_object(
    'restored_constraints', ARRAY[
      'auto_post_configs_persona_id_fkey',
      'auto_post_configs_user_id_fkey',
      'random_post_configs_persona_id_fkey'
    ],
    'reason', 'Fix PGRST201 errors in auto-post-generator',
    'timestamp', now()
  )
);