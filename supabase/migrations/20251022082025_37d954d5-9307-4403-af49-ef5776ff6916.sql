-- ペルソナのレート制限状態を追跡するカラムを追加
ALTER TABLE personas
ADD COLUMN IF NOT EXISTS is_rate_limited BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rate_limit_detected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rate_limit_reason TEXT,
ADD COLUMN IF NOT EXISTS rate_limit_until TIMESTAMP WITH TIME ZONE;

-- レート制限中のペルソナを効率的に取得するためのインデックス
CREATE INDEX IF NOT EXISTS idx_personas_rate_limited
ON personas(is_rate_limited)
WHERE is_rate_limited = true;

COMMENT ON COLUMN personas.is_rate_limited IS 'スパム検出や大量投稿により一時的に制限されているかどうか';
COMMENT ON COLUMN personas.rate_limit_detected_at IS 'レート制限が検出された日時';
COMMENT ON COLUMN personas.rate_limit_reason IS 'レート制限の理由（エラーメッセージ）';
COMMENT ON COLUMN personas.rate_limit_until IS '制限解除予定時刻（推定）';