-- THAAトークンを正しく非暗号化トークンとして処理するよう修正

CREATE OR REPLACE FUNCTION public.decrypt_access_token(encrypted_token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 復号化はEdge Functionで実行される
  -- この関数は既存のコードとの互換性のために保持
  IF encrypted_token IS NULL OR encrypted_token = '' THEN
    RETURN NULL;
  END IF;
  
  -- THAAトークンは非暗号化トークンなのでそのまま返す
  IF encrypted_token LIKE 'THAA%' THEN
    RETURN encrypted_token;
  END IF;
  
  -- Edge Function暗号化マーカーの場合はNULLを返す（再取得が必要）
  IF encrypted_token = 'ENCRYPTED_VIA_EDGE_FUNCTION' THEN
    RETURN NULL;
  END IF;
  
  -- その他の場合はそのまま返す（後方互換性）
  RETURN encrypted_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_access_token_safe(encrypted_token text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 復号化はEdge Functionで実行
  IF encrypted_token IS NULL OR encrypted_token = '' THEN
    RETURN NULL;
  END IF;
  
  -- THAAトークンは非暗号化トークンなのでそのまま返す
  IF encrypted_token LIKE 'THAA%' THEN
    RETURN encrypted_token;
  END IF;
  
  -- Edge Function暗号化マーカーの場合はNULLを返す
  IF encrypted_token = 'ENCRYPTED_VIA_EDGE_FUNCTION' THEN
    RETURN NULL;
  END IF;
  
  RETURN encrypted_token;
END;
$function$;