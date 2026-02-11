
-- reply_check_settingsにユニーク制約を追加（upsertで使用）
-- 同じペルソナに対して重複設定を防止する根本対策
ALTER TABLE public.reply_check_settings 
ADD CONSTRAINT reply_check_settings_user_persona_unique UNIQUE (user_id, persona_id);
