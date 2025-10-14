# SECURITY DEFINER関数セキュリティ監査レポート

## 概要

このドキュメントは、プロジェクト内のすべての`SECURITY DEFINER`関数を一覧化し、それぞれのセキュリティリスクと正当性を評価したものです。

**最終更新日**: 2025-10-14  
**フェーズ1セキュリティ対策の一環として作成**

---

## SECURITY DEFINERとは

`SECURITY DEFINER`関数は、関数の所有者の権限で実行されます。これにより：
- ✅ Row Level Security (RLS)ポリシーをバイパスできる
- ✅ 通常のユーザーがアクセスできないデータにアクセス可能
- ⚠️ 入力検証が不十分だと、特権昇格やデータ漏洩のリスクがある

---

## 関数一覧と評価

### 🟢 安全性が確認された関数

#### 1. `has_role(_user_id uuid, _role app_role)`
- **目的**: ユーザーのロールを確認する
- **リスクレベル**: 低
- **セキュリティ対策**:
  - ✅ 固定の`search_path = public`
  - ✅ 入力はUUIDとENUM型で型安全
  - ✅ 単純なSELECT操作のみ
- **正当性**: RLSポリシー内で使用するため、SECURITY DEFINERが必須

#### 2. `is_admin(_user_id uuid)`
- **目的**: 管理者権限を確認する
- **リスクレベル**: 低
- **セキュリティ対策**:
  - ✅ `has_role`関数をラップするだけ
  - ✅ 入力検証済み
- **正当性**: RLSポリシーで広く使用されるため必須

#### 3. `check_login_attempts(user_email text)`
- **目的**: ブルートフォース攻撃を防ぐ
- **リスクレベル**: 低
- **セキュリティ対策**:
  - ✅ 固定の`search_path = public`
  - ✅ 読み取り専用操作
  - ✅ タイムウィンドウ制限あり（15分）
- **正当性**: 認証前に実行する必要があるため必須

#### 4. `log_security_event(...)`
- **目的**: セキュリティイベントを記録
- **リスクレベル**: 中
- **セキュリティ対策**:
  - ✅ 固定の`search_path = public`
  - ✅ INSERTのみで削除・更新なし
  - ⚠️ エラー時は処理をブロックしない（EXCEPTION処理）
- **正当性**: システムイベントの記録に必須

---

### 🟡 注意が必要な関数

#### 5. `get_cron_job_status()`
- **目的**: Cron jobのステータスを取得
- **リスクレベル**: 中
- **セキュリティ対策**:
  - ✅ 固定の`search_path = public`
  - ✅ 管理者権限チェックあり（`is_admin`）
  - ⚠️ システム情報を公開する
- **改善提案**: アクセスログを記録
- **正当性**: Cronステータスビューにはアクセス制限が必要

#### 6. `cleanup_auto_generated_schedules_only(p_persona_id uuid)`
- **目的**: 自動生成された投稿をクリーンアップ
- **リスクレベル**: 中
- **セキュリティ対策**:
  - ✅ 固定の`search_path = public`
  - ✅ UUID入力で型安全
  - ⚠️ 内部処理用バイパスを使用
- **改善提案**: ペルソナ所有者確認を追加
- **正当性**: トリガーから呼ばれるため必須

#### 7. `enqueue_self_reply_job()`
- **目的**: セルフリプライジョブをキューに追加
- **リスクレベル**: 中
- **セキュリティ対策**:
  - ✅ 固定の`search_path = public`
  - ✅ トリガー経由でのみ実行
  - ✅ 重複チェックあり
- **正当性**: トリガーコンテキストで必須

#### 8. `reschedule_failed_posts_for_persona(p_persona_id uuid)`
- **目的**: 失敗した投稿を再スケジュール
- **リスクレベル**: 中
- **セキュリティ対策**:
  - ✅ 固定の`search_path = public`
  - ✅ UUID入力で型安全
  - ⚠️ ペルソナ所有者の検証なし
- **改善提案**: ペルソナ所有者確認を追加
- **正当性**: トークン設定時の自動修復に必要

---

### 🔴 見直しが推奨される関数

#### 9. `get_user_emails_for_admin()`
- **目的**: 管理者用にユーザーメールアドレスを取得
- **リスクレベル**: 高
- **セキュリティ対策**:
  - ✅ 管理者権限チェックあり
  - ⚠️ `auth.users`テーブルへの直接アクセス
  - ⚠️ 個人情報（メールアドレス）を公開
- **改善提案**:
  - アクセスログを必須化
  - 取得理由の記録を追加
  - 監査トレイルの強化
- **正当性**: 管理機能に必要だが、追加の保護が望ましい

#### 10. `get_persona_tokens_safe(persona_id_param uuid)`
- **目的**: ペルソナのトークンアクセスを安全に確認
- **リスクレベル**: 高
- **セキュリティ対策**:
  - ✅ 認証必須チェック
  - ✅ 所有者確認あり
  - ✅ セキュリティログ記録
  - ⚠️ 実際のトークンは返さないが、アクセス許可を与える
- **改善提案**: 二段階認証を検討
- **正当性**: トークン取得の前段階として必要

---

## 推奨事項

### 即座に実施すべき対策

1. **アクセスログの強化**
   - `get_user_emails_for_admin`の全呼び出しを記録
   - `get_cron_job_status`のアクセスを監査

2. **所有者確認の追加**
   ```sql
   -- cleanup_auto_generated_schedules_onlyに追加
   IF NOT EXISTS (
     SELECT 1 FROM personas 
     WHERE id = p_persona_id AND user_id = auth.uid()
   ) THEN
     RAISE EXCEPTION 'Access denied: not your persona';
   END IF;
   ```

3. **レート制限の実装**
   - `get_user_emails_for_admin`に1時間あたり10回の制限
   - 頻繁なアクセスのアラート

### 長期的な改善

1. **関数の見直し**
   - SECURITY DEFINERが本当に必要か再評価
   - 可能であればSECURITY INVOKERに変更

2. **監査の自動化**
   - 定期的なSECURITY DEFINER関数のレビュー
   - 新規追加時の承認プロセス

3. **ドキュメントの更新**
   - 関数追加・変更時にこのドキュメントを更新
   - セキュリティレビューの定期実施（月次）

---

## チェックリスト

新しいSECURITY DEFINER関数を追加する際は、以下を確認してください：

- [ ] `SET search_path = public`を設定済み
- [ ] 入力パラメータの型が明確（UUID、ENUMなど）
- [ ] 適切な権限チェック（`auth.uid()`、`is_admin`など）
- [ ] セキュリティログの記録
- [ ] エラーハンドリングの実装
- [ ] このドキュメントへの追加
- [ ] コードレビューの実施

---

## 関連ドキュメント

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html)
- プロジェクトセキュリティポリシー: `/docs/security/POLICY.md`

---

**注意**: このドキュメントはフェーズ1セキュリティ対策の一環として作成されました。定期的な見直しと更新が必要です。
