-- Security Definer View の修正

-- personas_secureビューをSECURITY INVOKERに変更（またはドロップ）
DROP VIEW IF EXISTS public.personas_secure;

-- 必要に応じて、セキュリティ安全なビューを再作成
-- この例では、元のpersonasテーブルを直接使用することを推奨
-- personasテーブルは既にRLSが有効で適切なポリシーが設定されている

-- セキュリティ警告に対応するため、SECURITY DEFINERは使用しない