-- テンプレートランダムポスト設定テーブルの更新
-- templates カラムを jsonb に変更して、各テンプレートに画像URLを含められるようにする

-- 既存データを一時的に保存
CREATE TEMP TABLE temp_templates AS
SELECT id, templates
FROM template_random_post_configs
WHERE templates IS NOT NULL AND array_length(templates, 1) > 0;

-- templates カラムを text[] から jsonb に変更
ALTER TABLE template_random_post_configs
DROP COLUMN templates;

ALTER TABLE template_random_post_configs
ADD COLUMN templates jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 既存データを新しい形式に変換して戻す
UPDATE template_random_post_configs t
SET templates = (
  SELECT jsonb_agg(jsonb_build_object('text', elem, 'image_url', null))
  FROM temp_templates tmp
  CROSS JOIN LATERAL unnest(tmp.templates) AS elem
  WHERE tmp.id = t.id
)
WHERE EXISTS (
  SELECT 1 FROM temp_templates tmp WHERE tmp.id = t.id
);

-- 一時テーブルを削除
DROP TABLE temp_templates;