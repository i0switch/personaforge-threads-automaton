# Service Role Key Rotation Runbook

## 対象
- 監査論点 BUG-001（migration への service_role key 平文埋め込み）
- `supabase/migrations` の平文トークン除去後の運用是正

## 目的
- リポジトリ上から秘密情報を除去する
- 旧 service_role key の継続利用を停止する
- 今後の migration で再発しない運用を定着させる

## コード側の是正（実施済み）
- migration 内の `Authorization: Bearer <JWT直書き>` を廃止
- `current_setting(...)` による実行時参照へ統一
  - service_role 系: `app.settings.service_role_key` / `app.service_role_key` など
  - anon 系: `app.settings.anon_key` / `app.anon_key` など

## 運用手順（必須）
1. **新しい service_role key を発行**
   - Supabase Dashboard で service_role key をローテーション
2. **実行環境へ反映**
   - DBセッション設定または Secret 管理に新キーを登録
   - `app.settings.service_role_key`（または運用で使用中の同等キー）を更新
3. **旧キーを失効確認**
   - 旧キーで API 呼び出しが失敗することを確認
4. **cron/Edge Function の疎通確認**
   - `auto-scheduler` / `auto-post-generator` / `check-replies` 等のジョブ実行確認
5. **監査ログ保全**
   - ローテーション日時、実施者、影響範囲を運用記録に残す

## 過去コミットに秘密情報が残る場合の対応方針
- 原則: **キー失効を最優先**（履歴改変より先）
- 公開リポジトリ運用時は追加対応を検討
  - Git履歴のクリーンアップ（filter-repo/BFG 等）
  - フォーク/ミラーへの展開確認
  - 必要なら Supabase Project 側の追加監査
- 履歴改変後はチームへ強制同期手順を通知

## 再発防止策
- migration 作成時レビュー項目に以下を追加
  - `Bearer ` 直書き禁止
  - `service_role` / JWT 文字列の直書き禁止
- CI で以下パターンを検出し失敗させる
  - `eyJ` で始まる JWT 文字列
  - `Authorization": "Bearer ` + 固定文字列
- 鍵ローテーションの定期運用（月次/四半期）を標準化
