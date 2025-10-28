-- 1. テンプレート画像構造の移行（image_url → image_urls配列）
UPDATE template_post_boxes
SET templates = COALESCE(
  (
    SELECT jsonb_agg(
      CASE 
        WHEN template->>'image_url' IS NOT NULL AND template->>'image_url' != '' 
        THEN template - 'image_url' || jsonb_build_object('image_urls', jsonb_build_array(template->>'image_url'))
        WHEN template->'image_urls' IS NULL
        THEN template || jsonb_build_object('image_urls', '[]'::jsonb)
        ELSE template
      END
    )
    FROM jsonb_array_elements(templates) AS template
  ),
  '[]'::jsonb
)
WHERE templates::text LIKE '%"image_url"%' OR templates::text NOT LIKE '%"image_urls"%';

-- 2. scheduled_forがNULLの手動投稿に現在時刻を設定
UPDATE posts
SET scheduled_for = created_at
WHERE auto_schedule = false 
  AND scheduled_for IS NULL
  AND status IN ('scheduled', 'failed');