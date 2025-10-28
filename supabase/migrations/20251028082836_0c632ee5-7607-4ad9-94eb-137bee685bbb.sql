-- テンプレート文章ランダムポスト機能を複数の「箱」システムに変更

-- 新しいテーブル: template_post_boxes（各ペルソナごとに複数の箱を作成可能）
CREATE TABLE IF NOT EXISTS public.template_post_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  persona_id uuid NOT NULL,
  box_name text NOT NULL,
  templates jsonb NOT NULL DEFAULT '[]'::jsonb,
  random_times time[] NOT NULL DEFAULT '{}'::time[],
  is_active boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'Asia/Tokyo',
  next_run_at timestamptz,
  last_posted_date date,
  posted_times_today jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLSポリシーを設定
ALTER TABLE public.template_post_boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own template post boxes"
  ON public.template_post_boxes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own template post boxes"
  ON public.template_post_boxes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own template post boxes"
  ON public.template_post_boxes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own template post boxes"
  ON public.template_post_boxes
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all template post boxes"
  ON public.template_post_boxes
  FOR SELECT
  USING (is_admin(auth.uid()));

-- 既存のtemplate_random_post_configsデータを新しいテーブルに移行
INSERT INTO public.template_post_boxes (
  user_id,
  persona_id,
  box_name,
  templates,
  random_times,
  is_active,
  timezone,
  next_run_at,
  last_posted_date,
  posted_times_today,
  created_at,
  updated_at
)
SELECT 
  user_id,
  persona_id,
  'デフォルト' as box_name,
  templates,
  random_times,
  is_active,
  timezone,
  next_run_at,
  last_posted_date,
  posted_times_today,
  created_at,
  updated_at
FROM public.template_random_post_configs;

-- インデックスを作成してパフォーマンスを向上
CREATE INDEX idx_template_post_boxes_persona_id ON public.template_post_boxes(persona_id);
CREATE INDEX idx_template_post_boxes_user_id ON public.template_post_boxes(user_id);
CREATE INDEX idx_template_post_boxes_is_active ON public.template_post_boxes(is_active) WHERE is_active = true;
CREATE INDEX idx_template_post_boxes_next_run_at ON public.template_post_boxes(next_run_at) WHERE next_run_at IS NOT NULL;

-- 古いテーブルを削除（マイグレーション完了後）
DROP TABLE IF EXISTS public.template_random_post_configs;

-- マイグレーションログを記録
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'template_post_boxes_migration',
  jsonb_build_object(
    'action', 'Migrated template_random_post_configs to template_post_boxes with multiple boxes per persona',
    'timestamp', now()
  )
);