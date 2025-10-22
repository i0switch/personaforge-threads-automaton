-- thread_repliesテーブルにai_response列を追加
-- この列でAI返信と定型文返信の両方を保存
ALTER TABLE thread_replies 
ADD COLUMN IF NOT EXISTS ai_response text;

-- 列の説明を追加
COMMENT ON COLUMN thread_replies.ai_response IS '生成されたAI返信または定型文返信のテキスト（遅延送信用）';