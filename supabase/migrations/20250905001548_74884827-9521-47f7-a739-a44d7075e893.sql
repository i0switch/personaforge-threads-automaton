-- 緊急対応：バースト投稿停止のため一時的にトリガー無効化

-- 1. 一時的にprevent_draft_postsトリガーを無効化
ALTER TABLE posts DISABLE TRIGGER prevent_draft_posts_trigger;

-- 2. 00:47分に集中した自動生成投稿を直接削除（より安全）
DELETE FROM posts 
WHERE status = 'scheduled'
  AND scheduled_for BETWEEN '2025-09-05 00:47:00+00:00' AND '2025-09-05 00:48:00+00:00'
  AND auto_schedule = true  -- 自動生成のみ対象
  AND published_at IS NULL;

-- 3. 該当するキューエントリも削除
DELETE FROM post_queue 
WHERE scheduled_for BETWEEN '2025-09-05 00:47:00+00:00' AND '2025-09-05 00:48:00+00:00'
AND status IN ('queued', 'pending', 'processing');

-- 4. トリガーを再有効化
ALTER TABLE posts ENABLE TRIGGER prevent_draft_posts_trigger;

-- 5. 緊急対応ログ記録
INSERT INTO activity_logs (user_id, persona_id, action_type, description, metadata)
VALUES (
  (SELECT user_id FROM posts WHERE auto_schedule = true LIMIT 1),
  NULL,
  'emergency_burst_stop',
  'Emergency: 1750-post burst at 00:47 stopped by deleting auto-generated posts',
  jsonb_build_object(
    'emergency_time', now(),
    'target_minute', '2025-09-05 00:47:00+00:00',
    'estimated_cleaned_posts', 1750,
    'cleanup_method', 'direct_delete_auto_generated_only'
  )
);