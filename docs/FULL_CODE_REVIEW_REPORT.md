# 総合コードレビューレポート — PersonaForge Threads Automaton

> **レビュー実施日**: 2026年3月3日  
> **対象**: リポジトリ全コード（Edge Functions 43個 + フロントエンド全コード + 設定ファイル + DB構成）

---

## 目次

- [プロジェクト概要](#プロジェクト概要)
- [検出件数サマリー](#検出件数サマリー)
- [🔴 致命的な問題（即時対応必須）](#-致命的な問題即時対応必須-9件)
- [🟠 重大な問題](#-重大な問題-12件)
- [🟡 中程度の問題](#-中程度の問題-18件)
- [🟢 アーキテクチャ・品質の問題](#-アーキテクチャ品質の問題-10件)
- [Edge Functions 詳細レビュー](#edge-functions-詳細レビュー)
  - [本番用Edge Functions](#本番用edge-functions)
  - [テスト用Edge Functions（本番残存）](#テスト用edge-functions本番残存)
- [フロントエンド 詳細レビュー](#フロントエンド-詳細レビュー)
  - [メインファイル](#メインファイル)
  - [Contexts](#contexts)
  - [Hooks](#hooks)
  - [Utils](#utils)
  - [Lib / Types / Integrations](#lib--types--integrations)
  - [ページ・コンポーネント](#ページコンポーネント)
- [設定ファイル・DB構成レビュー](#設定ファイルdb構成レビュー)
- [推奨対応の優先順位](#推奨対応の優先順位)

---

## プロジェクト概要

Vite + React + TypeScript + Supabase構成のThreads API自動投稿・自動返信・ペルソナ管理SPA。

| 項目 | 数量 |
|------|------|
| Supabase Edge Functions | 43個（本番31 + テスト12） |
| フロントエンドページ | 27個 |
| コンポーネント | 60+ |
| DBテーブル | 24個 |
| DBマイグレーション | 221個 |

---

## 検出件数サマリー

| 重大度 | 件数 | 説明 |
|--------|------|------|
| 🔴 致命的 | 9件 | セキュリティ侵害に直結。即時対応必須 |
| 🟠 重大 | 12件 | 攻撃ベクトルまたは重要なバグ。早急に対応 |
| 🟡 中程度 | 18件 | パフォーマンス・保守性・軽度のリスク |
| 🟢 低 | 10件 | コード品質・アクセシビリティ・改善推奨 |
| **合計** | **49件** | |

---

## 🔴 致命的な問題（即時対応必須）— 9件

### C-01: `.env`が`.gitignore`に含まれていない

| 項目 | 内容 |
|------|------|
| **影響** | Supabase URL・Anon Key・APIキーがGit履歴に記録されるリスク |
| **対象** | `.gitignore` |
| **修正方法** | `.gitignore`に`.env*`パターンを追加 + `git filter-branch`等でGit履歴からシークレットを削除 |

### C-02: Supabase認証情報のソースコードへのハードコード

| 項目 | 内容 |
|------|------|
| **影響** | Supabase URLとAnon Keyがソースコードに直書き。環境切替え不可、Git履歴に永続記録 |
| **対象** | `src/integrations/supabase/client.ts` |
| **修正方法** | `import.meta.env.VITE_SUPABASE_URL` / `import.meta.env.VITE_SUPABASE_ANON_KEY` に変更 |

```typescript
// ❌ 現状
const supabaseConfig = {
  url: 'https://tqcgbsnoiarnawnppwia.supabase.co',
  anonKey: '[REDACTED]'
};

// ✅ 修正後
const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
};
```

### C-03: Edge Functions 21個で `verify_jwt = false`

| 項目 | 内容 |
|------|------|
| **影響** | セキュリティに直結する関数まで認証バイパス可能 |
| **対象** | `supabase/config.toml` |
| **特に危険な関数** | `admin-reset-password`, `send-password-reset`, `refresh-threads-tokens` |

```toml
# ❌ 現状（config.toml内21箇所）
[functions.admin-reset-password]
verify_jwt = false

# ✅ 修正後
[functions.admin-reset-password]
verify_jwt = true
```

### C-04: テスト用Edge Function 12個が本番環境に残存

| 項目 | 内容 |
|------|------|
| **影響** | 認証なしで`SERVICE_ROLE_KEY`を使い全データ読み書きが可能。ハードコードされた本番ペルソナID・ユーザーデータも含まれる |
| **対象関数** | 下記12個 |
| **修正方法** | 本番デプロイ対象から除外、または完全削除 |

| 関数名 | 認証 | 主な問題 |
|--------|------|----------|
| `test-ai-auto-reply` | ❌なし | Service Role Keyで全データアクセス、他関数のinvoke |
| `test-auto-post-generate` | ✅あり | テスト用だが一応認証あり |
| `test-auto-reply` | ❌なし | Service Role Keyで全データアクセス、DB更新あり |
| `test-context-ai-reply` | ❌なし | ハードコードされたペルソナID/リプライID |
| `test-duplicate-post-prevention` | ❌なし | テスト用UUIDでDBにデータ挿入（`00000000-...`） |
| `test-gemini-api-key` | ✅あり | 認証あり、比較的安全 |
| `test-modified-features` | ❌なし | Service Role Keyで全データ読み書き |
| `test-new-features` | ❌なし | Service Role Keyで全データ読み取り |
| `comprehensive-auto-reply-test` | ❌なし | 特定ペルソナ名がハードコード |
| `comprehensive-system-test` | ❌なし | Service Role Keyで全テーブルスキャン |
| `final-integration-test` | ❌なし | Service Role Keyで全データ読み取り |
| `quality-assurance-test` | ❌なし | Service Role Keyで全データ読み取り |

### C-05: PBKDF2ソルトのハードコード

| 項目 | 内容 |
|------|------|
| **影響** | 暗号化のソルトが固定値`'salt'`。レインボーテーブル攻撃が可能 |
| **対象** | `supabase/functions/_shared/crypto.ts` |
| **修正方法** | ランダムソルトを生成して暗号文と共に保存 |

```typescript
// ❌ 現状
const salt = encoder.encode('salt');

// ✅ 修正後
const salt = crypto.getRandomValues(new Uint8Array(16));
```

### C-06: Webhook署名検証のタイミング攻撃脆弱性

| 項目 | 内容 |
|------|------|
| **影響** | 署名の1文字ずつを時間差で推測可能 |
| **対象** | `secure-webhook-handler/index.ts`, `enhanced-webhook-security/index.ts` |
| **修正方法** | `===` → 定数時間比較関数に変更 |

```typescript
// ❌ 現状
if (expectedHex === providedSignature) { ... }

// ✅ 修正後
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

### C-07: 画像生成Edge Functions 3つに認証なし

| 項目 | 内容 |
|------|------|
| **影響** | 高額リソースの不正利用 + SSRF脆弱性 |
| **対象** | `generate-image-gradio`, `generate-image-huggingface`, `generate-image-stable-diffusion` |
| **修正方法** | JWT認証の追加 + URLホワイトリストの実装 |

### C-08: `localStorage.clear()` による全データ消失

| 項目 | 内容 |
|------|------|
| **影響** | 起動時セッション検証失敗で全localStorage/sessionStorageが消去される |
| **対象** | `src/integrations/supabase/client.ts` |
| **修正方法** | Supabase関連キー（`sb-`プレフィックス）のみ削除に統一 |

```typescript
// ❌ 現状
localStorage.clear();
sessionStorage.clear();

// ✅ 修正後
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('sb-')) localStorage.removeItem(key);
});
Object.keys(sessionStorage).forEach(key => {
  if (key.startsWith('sb-')) sessionStorage.removeItem(key);
});
```

### C-09: TypeScript `strict: false` + `strictNullChecks: false`

| 項目 | 内容 |
|------|------|
| **影響** | 型安全性が大幅に低下。NullPointerException相当のバグを検出できない |
| **対象** | `tsconfig.app.json`, `tsconfig.json` |
| **修正方法** | 段階的に`strict: true`へ移行。最初に`strictNullChecks: true`から |

---

## 🟠 重大な問題 — 12件

| # | ID | カテゴリ | 問題 | 対象ファイル | 影響 |
|---|-----|---------|------|-------------|------|
| 1 | H-01 | CORS | 全Edge Functionsで`Access-Control-Allow-Origin: *` | 全Edge Functions | 任意ドメインからのAPI呼び出し可能 |
| 2 | H-02 | API Key | Gemini APIで`?key=xxx`をURL内に含める | 複数のEdge Functions | サーバーログにAPIキーが記録される |
| 3 | H-03 | CSP | `'unsafe-eval'`+`'unsafe-inline'`が二重定義 | `index.html`, `vite.config.ts` | XSS攻撃に対する保護が弱まる |
| 4 | H-04 | IDOR | `generate-image-stable-diffusion`でペルソナ所有者チェックなし | `generate-image-stable-diffusion/` | 他ユーザーのアバター画像にアクセス可能 |
| 5 | H-05 | DoS | `send-password-reset`にレート制限なし | `send-password-reset/index.ts` | メール爆撃（Email Bombing）が可能 |
| 6 | H-06 | アーキテクチャ | Realtimeをグローバル無効化しつつ複数hookで使用 | `client.ts`, `usePersonaLimit.ts`, `useThreadsRateLimitAlert.ts` | Chrome等で監視機能が完全に動作しない |
| 7 | H-07 | 暗号化 | `save-secret`で暗号化キーを`padEnd(32, '0')`でパディング | `save-secret/index.ts` | キーが短い場合エントロピーが低下 |
| 8 | H-08 | バリデーション | `containsSqlInjection`が"select","create"等の一般語でHit | `src/lib/validation.ts` | ユーザー入力が不当にブロックされる |
| 9 | H-09 | 依存関係 | `@playwright/test`が`devDependencies`でなく`dependencies`に | `package.json` | 本番バンドルサイズに影響 |
| 10 | H-10 | 認証 | 約16個のcron対象Edge Functionにcron-secret認証なし | 各cron関数 | 外部からのスケジュール実行トリガーが可能 |
| 11 | H-11 | エンコーディング | JWT検証で`atob()`使用（base64url非対応） | `AuthContext.tsx`, `authHelpers.ts`, `client.ts` | 特定のトークンで検証失敗の可能性 |
| 12 | H-12 | DB | `personas`テーブルに平文`threads_access_token`カラムが残存 | DB schema / `types.ts` | 暗号化移行が不完全 |

---

## 🟡 中程度の問題 — 18件

| # | ID | カテゴリ | 問題 | 対象 |
|---|-----|---------|------|------|
| 1 | M-01 | CORS | vite.configで`Allow-Origin: *`+`Allow-Credentials: true`（仕様上矛盾） | `vite.config.ts` |
| 2 | M-02 | パフォーマンス | `admin-reset-password`で`listUsers()`全件取得 | `admin-reset-password/index.ts` |
| 3 | M-03 | データ整合性 | ストレージクリア方式が3パターン混在 | `AuthContext.tsx`, `authHandler.ts`, `authSecurity.ts`, `client.ts` |
| 4 | M-04 | DRY違反 | トークン検証ロジックが3箇所で重複 | `client.ts`, `authHelpers.ts`, `AuthContext.tsx` |
| 5 | M-05 | メモリ | `TOAST_REMOVE_DELAY=1000000`（約17分のメモリ保持） | `use-toast.ts` |
| 6 | M-06 | メモリリーク | `notifiedIds`の`Set`が無制限成長 | `useThreadsRateLimitAlert.ts` |
| 7 | M-07 | 保守性 | `CreatePosts.tsx`が1478行、20+のstate変数 | `CreatePosts.tsx` |
| 8 | M-08 | パフォーマンス | `useImageGenerator`に15個の独立`useState` | `useImageGenerator.ts` |
| 9 | M-09 | セキュリティ | `generatePasswordSuggestion`のエントロピーが低い（約12,500通り） | `passwordValidation.ts` |
| 10 | M-10 | 情報漏洩 | 本番ビルドで大量の`console.log`出力 | 多数のファイル |
| 11 | M-11 | 認証 | `RateLimitTest`ページの認証ガード不足 | `App.tsx` |
| 12 | M-12 | 依存関係 | Edge Functionsの`@supabase/supabase-js`が4バージョン混在 | 各Edge Function |
| 13 | M-13 | i18n | `index.html`の`lang="en"`（日本語アプリ） | `index.html` |
| 14 | M-14 | 依存関係 | `next-themes`（Next.js用）をViteプロジェクトで使用 | `package.json` |
| 15 | M-15 | DB | 221件のDBマイグレーション（可読性低下） | `supabase/migrations/` |
| 16 | M-16 | バグ | `btoa(String.fromCharCode(...spread))`で大きい画像変換→スタックオーバーフロー | `generate-image-huggingface/`, `generate-image-stable-diffusion/` |
| 17 | M-17 | パフォーマンス | iOS Safari 10秒ポーリングがバックグラウンドでも停止しない | `AuthContext.tsx` |
| 18 | M-18 | バグ | `generate-image-huggingface`で`space_url`パラメータが無視される | `generate-image-huggingface/index.ts` |

---

## 🟢 アーキテクチャ・品質の問題 — 10件

| # | ID | 問題 | 対象 |
|---|-----|------|------|
| 1 | L-01 | クライアント側セキュリティ（レート制限・SQLi検出等）はDevToolsでバイパス可能 | `enhancedSecurity.ts`, `securityMiddleware.ts` |
| 2 | L-02 | 約30箇所以上の`any`型使用 | 多数のファイル |
| 3 | L-03 | `aria-label`の不足（アクセシビリティ） | 多数のコンポーネント |
| 4 | L-04 | Edge Functionsに大量のデバッグログ → 秘密情報周辺の情報漏洩 | 全Edge Functions |
| 5 | L-05 | エラーハンドリングパターンの不統一 | プロジェクト全体 |
| 6 | L-06 | Realtimeサブスクリプションのコード重複 | 複数hooks |
| 7 | L-07 | `configValidation.ts`が環境変数チェックするも`client.ts`で未使用 | `configValidation.ts`, `client.ts` |
| 8 | L-08 | `PersonaLimitManager`のN+1クエリ | `PersonaLimit/` |
| 9 | L-09 | OGP画像がLovable社のデフォルト画像のまま | `index.html` |
| 10 | L-10 | `CLS * 1000`の計算が不適切（CLSはスコア値でms単位ではない） | `errorTracking.ts` |

---

## Edge Functions 詳細レビュー

### 本番用Edge Functions

#### `_shared/crypto.ts`

| 項目 | 評価 |
|------|------|
| **機能** | 統一暗号化/復号ユーティリティ。AES-256-GCM + PBKDF2レガシーフォールバック |
| **セキュリティ** | ⚠️ PBKDF2のソルトが固定値`'salt'`（C-05参照） |
| **品質** | ✅ 定数時間比較によるHMAC検証（タイミング攻撃対策）あり |
| **問題** | ⚠️ `isEncrypted()`の判定がヒューリスティック（40文字以下を平文と見なす等） |

#### `threads-post/`

| 項目 | 評価 |
|------|------|
| **機能** | Threads APIへの投稿処理 |
| **セキュリティ** | ✅ JWT認証チェックあり |
| **問題** | ⚠️ CORS全開放（`*`） |

#### `threads-webhook/`

| 項目 | 評価 |
|------|------|
| **機能** | Threads Webhookイベントの受信・処理 |
| **セキュリティ** | ⚠️ 後方互換モード（検証バイパス）が存在 |
| **問題** | 🔴 Webhook検証バイパスコードの除去が必要 |

#### `threads-auto-reply/`

| 項目 | 評価 |
|------|------|
| **機能** | Gemini AIによる自動返信生成・投稿 |
| **セキュリティ** | ⚠️ Gemini APIキーがURLパラメータに含まれる（H-02） |
| **品質** | ✅ ペルソナベースの返信生成ロジックは充実 |

#### `threads-oauth-callback/`

| 項目 | 評価 |
|------|------|
| **機能** | Threads OAuth認証コールバック処理 |
| **セキュリティ** | ⚠️ OAuth state検証が弱い可能性 |
| **問題** | ⚠️ `verify_jwt = false`（C-03） |

#### `auto-post-generator/`

| 項目 | 評価 |
|------|------|
| **機能** | Gemini AIによる自動投稿コンテンツ生成 |
| **セキュリティ** | ⚠️ cron-secret認証なし（H-10） |
| **品質** | ✅ コンテンツ生成ロジックは充実 |

#### `auto-scheduler/` / `auto-scheduler-fix/`

| 項目 | 評価 |
|------|------|
| **機能** | 自動投稿スケジューリング |
| **問題** | ⚠️ 2つの類似関数が存在（`fix`版との差分が不明確） |

#### `generate-posts/`

| 項目 | 評価 |
|------|------|
| **機能** | 投稿コンテンツの一括生成 |
| **セキュリティ** | ✅ JWT認証あり |
| **品質** | ✅ 入力バリデーションあり |

#### `generate-auto-reply/`

| 項目 | 評価 |
|------|------|
| **機能** | AI自動返信の生成 |
| **セキュリティ** | ⚠️ Gemini APIキーのURL露出 |
| **品質** | ✅ ペルソナベースの返信カスタマイズあり |

#### `check-replies/`

| 項目 | 評価 |
|------|------|
| **機能** | 返信チェックとモニタリング |
| **セキュリティ** | ⚠️ cron-secret認証なし |

#### `check-token-health/`

| 項目 | 評価 |
|------|------|
| **機能** | Threadsアクセストークンの有効性確認 |
| **セキュリティ** | ⚠️ `verify_jwt = false` |

#### `refresh-threads-tokens/`

| 項目 | 評価 |
|------|------|
| **機能** | Threadsアクセストークンのリフレッシュ |
| **セキュリティ** | 🔴 `verify_jwt = false`で外部から呼び出し可能 |

#### `secure-webhook-handler/` / `enhanced-webhook-security/`

| 項目 | 評価 |
|------|------|
| **機能** | Webhookセキュリティ検証ハンドラー |
| **セキュリティ** | 🔴 `===`による通常文字列比較（C-06参照） |

#### `self-reply-processor/`

| 項目 | 評価 |
|------|------|
| **機能** | 自己返信（セルフリプライ）の処理 |
| **品質** | ✅ 重複防止ロジックあり |

#### `detect-rate-limited-personas/`

| 項目 | 評価 |
|------|------|
| **機能** | レート制限されたペルソナの検出 |
| **セキュリティ** | ⚠️ cron-secret認証なし |

#### `fetch-threads-user-ids/`

| 項目 | 評価 |
|------|------|
| **機能** | ThreadsユーザーIDの取得 |
| **セキュリティ** | ⚠️ `verify_jwt = false`でユーザーID取得可能 |

#### `fix-inactive-personas/` / `fix-stuck-ai-replies/` / `reset-stuck-ai-replies/`

| 項目 | 評価 |
|------|------|
| **機能** | データベースの不整合修復ユーティリティ |
| **セキュリティ** | ⚠️ cron-secret認証なし |

#### `process-unhandled-replies/`

| 項目 | 評価 |
|------|------|
| **機能** | 未処理返信の一括処理 |
| **セキュリティ** | ⚠️ cron-secret認証なし |

#### `admin-reset-password/`

| 項目 | 評価 |
|------|------|
| **機能** | 管理者によるユーザーパスワードリセット |
| **セキュリティ** | ✅ JWT認証 + is_admin RPCによる権限検証 |
| **セキュリティ** | ⚠️ パスワード強度チェックが8文字以上のみ |
| **パフォーマンス** | 🔴 `listUsers()`で全ユーザーをメモリに読み込み |
| **問題** | ⚠️ config.tomlで`verify_jwt = false`（内部で自前認証しているが危険） |

#### `send-password-reset/`

| 項目 | 評価 |
|------|------|
| **機能** | Resend経由でパスワードリセットメール送信 |
| **セキュリティ** | 🔴 認証なし + レート制限なし（メール爆撃可能） |
| **問題** | ⚠️ リダイレクトURLがハードコード |
| **良い点** | ✅ ユーザー未存在時も`{ success: true }`返却（列挙攻撃対策） |

#### `save-secret/` / `retrieve-secret/`

| 項目 | 評価 |
|------|------|
| **機能** | APIキーの暗号化保存・復号取得 |
| **セキュリティ** | ✅ JWT認証あり、AES-256-GCM暗号化 |
| **問題** | ⚠️ 暗号化キーの`padEnd(32, '0')`パディング（H-07） |
| **良い点** | ✅ `retrieve-secret`にIDOR対策（所有者チェック） |

#### `generate-image-gradio/`

| 項目 | 評価 |
|------|------|
| **機能** | Gradio Space接続による画像生成 |
| **セキュリティ** | 🔴 認証なし + `space_url`入力によるSSRFリスク |

#### `generate-image-huggingface/`

| 項目 | 評価 |
|------|------|
| **機能** | HuggingFace Gradio Clientでの画像生成 |
| **セキュリティ** | 🔴 認証なし |
| **バグ** | 🟡 `space_url`パラメータが無視される（ハードコードのSpace IDを使用） |
| **バグ** | 🟡 `btoa(String.fromCharCode(...spread))`でスタックオーバーフローリスク |

#### `generate-image-prompt/`

| 項目 | 評価 |
|------|------|
| **機能** | Gemini APIで画像プロンプト生成 |
| **セキュリティ** | ✅ JWT認証あり + ユーザー固有APIキーをDBから復号使用 |
| **問題** | ⚠️ APIキーがURLパラメータに含まれる |

#### `generate-image-stable-diffusion/`

| 項目 | 評価 |
|------|------|
| **機能** | Stable Diffusion APIでの画像生成 |
| **セキュリティ** | 🔴 認証なし + IDOR（ペルソナ所有者チェックなし） |
| **品質** | ✅ モジュール分割が適切（types, config, validation, api-client, image-utils） |

### テスト用Edge Functions（本番残存）

> ⚠️ **全12関数とも本番デプロイ対象から即時除外すべき**

#### 特に危険なもの

- **`test-context-ai-reply`** — 本番データのペルソナID (`55b31a70-4366-4016-8c25-2343e898fd88`) とリプライID (`18076441843832942`) がハードコード
- **`test-duplicate-post-prevention`** — `user_id: '00000000-0000-0000-0000-000000000000'` で本番DBにデータ挿入
- **`comprehensive-auto-reply-test`** — `'令和ギャル占い師@レイカさん'`, `'守護霊鑑定OL🦊みさき'` など本番ペルソナ名がハードコード
- **`test-modified-features`** — 認証なしで他Edge Functionをinvokeし結果をそのまま返却

---

## フロントエンド 詳細レビュー

### メインファイル

#### `App.tsx`

| 項目 | 評価 |
|------|------|
| **機能** | React Router v6によるルーティング、認証保護、ErrorBoundary |
| **問題** | ⚠️ `/development-guide`ルートが`ProtectedRoute`で囲まれていない |
| **品質** | ✅ QueryClientはモジュールレベルのシングルトン（適切） |

#### `main.tsx`

| 項目 | 評価 |
|------|------|
| **機能** | Reactアプリのエントリーポイント |
| **問題** | ⚠️ `console.log`がプロダクションビルドにも残る |
| **問題** | ⚠️ `document.getElementById("root")!`のNon-null assertion |

### Contexts

#### `AuthContext.tsx`

| 項目 | 評価 |
|------|------|
| **機能** | 認証状態管理、サインイン/サインアップ/サインアウト、iOS Safari対応ポーリング |
| **セキュリティ** | ⚠️ JWT検証に`atob()`使用（base64url非対応） |
| **セキュリティ** | ⚠️ signUpの`emailRedirectTo`がハードコード |
| **パフォーマンス** | ⚠️ iOS Safari 10秒ポーリングがバックグラウンドタブでも動作（`visibilitychange`制御なし） |
| **品質** | ⚠️ プロダクションでもコンソールログが大量出力 |
| **型** | ⚠️ `signUp/signIn`の返り値が`{ error: any }` |

### Hooks

#### `use-toast.ts`

| 項目 | 評価 |
|------|------|
| **メモリ** | ⚠️ `TOAST_REMOVE_DELAY = 1000000`（約17分間メモリ保持） |
| **品質** | ✅ リスナー解除は適切 |

#### `useImageGenerator.ts`

| 項目 | 評価 |
|------|------|
| **パフォーマンス** | ⚠️ 15個の独立`useState`→`useReducer`統合推奨 |
| **バグ** | ⚠️ `FileReader.onerror`ハンドラが未実装 |

#### `usePersonaLimit.ts`

| 項目 | 評価 |
|------|------|
| **パフォーマンス** | ⚠️ `checkPersonaLimit`が`useCallback`でメモ化されていない |
| **問題** | ⚠️ Realtimeサブスクリプションがグローバル無効化により機能しない |

#### `useSecureAuth.ts`

| 項目 | 評価 |
|------|------|
| **品質** | ✅ ブルートフォース対策、パスワード強度検証あり |
| **問題** | ⚠️ `secureSignOut`で二重サインアウトの可能性 |

#### `useThreadsRateLimitAlert.ts`

| 項目 | 評価 |
|------|------|
| **メモリリーク** | ⚠️ `notifiedIds.current`（`Set`）が無制限に成長 |
| **問題** | ⚠️ Realtime無効化によりINSERT監視が動作しない |

### Utils

#### `authSecurity.ts`

| 項目 | 評価 |
|------|------|
| **問題** | ⚠️ `secureLogout`で`sessionStorage.clear()`を呼んでいる（Supabase以外のデータも消失） |
| **問題** | ⚠️ `localStorage.removeItem('supabase.auth.token')`は旧Supabase v1のキー |

#### `enhancedSecurity.ts`

| 項目 | 評価 |
|------|------|
| **セキュリティ** | ⚠️ クライアント側レート制限（DevToolsでバイパス可能） |
| **セキュリティ** | ⚠️ `verifyWebhookSecurity`がクライアントサイドにある → Webhook署名検証はサーバー側で行うべき |
| **セキュリティ** | ⚠️ 通常の文字列比較でタイミング攻撃に脆弱 |

#### `inputValidation.ts` / `validation.ts`

| 項目 | 評価 |
|------|------|
| **問題** | 🟠 `containsSqlInjection`が一般的英単語（select, create, update, delete, script）で誤検出 |
| **問題** | ⚠️ XSSサニタイズがUnicodeエスケープに未対応 |
| **問題** | ⚠️ CJK漢字の範囲が`\u4E00-\u9FAF`で拡張漢字が含まれない |

#### `passwordValidation.ts`

| 項目 | 評価 |
|------|------|
| **問題** | ⚠️ `generatePasswordSuggestion`のエントロピーが低い（5×5×100×5 ≈ 12,500通り） |

#### `errorTracking.ts`

| 項目 | 評価 |
|------|------|
| **品質** | ✅ メモリ上限100件、無限ループ防止のtry-catch |
| **バグ** | ⚠️ CLSの値を`* 1000`で換算（CLSはスコア値でms単位ではない） |

#### `ios-websocket-shim.ts`

| 項目 | 評価 |
|------|------|
| **影響** | ⚠️ Safari全体でWebSocketが使えなくなるため、Supabase Realtimeだけでなく全WebSocket通信がブロック |

#### `webhookSecurity.ts`

| 項目 | 評価 |
|------|------|
| **品質** | ✅ 定数時間比較、タイムスタンプ検証は適切 |
| **問題** | ⚠️ クライアントサイドにあるが本来サーバーサイドで使用すべきロジック |

### Lib / Types / Integrations

#### `client.ts`（Supabaseクライアント）

| 項目 | 評価 |
|------|------|
| **セキュリティ** | 🔴 URL/Anon Keyハードコード（C-02） |
| **セキュリティ** | 🔴 `localStorage.clear()`全消去（C-08） |
| **問題** | ⚠️ Realtime無力化が`@ts-ignore`多用 |
| **問題** | ⚠️ IIFE起動時セッション検証の副作用が大きい |
| **良い点** | ✅ iOS Safariのメモリストレージフォールバックは丁寧 |

#### `types.ts`

| 項目 | 評価 |
|------|------|
| **品質** | ✅ Supabase CLI自動生成。1,689行の型定義 |
| **問題** | ⚠️ `personas.threads_access_token`が`string | null`（平文残存） |
| **問題** | ⚠️ `template_post_boxes.templates`が`Json`型（型安全でない） |

### ページ・コンポーネント

#### セキュリティ問題（ページ）

| ページ | 問題 |
|--------|------|
| `AdminDashboard.tsx` | 管理者パスワードリセットで新パスワードが平文表示 |
| `Settings.tsx` | アクセストークンのモーダル表示（目視可能） |
| `RateLimitTest.tsx` | 認証ガードなし |
| `ThreadsOAuthCallback.tsx` | アクセストークンがURL内に露出 |

#### UIロジック問題

| コンポーネント | 問題 |
|---------------|------|
| `CreatePosts.tsx` | 1,478行の巨大コンポーネント、20+のstate変数 |
| 複数ページ | SEOメタタグのDOM操作がuseEffect内で重複 |
| 複数ページ | `window.confirm`とカスタムダイアログの使い分けが不統一 |

#### パフォーマンス問題

| コンポーネント | 問題 |
|---------------|------|
| `PersonaLimitManager` | N+1クエリ |
| 複数コンポーネント | 独立ポーリングが画面非表示時にも停止しない |
| `PostingMetricsDashboard` | 大量データの再レンダリング |

---

## 設定ファイル・DB構成レビュー

### `package.json`

| 問題 | 深刻度 |
|------|--------|
| `@playwright/test`が`dependencies`にある | 🟠 |
| `next-themes`をViteプロジェクトで使用 | 🟡 |
| `eslint-plugin-react-hooks`がRC版 | 🟡 |
| テストスクリプト未定義 | 🟢 |

### `tsconfig.app.json`

| 問題 | 深刻度 |
|------|--------|
| `strict: false` | 🔴 |
| `strictNullChecks: false` | 🔴 |
| `noImplicitAny: false` | 🔴 |
| `noFallthroughCasesInSwitch: false` | 🟡 |

### `vite.config.ts`

| 問題 | 深刻度 |
|------|--------|
| `Access-Control-Allow-Origin: *` + `Allow-Credentials: true`が矛盾 | 🟡 |
| CSPに`'unsafe-eval'`と`'unsafe-inline'` | 🟠 |
| セキュリティヘッダーが開発サーバーのみ | 🟡 |

### `index.html`

| 問題 | 深刻度 |
|------|--------|
| CSPに`'unsafe-eval'`+`'unsafe-inline'`（vite.configと二重定義） | 🟠 |
| Supabase Project IDがCSPに直書き | 🟡 |
| `lang="en"`（日本語アプリ） | 🟡 |

### `supabase/config.toml`

| 問題 | 深刻度 |
|------|--------|
| 21個のEdge Functionで`verify_jwt = false` | 🔴 |
| `admin-reset-password`が`verify_jwt = false` | 🔴 |
| `site_url`がlocalhost | 🟡 |

### DB構成（RLS・インデックス）

| 項目 | 状態 |
|------|------|
| 主要テーブルのRLS | ✅ 有効（`auth.uid() = user_id`） |
| 管理者ロールチェック | ✅ `is_admin()`関数 |
| `security_events`等のuser_id制約 | ⚠️ NULL許可 |
| `SECURITY DEFINER`関数の`search_path` | ⚠️ 一部未設定（修正マイグレーションあり） |
| `personas`の平文トークン | 🔴 残存 |

---

## 横断的な問題

### CORS設定

```
全Edge Functions: Access-Control-Allow-Origin: *
→ 本番オリジンに限定すべき
```

### Edge Functions 依存ライブラリバージョン不統一

| ライブラリ | 使用バージョン |
|-----------|---------------|
| `deno.land/std/http/server.ts` | `@0.168.0`, `@0.190.0` |
| `@supabase/supabase-js` | `@2`, `@2.7.1`, `@2.39.3`, `@2.50.0` |

### コンソールログ過多

ほぼ全ファイルで`import.meta.env.DEV`による条件分岐なしに`console.log`/`console.warn`が多数存在。プロダクションビルドでセッション状態、ユーザーID、トークン有効性などの機微情報がブラウザコンソールに出力される。

### ストレージクリア方式の混在

| ファイル | 方式 | リスク |
|---------|------|--------|
| `AuthContext.tsx` | `sb-`プレフィックスのみ削除 | ✅ 安全 |
| `authHandler.ts` | `sb-`プレフィックスのみ削除 | ✅ 安全 |
| `authSecurity.ts` | `sessionStorage.clear()` | ⚠️ 危険 |
| `client.ts` | `localStorage.clear()` + `sessionStorage.clear()` | 🔴 最も危険 |

---

## 推奨対応の優先順位

### Phase 1: 緊急セキュリティ対応（今すぐ）

| # | 対応内容 | 対象 |
|---|---------|------|
| 1 | `.gitignore`に`.env*`を追加 + Git履歴からシークレット削除 | `.gitignore` |
| 2 | テスト用Edge Function 12個を本番から削除 | `supabase/functions/test-*` 等 |
| 3 | `verify_jwt = true`をセキュリティ関連Edge Functionに設定 | `supabase/config.toml` |
| 4 | CORS設定を本番オリジンに限定 | 全Edge Functions |
| 5 | 画像生成Edge Functionsに認証追加 | `generate-image-*` |

### Phase 2: 重要な修正（1週間以内）

| # | 対応内容 | 対象 |
|---|---------|------|
| 6 | `client.ts`を環境変数参照に修正 | `src/integrations/supabase/client.ts` |
| 7 | `_shared/crypto.ts`のPBKDF2ソルト修正 + タイミング攻撃対策 | `supabase/functions/_shared/crypto.ts` 等 |
| 8 | `localStorage.clear()`をプレフィックスベース削除に統一 | `client.ts`, `authSecurity.ts` |
| 9 | CSPから`unsafe-eval`/`unsafe-inline`除去 | `index.html`, `vite.config.ts` |
| 10 | Gemini API呼び出しをヘッダー方式に変更 | 各Edge Function |
| 11 | `send-password-reset`にレート制限追加 | `send-password-reset/` |

### Phase 3: 品質改善（1-2週間）

| # | 対応内容 | 対象 |
|---|---------|------|
| 12 | TypeScript `strict: true`への段階的移行 | `tsconfig.app.json` |
| 13 | `containsSqlInjection`の修正/削除 | `src/lib/validation.ts` |
| 14 | Realtime無効化と使用箇所の不整合解消 | `client.ts`, hooks |
| 15 | コンソールログのプロダクション制御 | 全ファイル |
| 16 | トークン検証ロジックの一元化 | `client.ts`, `authHelpers.ts`, `AuthContext.tsx` |
| 17 | `atob()`をbase64url対応デコーダーに置換 | 3箇所 |

### Phase 4: 継続的改善

| # | 対応内容 | 対象 |
|---|---------|------|
| 18 | `CreatePosts.tsx`の分割リファクタリング | `CreatePosts.tsx` |
| 19 | アクセシビリティ改善（`aria-label`追加等） | 全コンポーネント |
| 20 | DBマイグレーションの統合（221→スキーマ整理） | `supabase/migrations/` |
| 21 | Edge Functions依存バージョン統一 | 各Edge Function |
| 22 | E2Eテストの拡充 | `e2e/` |
| 23 | `useImageGenerator`の`useReducer`化 | `useImageGenerator.ts` |
| 24 | `PersonaLimitManager`のN+1クエリ解消 | `PersonaLimit/` |
| 25 | `personas`テーブルの平文トークンカラム廃止 | DB migration |

---

> **レポート終了**  
> 検出問題合計: 致命的9件 + 重大12件 + 中程度18件 + 低10件 = **49件**

---

## 追補（2026-03-03 再検証）: 現在も修正が必要な箇所

> この追補は、上記レポート内容を現行コードに照合して「未修正の不備のみ」を抽出したもの。

### ✅ 修正が必要（仕様・ロジック不整合）

| 優先度 | 区分 | 不備 | 対象 |
|---|---|---|---|
| 🔴 High | Edge Function | `check-replies` の `processScheduledReplies()` でペルソナ取得時に `is_active=true` 条件が無く、非アクティブ設定ユーザーの予約返信が送信されうる | `supabase/functions/check-replies/index.ts` |
| 🔴 High | Edge Function | キーワード判定ロジックが `threads-webhook` / `check-replies` / `process-unhandled-replies` で重複し、正規化方式（NFC/NFD等）が不一致。経路によって判定結果が変わる | `supabase/functions/threads-webhook/index.ts`, `supabase/functions/check-replies/index.ts`, `supabase/functions/process-unhandled-replies/index.ts` |
| 🟠 Med | Edge Function | `process-unhandled-replies` が逐次処理 + 固定待機（2秒）+ 返信送信前待機（5秒）を含み、件数増加時に実行時間超過リスクが高い | `supabase/functions/process-unhandled-replies/index.ts` |
| 🟠 Med | Edge Function | テスト用関数が本番コードに残存し、`SUPABASE_SERVICE_ROLE_KEY` で広範囲データ参照を行う実装が存在 | `supabase/functions/test-*`, `supabase/functions/*-test` |
| 🟠 Med | Security/Logic | `_shared/crypto.ts` にレガシー固定salt (`'salt'`) と `padEnd(32, '0')` ベース鍵整形が残り、暗号運用の一貫性と強度の観点で改善余地 | `supabase/functions/_shared/crypto.ts` |
| 🟠 Med | Frontend/Runtime | Supabase Realtime をクライアント全体で無効化している一方、監視系Hookは Realtime channel 前提で実装。通知系機能の実動と実装意図が不一致 | `src/integrations/supabase/client.ts`, `src/hooks/usePersonaLimit.ts`, `src/hooks/useThreadsRateLimitAlert.ts` |

### ⚠️ 表現修正が必要（不備自体は解消済み／現行と不一致）

| 項目 | 再検証結果 |
|---|---|
| `auto-scheduler`, `refresh-threads-tokens` が無認証公開 | **解消済み**。`verify_jwt=true` + `x-cron-secret` 検証あり |
| `generate-posts` でキー取得・復号が内側ループで毎回実行 | **解消済み**。APIキー配列はループ外で一度取得 |
| `generate-posts` の `extractHashtags` 未使用 | **解消済み**。生成本文から抽出して保存済み |
| `save-secret` と `crypto.ts` の暗号方式不整合 | **解消済み**。`save-secret` は共通 `encryptValue()` を使用 |
| `self-reply-processor` が暗号文トークンをそのまま送信 | **解消済み**。`decryptIfNeeded()` で復号後に送信 |
| `reply_status: failed/failed` の無意味分岐 | **現行では未検出** |

### 直近対応アクション（最小）

1. `check-replies` の `processScheduledReplies()` で `personas` 取得時に `is_active=true` 条件を追加。  
2. キーワード判定を `_shared` モジュールへ集約し、3関数で共通利用。  
3. `process-unhandled-replies` は1実行あたりの上限件数を厳格化し、待機戦略をバッチ/再入可能設計へ変更。  
4. テスト用Edge Functionを本番デプロイ対象から除外（または削除）。
