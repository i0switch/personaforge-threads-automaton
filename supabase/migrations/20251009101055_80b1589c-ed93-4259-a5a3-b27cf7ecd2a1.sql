
-- c32028im@gmail.com ユーザーのアカウントステータスを復元

-- 既存のuser_account_statusを確認して重複を防ぐ
DO $$
BEGIN
  -- user_account_statusが存在しない場合のみ挿入
  IF NOT EXISTS (
    SELECT 1 FROM user_account_status 
    WHERE user_id = 'cff63eb2-86bd-47fa-8d8e-831a4458a039'
  ) THEN
    INSERT INTO user_account_status (
      user_id,
      is_active,
      is_approved,
      persona_limit,
      subscription_status,
      created_at,
      updated_at
    ) VALUES (
      'cff63eb2-86bd-47fa-8d8e-831a4458a039',
      true,
      true,
      10, -- 既存ユーザーなので多めに設定
      'free',
      now(),
      now()
    );
    
    RAISE NOTICE '✅ ユーザーアカウントステータスを復元しました';
    RAISE NOTICE 'User ID: cff63eb2-86bd-47fa-8d8e-831a4458a039';
    RAISE NOTICE 'Email: c32028im@gmail.com';
    RAISE NOTICE 'Status: 承認済み・アクティブ';
    RAISE NOTICE 'Persona Limit: 10';
  ELSE
    RAISE NOTICE 'ℹ️ user_account_statusは既に存在します';
  END IF;
END $$;

-- セキュリティログに記録
INSERT INTO security_events (
  event_type,
  user_id,
  details
) VALUES (
  'admin_account_restored',
  'cff63eb2-86bd-47fa-8d8e-831a4458a039',
  jsonb_build_object(
    'email', 'c32028im@gmail.com',
    'restored_by', 'admin',
    'timestamp', now()
  )
);
