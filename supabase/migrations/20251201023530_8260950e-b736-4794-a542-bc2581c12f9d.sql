-- ============================================
-- 投稿失敗理由の詳細分類とメトリクス収集
-- ============================================

-- 1. postsテーブルに失敗理由カラムを追加
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS failure_reason TEXT,
ADD COLUMN IF NOT EXISTS failure_category TEXT;

COMMENT ON COLUMN posts.failure_reason IS '投稿失敗の詳細理由';
COMMENT ON COLUMN posts.failure_category IS '失敗カテゴリ: token_expired, rate_limited, api_error, network_error, etc.';

-- 2. 投稿成功率メトリクステーブルの作成
CREATE TABLE IF NOT EXISTS posting_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  attempts INTEGER DEFAULT 0,
  successes INTEGER DEFAULT 0,
  failures INTEGER DEFAULT 0,
  token_errors INTEGER DEFAULT 0,
  rate_limit_errors INTEGER DEFAULT 0,
  api_errors INTEGER DEFAULT 0,
  network_errors INTEGER DEFAULT 0,
  success_rate NUMERIC GENERATED ALWAYS AS (
    CASE WHEN attempts > 0 THEN (successes::numeric / attempts) * 100 ELSE 0 END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(persona_id, date)
);

COMMENT ON TABLE posting_metrics IS '投稿成功率とエラー統計の日次集計';

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_posting_metrics_persona_date ON posting_metrics(persona_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_posting_metrics_date ON posting_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_posts_failure_category ON posts(failure_category) WHERE failure_category IS NOT NULL;

-- RLSポリシー設定
ALTER TABLE posting_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own posting metrics"
  ON posting_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM personas 
      WHERE personas.id = posting_metrics.persona_id 
      AND personas.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all posting metrics"
  ON posting_metrics FOR SELECT
  USING (is_admin(auth.uid()));

-- メトリクス更新用のトリガー関数
CREATE OR REPLACE FUNCTION update_posting_metrics()
RETURNS TRIGGER AS $$
DECLARE
  metric_date DATE;
  error_category TEXT;
BEGIN
  -- 投稿日を取得（published_atまたはupdated_at）
  metric_date := COALESCE(NEW.published_at, NEW.updated_at)::DATE;
  
  -- 失敗カテゴリを決定
  error_category := CASE
    WHEN NEW.failure_category = 'token_expired' THEN 'token_errors'
    WHEN NEW.failure_category = 'rate_limited' THEN 'rate_limit_errors'
    WHEN NEW.failure_category = 'api_error' THEN 'api_errors'
    WHEN NEW.failure_category = 'network_error' THEN 'network_errors'
    ELSE NULL
  END;
  
  -- ステータスがpublishedに変わった場合（成功）
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
    INSERT INTO posting_metrics (persona_id, date, attempts, successes)
    VALUES (NEW.persona_id, metric_date, 1, 1)
    ON CONFLICT (persona_id, date) 
    DO UPDATE SET
      attempts = posting_metrics.attempts + 1,
      successes = posting_metrics.successes + 1,
      updated_at = NOW();
  
  -- ステータスがfailedに変わった場合（失敗）
  ELSIF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status != 'failed') THEN
    INSERT INTO posting_metrics (persona_id, date, attempts, failures, token_errors, rate_limit_errors, api_errors, network_errors)
    VALUES (
      NEW.persona_id, 
      metric_date, 
      1, 
      1,
      CASE WHEN error_category = 'token_errors' THEN 1 ELSE 0 END,
      CASE WHEN error_category = 'rate_limit_errors' THEN 1 ELSE 0 END,
      CASE WHEN error_category = 'api_errors' THEN 1 ELSE 0 END,
      CASE WHEN error_category = 'network_errors' THEN 1 ELSE 0 END
    )
    ON CONFLICT (persona_id, date) 
    DO UPDATE SET
      attempts = posting_metrics.attempts + 1,
      failures = posting_metrics.failures + 1,
      token_errors = posting_metrics.token_errors + CASE WHEN error_category = 'token_errors' THEN 1 ELSE 0 END,
      rate_limit_errors = posting_metrics.rate_limit_errors + CASE WHEN error_category = 'rate_limit_errors' THEN 1 ELSE 0 END,
      api_errors = posting_metrics.api_errors + CASE WHEN error_category = 'api_errors' THEN 1 ELSE 0 END,
      network_errors = posting_metrics.network_errors + CASE WHEN error_category = 'network_errors' THEN 1 ELSE 0 END,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- トリガーを作成
DROP TRIGGER IF EXISTS trigger_update_posting_metrics ON posts;
CREATE TRIGGER trigger_update_posting_metrics
  AFTER INSERT OR UPDATE OF status, failure_category ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_posting_metrics();

-- updated_atの自動更新トリガー
CREATE TRIGGER update_posting_metrics_updated_at
  BEFORE UPDATE ON posting_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();