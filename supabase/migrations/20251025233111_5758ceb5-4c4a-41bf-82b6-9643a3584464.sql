-- 既存のすべての設定を日本標準時に統一
UPDATE scheduling_settings 
SET timezone = 'Asia/Tokyo' 
WHERE timezone IS NULL OR timezone != 'Asia/Tokyo';

UPDATE auto_post_configs 
SET timezone = 'Asia/Tokyo' 
WHERE timezone IS NULL OR timezone != 'Asia/Tokyo';

UPDATE random_post_configs 
SET timezone = 'Asia/Tokyo' 
WHERE timezone IS NULL OR timezone != 'Asia/Tokyo';

UPDATE template_random_post_configs 
SET timezone = 'Asia/Tokyo' 
WHERE timezone IS NULL OR timezone != 'Asia/Tokyo';

-- 今後のデフォルト値を日本標準時に設定
ALTER TABLE scheduling_settings 
ALTER COLUMN timezone SET DEFAULT 'Asia/Tokyo';

ALTER TABLE auto_post_configs 
ALTER COLUMN timezone SET DEFAULT 'Asia/Tokyo';

ALTER TABLE random_post_configs 
ALTER COLUMN timezone SET DEFAULT 'Asia/Tokyo';

ALTER TABLE template_random_post_configs 
ALTER COLUMN timezone SET DEFAULT 'Asia/Tokyo';