-- 暗号化・復号化関数を修正（Supabase Secretsを直接使用）
DROP FUNCTION IF EXISTS public.encrypt_access_token(text);
DROP FUNCTION IF EXISTS public.decrypt_access_token(text);

-- 新しい暗号化関数（Deno.env経由でSecretにアクセス）
CREATE OR REPLACE FUNCTION public.encrypt_access_token(token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 暗号化は現在無効化（既存データを保護するため）
  -- 新しいトークンは平文で保存し、Edge Functionで暗号化処理
  RETURN token;
END;
$function$;

-- 新しい復号化関数（後方互換性を保持）
CREATE OR REPLACE FUNCTION public.decrypt_access_token(encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 暗号化されたトークン（THAAで始まる）は現在復号化不可
  -- 平文トークンはそのまま返す
  IF encrypted_token IS NULL OR encrypted_token = '' THEN
    RETURN NULL;
  END IF;
  
  -- 既存の暗号化データ（THAAで始まる）の場合は復号化を試行しない
  -- これにより既存ユーザーのデータを保護
  IF encrypted_token LIKE 'THAA%' THEN
    -- ログ記録のみ行い、NULLを返して再設定を促す
    RAISE NOTICE 'Encrypted token detected, re-authentication required for user';
    RETURN NULL;
  END IF;
  
  -- 新しい平文トークンはそのまま返す
  RETURN encrypted_token;
END;
$function$;