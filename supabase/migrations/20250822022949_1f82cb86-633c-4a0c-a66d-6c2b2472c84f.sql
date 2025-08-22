-- 既存の間違った投稿予定をクリーンアップして正しい時間で再設定
-- 1. 複数時間設定ペルソナの間違った投稿予定を削除
DELETE FROM post_queue 
WHERE post_id IN (
  SELECT posts.id 
  FROM posts 
  LEFT JOIN auto_post_configs apc ON posts.persona_id = apc.persona_id 
  WHERE apc.is_active = true 
    AND apc.multi_time_enabled = true
    AND posts.scheduled_for > now()
)
AND scheduled_for > now()
AND status IN ('queued', 'pending');

-- 2. postsテーブルの間違った投稿予定も削除
DELETE FROM posts
WHERE persona_id IN (
  SELECT persona_id 
  FROM auto_post_configs 
  WHERE is_active = true 
    AND multi_time_enabled = true
)
AND scheduled_for > now()
AND status = 'scheduled'
AND published_at IS NULL;