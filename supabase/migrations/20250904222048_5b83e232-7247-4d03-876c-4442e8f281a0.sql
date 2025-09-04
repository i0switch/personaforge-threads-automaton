-- 緊急修正: flwvw82796@yahoo.co.jpユーザーの自動生成投稿を適切にスケジュール設定
WITH user_posts AS (
  SELECT 
    p.id,
    p.persona_id,
    p.created_at,
    ROW_NUMBER() OVER (PARTITION BY p.persona_id ORDER BY p.created_at) as post_order
  FROM posts p
  JOIN auth.users u ON p.user_id = u.id
  WHERE u.email = 'flwvw82796@yahoo.co.jp'
    AND p.status = 'draft'
    AND p.scheduled_for IS NULL
    AND p.auto_schedule = true
),
schedule_times AS (
  SELECT 
    up.id,
    up.persona_id,
    -- 今から1時間後を基準に、投稿順序に基づいて24時間間隔でスケジュール
    (NOW() + INTERVAL '1 hour' + (up.post_order - 1) * INTERVAL '24 hours')::timestamptz as new_scheduled_time
  FROM user_posts up
)
UPDATE posts 
SET 
  status = 'scheduled',
  scheduled_for = st.new_scheduled_time,
  updated_at = NOW()
FROM schedule_times st
WHERE posts.id = st.id;