-- ランダムポスト設定ペルソナの間違った投稿予定を削除
DELETE FROM posts
WHERE persona_id = 'cfbc66af-29ff-4e20-b1c9-bedaad22b662' -- ありさ　億稼ぐ女社長
  AND scheduled_for > now()
  AND status = 'scheduled'
  AND published_at IS NULL;