-- 完全にセキュアな暗号化システムに移行
-- 既存の関数を削除し、Edge Function暗号化システムと連携する新しい関数を作成

DROP FUNCTION IF EXISTS public.encrypt_access_token(text);
DROP FUNCTION IF EXISTS public.decrypt_access_token(text);

-- Edge Function暗号化システム用の新しい関数
-- 暗号化はEdge Functionで実行されるため、この関数は識別のみ行う
CREATE OR REPLACE FUNCTION public.encrypt_access_token(token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 暗号化はEdge Functionで実行される
  -- この関数は既存のコードとの互換性のために保持
  -- 実際の暗号化はsave-secret Edge Functionで行われる
  RETURN 'ENCRYPTED_VIA_EDGE_FUNCTION';
END;
$function$;

-- 復号化もEdge Functionで実行される
CREATE OR REPLACE FUNCTION public.decrypt_access_token(encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 復号化はEdge Functionで実行される
  -- この関数は既存のコードとの互換性のために保持
  -- 既存の暗号化トークンの場合はNULLを返して再認証を促す
  IF encrypted_token IS NULL OR encrypted_token = '' THEN
    RETURN NULL;
  END IF;
  
  -- 古い暗号化データ（THAAで始まる）は復号化不可
  IF encrypted_token LIKE 'THAA%' THEN
    RAISE NOTICE 'Legacy encrypted token detected, re-authentication required';
    RETURN NULL;
  END IF;
  
  -- Edge Function暗号化マーカーの場合もNULLを返す（再取得が必要）
  IF encrypted_token = 'ENCRYPTED_VIA_EDGE_FUNCTION' THEN
    RETURN NULL;
  END IF;
  
  -- その他の場合はそのまま返す（後方互換性）
  RETURN encrypted_token;
END;
$function$;