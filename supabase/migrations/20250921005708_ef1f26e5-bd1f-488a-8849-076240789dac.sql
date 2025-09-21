-- 確実なPGRST201エラー解決：重複外部キー制約の完全除去

-- 重複制約を完全削除（順序重要：fkey系を先に削除）
ALTER TABLE public.auto_post_configs DROP CONSTRAINT IF EXISTS auto_post_configs_persona_id_fkey;
ALTER TABLE public.auto_post_configs DROP CONSTRAINT IF EXISTS auto_post_configs_user_id_fkey;
ALTER TABLE public.random_post_configs DROP CONSTRAINT IF EXISTS random_post_configs_persona_id_fkey;

-- 正しい一意制約のみ残す（fk_プレフィックス付きのもの）
-- これにより"personas!fk_random_post_configs_persona_id"が正確に動作する

-- 検証用：制約の確認
-- 最終的に各テーブルのpersona_idに対して1つずつの制約のみが存在すべき

-- セキュリティログ記録
INSERT INTO security_events (event_type, details)
VALUES (
  'final_pgrst201_fix',
  jsonb_build_object(
    'action', 'Removed duplicate foreign key constraints definitively',
    'removed_constraints', ARRAY[
      'auto_post_configs_persona_id_fkey',
      'auto_post_configs_user_id_fkey', 
      'random_post_configs_persona_id_fkey'
    ],
    'remaining_constraints', ARRAY[
      'fk_auto_post_configs_persona_id',
      'fk_auto_post_configs_user_id',
      'fk_random_post_configs_persona_id'
    ],
    'edge_function_fix', 'personas!fk_random_post_configs_persona_id now unambiguous',
    'timestamp', now()
  )
);