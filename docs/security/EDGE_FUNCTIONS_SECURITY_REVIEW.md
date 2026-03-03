# Supabase Edge Functions 包括的セキュリティレビュー

**レビュー日時**: 2025年  
**対象**: `supabase/functions/` 配下の全プロダクション関数（31関数 + _shared）  
**レビュー範囲**: セキュリティ、エラーハンドリング、パフォーマンス、コード品質

---

## 目次

1. [エグゼクティブサマリー](#1-エグゼクティブサマリー)
2. [重大度別セキュリティ問題一覧](#2-重大度別セキュリティ問題一覧)
3. [関数別詳細レビュー](#3-関数別詳細レビュー)
4. [横断的セキュリティ問題](#4-横断的セキュリティ問題)
5. [推奨修正優先度](#5-推奨修正優先度)

---

## 1. エグゼクティブサマリー

### 全体評価: ⚠️ 要改善（中〜高リスク）

| カテゴリ | 件数 |
|---------|------|
| 🔴 致命的（Critical） | 5件 |
| 🟠 重大（High） | 8件 |
| 🟡 中程度（Medium） | 12件 |
| 🔵 低い（Low） | 10件 |

### 主要な問題

1. **認証欠如**: 31関数中、約16関数にリクエスト認証（JWT検証）がない
2. **CORS全開放**: 全関数で `Access-Control-Allow-Origin: '*'` を使用
3. **暗号化の脆弱性**: PBKDF2のソルトがハードコード `'salt'`、鍵パディングが脆弱
4. **タイミング攻撃**: 2つのWebhookセキュリティ関数で `===` による署名比較
5. **APIキー漏洩リスク**: Gemini APIキーがURLクエリパラメータに含まれる（サーバーログに記録される可能性）

---

## 2. 重大度別セキュリティ問題一覧

### 🔴 致命的（Critical）

| # | 問題 | 該当関数 | 説明 |
|---|------|---------|------|
| C1 | PBKDF2ソルトのハードコード | `_shared/crypto.ts` | `'salt'` がハードコードされており、レインボーテーブル攻撃に対して脆弱 |
| C2 | 暗号化鍵のパディング | `_shared/crypto.ts`, `save-secret` | `encryptionKey.padEnd(32, '0')` で鍵が32バイト未満の場合 `'0'` でパディング。鍵のエントロピーが大幅に低下 |
| C3 | 認証なしの管理操作 | `auto-scheduler-fix`, `fix-inactive-personas`, `fix-stuck-ai-replies`, `reset-stuck-ai-replies` | service_role_keyでDB変更を行うが、呼び出し元の認証チェックなし。URLを知っていれば誰でも実行可能 |
| C4 | Webhook検証バイパス | `threads-webhook` | ペイロード検証失敗時に「後方互換モード」として検証なしで処理を続行 |
| C5 | タイミング安全でない署名比較 | `secure-webhook-handler`, `enhanced-webhook-security` | `===` 演算子で HMAC 署名を比較しており、タイミング攻撃に脆弱 |

### 🟠 重大（High）

| # | 問題 | 該当関数 | 説明 |
|---|------|---------|------|
| H1 | CORS全開放 | **全関数** | `Access-Control-Allow-Origin: '*'` により任意のオリジンからのリクエストを許容 |
| H2 | APIキーのURL露出 | `auto-post-generator`, `generate-image-prompt`, `generate-posts`, `threads-auto-reply`, `check-replies`, `process-unhandled-replies` | Gemini APIキーがURL `?key=xxx` に含まれ、ログやネットワーク監視で漏洩するリスク |
| H3 | module-level可変ステート | `check-replies`, `process-unhandled-replies` | Denoの warm instance でモジュールレベルの `supabase` クライアントや `Set` が永続化し、メモリリーク・状態汚染の可能性 |
| H4 | OAuth callbackの認証なし | `threads-oauth-callback` | 認証ヘッダーチェックなし。CSRF保護なし（`state` パラメータ未検証） |
| H5 | パスワード強度不十分 | `admin-reset-password` | 最低8文字チェックのみ。大文字/小文字/数字/特殊文字の要件なし |
| H6 | service_role_key直接使用 | 多数の関数 | JWT認証なしでservice_role_keyを使用し、RLSをバイパス |
| H7 | ハードコードされたリダイレクトURL | `threads-oauth-callback`, `send-password-reset` | `'https://threads-genius-ai.lovable.app/'` がハードコード。フィッシング攻撃に悪用可能 |
| H8 | supabase-jsバージョン不整合 | 全体 | `2.7.1`, `2`, `2.47.10`, `2.50.0` と複数バージョンが混在。セキュリティパッチの適用状況が不統一 |

### 🟡 中程度（Medium）

| # | 問題 | 該当関数 | 説明 |
|---|------|---------|------|
| M1 | 入力検証不足 | 多数 | Zodスキーマ検証は `threads-webhook` と `generate-auto-reply` のみ。他はreq.json()を直接信頼 |
| M2 | エラーメッセージの情報漏洩 | 多数 | エラーレスポンスにスタックトレースや内部詳細が含まれる場合がある |
| M3 | レート制限の一貫性なし | 全体 | 各関数で独自のレート制限実装。統一的なミドルウェアなし |
| M4 | sendThreadsReplyでaccess_tokenがbodyに | `check-replies`, `process-unhandled-replies` | Threads APIへのPOSTリクエストのbodyにaccess_tokenを含めている |
| M5 | 非効率なレート制限クエリ | `secure-webhook-handler` | security_eventsテーブルの直接カウントでレート制限チェック（インデックスがなければ遅い） |
| M6 | normalizeEmojiAndText関数の不一致 | `check-replies` vs `process-unhandled-replies` | 同じ目的の関数が異なる実装を持つ（NFD正規化の有無） |
| M7 | 暗号化キーの平文判定ヒューリスティック | `_shared/crypto.ts` | `isEncrypted()` が文字列長40以下を平文と判断 — 短い暗号文を誤判定する可能性 |
| M8 | Gemini APIキーの使い切り時にフォールバックなし | `threads-auto-reply` 等 | 全キーが枯渇した場合のグレースフルなフォールバック戦略がない |
| M9 | 画像生成関数の認証不足 | `generate-image-gradio`, `generate-image-huggingface` | JWT認証チェックなし |
| M10 | listUsersの全ユーザー取得 | `admin-reset-password` | `auth.admin.listUsers()` で全ユーザーを取得してからフィルタ — ユーザー数増加時にパフォーマンス問題 |
| M11 | retry_countの三項演算子の冗長性 | `process-unhandled-replies` | `newRetryCount >= maxRetries ? 'failed' : 'failed'` で条件分岐の結果が同一 |
| M12 | 無限ループリスク | `check-replies` | `MAX_PROCESS_COUNT=100` は設定されているが、APIタイムアウトが設定されていない |

### 🔵 低い（Low）

| # | 問題 | 該当関数 | 説明 |
|---|------|---------|------|
| L1 | console.logによる機密情報漏洩 | 多数 | トークン復号成功メッセージ等がログに出力される |
| L2 | 未使用のインポート | 複数 | `decryptIfNeeded` をインポートしているが使用していない関数がある |
| L3 | TODO/FIXMEの残存 | 複数 | コード中に未解決のコメントが散在 |
| L4 | コード重複 | `check-replies`, `process-unhandled-replies`, `threads-webhook` | 同一ロジック（キーワードマッチ、返信送信、トークン取得）が3箇所以上で重複 |
| L5 | Date.now()の多用 | 多数 | DBサーバー時刻との微妙なずれが生じ得る |
| L6 | エラーレスポンスのステータスコード不統一 | 一部 | 400と500の使い分けが不統一。例: `save-secret` は認証エラーでも400を返す |
| L7 | XHRポリフィルの不要なインポート | `process-unhandled-replies` 等 | `https://deno.land/x/xhr@0.1.0/mod.ts` のインポートが不要な場合がある |
| L8 | 型安全性の不足 | 多数 | `any` 型が多用されている |
| L9 | Resend送信元アドレスの制限 | `send-password-reset` | `onboarding@resend.dev` はテスト用で本番には不適切 |
| L10 | generate-image-stable-diffusion認証不足 | `generate-image-stable-diffusion` | リクエストにpersona_idを含むが所有者チェックなし |

---

## 3. 関数別詳細レビュー

---

### 3.1 `_shared/crypto.ts`（256行）

**機能**: 全Edge Functionsの暗号化/復号ユーティリティ。AES-256-GCM（raw key方式）と PBKDF2-AES-GCM（レガシー方式）のデュアルモード復号、HMAC-SHA256署名検証。

**セキュリティ問題**:

| 重大度 | 問題 | 行番号 | 詳細 |
|--------|------|--------|------|
| 🔴 | PBKDF2ソルトのハードコード | ~180行 | `const salt = encoder.encode('salt');` — 全ユーザーで同一ソルト。レインボーテーブル攻撃に脆弱 |
| 🔴 | 鍵パディング | ~50行 | `encryptionKey.padEnd(32, '0').slice(0, 32)` — 短い鍵は '0' でパディングされ、実効エントロピーが低下 |
| 🟡 | `isEncrypted()` のヒューリスティック | ~85行 | base64正規表現と長さ40判定。短いbase64エンコード値を誤って平文と判定する可能性 |
| 🔵 | PBKDF2反復回数 | ~185行 | `100000` 回は現時点では十分だが、将来的に増加が必要 |

**推奨修正**:
```typescript
// ❌ 現在
const salt = encoder.encode('salt');
encryptionKey.padEnd(32, '0').slice(0, 32)

// ✅ 推奨
// ソルトは各暗号化時にランダム生成し、暗号文と共に保存
const salt = crypto.getRandomValues(new Uint8Array(16));
// 鍵は環境変数で厳密に32バイトを要求
if (new TextEncoder().encode(encryptionKey).length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 bytes');
}
```

---

### 3.2 `threads-post/index.ts`（969行）

**機能**: Threads APIへの投稿（テキスト、画像、カルーセル）。レート制限（10投稿/時）、タイムゾーン対応スケジューリング。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟠 | 認証なし | リクエストにJWT認証チェックなし。persona_idとuser_idをbodyから直接取得 |
| 🟠 | CORS全開放 | `Access-Control-Allow-Origin: '*'` |
| 🟡 | 入力検証不足 | `req.json()` の結果をそのまま使用。persona_idの形式チェックなし |
| 🟡 | `retrieve-secret` への内部呼び出し | `supabase.functions.invoke('retrieve-secret')` の結果に対して、呼び出し元の認証はretrieve-secret側に依存 |

**コード品質**:
- タイムゾーン処理が複雑で、`getJSTHour()` と `getTimezoneHour()` の2つのアプローチが共存
- 969行と長大。投稿タイプ別にモジュール分割を推奨

---

### 3.3 `threads-webhook/index.ts`（1190行）

**機能**: Meta Webhookコールバック受信。HMAC署名検証、Zodペイロード検証、返信通知処理。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🔴 | 検証バイパス | ペイロードのZod検証失敗時に「後方互換モード」として検証なしで処理続行。攻撃者が不正ペイロードを送信可能 |
| 🟠 | URL paramsの未検証 | `url.searchParams.get('persona_id')` を認証なしで使用 |
| 🟡 | レート制限の実装 | DB-basedレート制限（60/min）だが、レート制限チェック中のDBエラーで処理続行 |

**推奨修正**:
```typescript
// ❌ 現在: 検証失敗時もフォールバック処理
if (!validationResult.success) {
  console.warn('⚠️ backward compatibility mode');
  // 検証なしで処理続行...
}

// ✅ 推奨: 検証失敗は即座にリジェクト
if (!validationResult.success) {
  return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
}
```

---

### 3.4 `threads-auto-reply/index.ts`（503行）

**機能**: Gemini AIで自動返信を生成し、Threads APIで送信。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟠 | 認証なし | リクエストに認証チェックなし |
| 🟠 | APIキーのURL露出 | `key=${apiKey}` がURLに含まれる |
| 🟡 | アトミックロック | 二重送信防止のロックはあるが、ロックタイムアウトが未設定 |

---

### 3.5 `threads-oauth-callback/index.ts`

**機能**: OAuth認証コード→短期トークン→長期トークンのフロー処理。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟠 | 認証なし | JWT認証チェックなし。OAuthコード自体が認証の一部だが、stateパラメータのCSRF検証なし |
| 🟠 | ハードコードURL | `redirect_uri: 'https://threads-genius-ai.lovable.app/auth/callback'` がフォールバック |
| 🟡 | OAuthコードの検証不足 | codeパラメータの形式チェックなし |

---

### 3.6 `auto-post-generator/index.ts`（1236行）

**機能**: 自動投稿の生成・スケジューリング（通常、ランダム、テンプレート方式）。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟠 | 認証なし | cronジョブとして設計されているが、直接呼び出しに対する防御なし |
| 🟠 | APIキーのURL露出 | Gemini API keyがURLに含まれる |
| 🟡 | 楽観的同時実行制御 | 重複投稿防止のハッシュチェックはあるが、完全な排他制御ではない |

**コード品質**:
- 1236行と非常に長大。タイムゾーン処理が複数箇所に重複
- `getJSTHour()`, `getTimezoneHour()`, `getCurrentDate()` と類似関数が多数

---

### 3.7 `auto-scheduler/index.ts`（522行）

**機能**: スケジュール済み投稿の処理。threads-post関数を呼び出し。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟠 | 認証なし | cronジョブとして設計されているが認証なし |
| 🟡 | 内部関数呼び出しの認証パス | `supabase.functions.invoke('threads-post')` は内部呼び出しだがservice role keyを使用 |

**良い点**:
- アトミックロック、指数バックオフによるリトライ、ペルソナごとのスロットリングが実装済み

---

### 3.8 `auto-scheduler-fix/index.ts`

**機能**: メンテナンス関数 — スタック状態の修復、重複削除、孤立エントリーのクリーンアップ。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🔴 | 認証なし | DB操作（削除を含む）を行うが呼び出し元の検証なし |

---

### 3.9 `generate-posts/index.ts`

**機能**: Geminiを使ったバッチ投稿生成。

**セキュリティ問題**: 
- ✅ JWT認証あり（`supabase.auth.getUser()`）
- ✅ ペルソナ所有者チェックあり
- 🟠 APIキーのURL露出

**良い点**: 数少ない認証実装済み関数の一つ。

---

### 3.10 `generate-auto-reply/index.ts`

**機能**: Gemini AIで返信テキストを生成。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟡 | 認証なし | 入力検証（Zod）はあるが、認証チェックなし |
| 🟡 | レート制限 | 30/min/persona — DB-basedだが認証なしのため回避可能 |

---

### 3.11 `check-replies/index.ts`（927行）

**機能**: Threads APIをポーリングして新規返信を取得し、自動返信処理をトリガー。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟠 | module-level可変ステート | `const processedPersonas = new Set<string>()` と `let processCount = 0` がモジュールレベル。Denoの warm instance で複数リクエスト間で状態が汚染される |
| 🟠 | 認証なし | cronジョブとして設計されているが認証なし |
| 🟡 | normalizeEmojiAndText の実装差異 | `process-unhandled-replies` 版と異なる正規化ロジック（NFD正規化を使用） |

---

### 3.12 `check-token-health/index.ts`

**機能**: Threadsアクセストークンの有効性チェック。

**セキュリティ問題**: 
- ✅ JWT認証あり
- 良い実装

---

### 3.13 `refresh-threads-tokens/index.ts`

**機能**: 期限切れ間近のトークンを自動更新（7日以内）。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟡 | 認証なし | cronジョブとして設計。外部からの不正呼び出しで全トークンが更新される可能性 |

---

### 3.14 `secure-webhook-handler/index.ts`

**機能**: 汎用Webhookハンドラ。HMAC検証付き。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🔴 | タイミング安全でない署名比較 | `expectedSignature === receivedSignature` で `===` を使用 |
| 🟡 | 単一Webhook Secret | `WEBHOOK_SECRET` が全ペルソナ共通。ペルソナごとの検証ができない |
| 🟡 | 非効率なレート制限 | `security_events` テーブルの直接カウントでレート制限チェック |

**推奨修正**:
```typescript
// ❌ 現在: タイミング攻撃に脆弱
if (expectedSignature === receivedSignature) { ... }

// ✅ 推奨: _shared/crypto.ts のverifyHmacSignatureを使用（定数時間比較）
import { verifyHmacSignature } from '../_shared/crypto.ts';
const isValid = await verifyHmacSignature(payload, receivedSignature, secret);
```

---

### 3.15 `enhanced-webhook-security/index.ts`

**セキュリティ問題**: `secure-webhook-handler` と同一の問題（タイミング安全でない `===` 比較）。

---

### 3.16 `webhook-reply-check/index.ts`

**機能**: Webhook駆動の返信チェック。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟠 | 認証なし | service_role_keyを使用するが呼び出し元認証なし |
| 🟡 | Promise.allの並列処理 | 大量ペルソナでAPI制限に抵触する可能性 |

---

### 3.17 `self-reply-processor/index.ts`

**機能**: ボットの自己返信処理。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟠 | トークン復号なし | `persona.threads_access_token` を直接使用（暗号化済みの場合に失敗する） |
| 🟠 | 認証なし | 呼び出し元検証なし |

---

### 3.18 `detect-rate-limited-personas/index.ts`

**機能**: エラーパターン分析によるレート制限ペルソナの検出・管理。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟡 | 認証なし | cronジョブとして設計。認証なし |

---

### 3.19 `fetch-threads-user-ids/index.ts`

**機能**: 欠落している `threads_user_id` のバッチ取得。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟡 | 認証なし | cronジョブとして設計 |
| 🔵 | バッチサイズ固定 | 20件固定。動的調整なし |

---

### 3.20 `fix-inactive-personas/index.ts`

**セキュリティ問題**: 認証なし。DB更新操作を含む。

---

### 3.21 `fix-stuck-ai-replies/index.ts`

**セキュリティ問題**: 認証なし。DB更新操作を含む。

---

### 3.22 `reset-stuck-ai-replies/index.ts`

**セキュリティ問題**: 認証なし。一括DB更新（`retry_count: 0` にリセット）を含む。

---

### 3.23 `process-unhandled-replies/index.ts`（940行）

**機能**: 未処理返信の再処理。テンプレート/AI返信の統合処理。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟠 | module-level supabaseクライアント | モジュールレベルで `createClient()` を呼び出し — warm instanceで状態が持続 |
| 🟠 | 認証なし | 大量のDB操作を行うが認証チェックなし |
| 🟡 | ステータス三項演算子の冗長性 | `newRetryCount >= maxRetries ? 'failed' : 'failed'` — 条件にかかわらず同じ値 |

---

### 3.24 `admin-reset-password/index.ts`

**機能**: 管理者によるパスワードリセット。

**セキュリティ**:
- ✅ JWT認証あり
- ✅ 管理者権限チェック（`is_admin` RPC）
- ✅ セキュリティイベントログ記録
- 🟠 `auth.admin.listUsers()` で全ユーザー取得（パフォーマンス問題）
- 🟡 パスワード強度チェックが8文字最低のみ

---

### 3.25 `retrieve-secret/index.ts`

**機能**: DB保存された暗号化APIキーの取得・復号。

**セキュリティ**:
- ✅ JWT認証あり
- ✅ IDOR対策（ペルソナ所有者チェック）
- ✅ セキュリティイベントログ記録
- **もっとも模範的な実装**

---

### 3.26 `save-secret/index.ts`

**機能**: APIキーの暗号化保存。

**セキュリティ**:
- ✅ JWT認証あり
- 🔴 暗号化鍵のパディング問題（`crypto.ts` と同じ `padEnd(32, '0')` パターン）
- 🟡 `_shared/crypto.ts` を使用せず独自に暗号化を実装。不一致の可能性

---

### 3.27 `send-password-reset/index.ts`

**機能**: パスワードリセットメール送信。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟠 | ハードコードURL | `redirectTo: "https://threads-genius-ai.lovable.app/auth/reset-password"` |
| 🟡 | 認証なし | メール送信に認証不要（意図的にユーザー存在を隠すため） |
| 🔵 | Resend DNS設定 | `onboarding@resend.dev` はテスト用ドメイン |

---

### 3.28 `generate-image-gradio/index.ts`

**機能**: Gradio経由の画像生成。

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟡 | 認証なし | 誰でも画像生成を呼び出せる（コスト発生リスク） |
| 🟡 | SSRF リスク | `space_url` をユーザー入力から直接使用。任意のURLに接続可能 |

---

### 3.29 `generate-image-huggingface/index.ts`

**セキュリティ問題**: `generate-image-gradio` と同様。認証なし。

---

### 3.30 `generate-image-prompt/index.ts`

**セキュリティ**:
- ✅ JWT認証あり
- 🟡 プロンプトインジェクション耐性が低い（`postContent` がプロンプトに直接埋め込み）

---

### 3.31 `generate-image-stable-diffusion/index.ts`

**セキュリティ問題**:

| 重大度 | 問題 | 詳細 |
|--------|------|------|
| 🟡 | 認証なし | persona_idのみで所有者チェックなし |
| 🟡 | 外部API URLの検証不足 | `api_url` パラメータの検証が `validation.ts` に依存 |

---

## 4. 横断的セキュリティ問題

### 4.1 認証（Authentication）

**現状の認証マトリクス**:

| 認証レベル | 関数 |
|-----------|------|
| ✅ JWT + 管理者権限 | `admin-reset-password` |
| ✅ JWT + IDOR対策 | `retrieve-secret` |
| ✅ JWT認証 | `save-secret`, `generate-posts`, `check-token-health`, `generate-image-prompt` |
| ⚠️ Webhook署名のみ | `threads-webhook`, `secure-webhook-handler`, `enhanced-webhook-security` |
| ❌ 認証なし | **その他全て（約20関数）** |

**推奨**: cronジョブであっても、Supabaseの cron invocation 以外からのリクエストを拒否するためのシークレットベースの認証を追加すべき。

```typescript
// 推奨: cron関数用の認証ミドルウェア
const cronSecret = Deno.env.get('CRON_SECRET');
const reqSecret = req.headers.get('x-cron-secret');
if (cronSecret && reqSecret !== cronSecret) {
  return new Response('Unauthorized', { status: 401 });
}
```

### 4.2 CORS

全関数で `Access-Control-Allow-Origin: '*'` が使用されている。

**推奨**:
```typescript
const allowedOrigins = [
  'https://threads-genius-ai.lovable.app',
  'http://localhost:5173',  // 開発環境のみ
];

const origin = req.headers.get('origin') || '';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### 4.3 暗号化アーキテクチャ

**問題**:
1. `save-secret` と `_shared/crypto.ts` が独立した暗号化実装を持つ
2. PBKDF2のソルト `'salt'` がハードコード
3. 鍵パディング `padEnd(32, '0')` がエントロピーを低下させる

**推奨**:
- 暗号化処理を `_shared/crypto.ts` に一元化
- ランダムソルトを暗号文と共に保存
- ENCRYPTION_KEY に厳密な32バイト要件を設ける

### 4.4 APIキー管理

**問題**: Gemini APIキーがURL `?key=xxx` に含まれる

```typescript
// ❌ 現在
fetch(`https://generativelanguage.googleapis.com/.../generateContent?key=${apiKey}`, ...)

// ✅ 推奨: ヘッダー方式
fetch('https://generativelanguage.googleapis.com/.../generateContent', {
  headers: {
    'x-goog-api-key': apiKey,
    'Content-Type': 'application/json'
  },
  body: ...
})
```

### 4.5 依存関係の一貫性

| パッケージ | 使用バージョン |
|-----------|--------------|
| `@supabase/supabase-js` | `2`, `2.7.1`, `2.47.10`, `2.50.0` |
| `deno.land/std` | `0.168.0`, `0.190.0` |

**推奨**: 共通の `_shared/deps.ts` で依存関係を一元管理。

### 4.6 コード重複

以下のロジックが3箇所以上で重複:

1. **`normalizeEmojiAndText()`**: `threads-webhook`, `check-replies`, `process-unhandled-replies` — 各々微妙に異なる実装
2. **`getAccessToken()`**: `check-replies`, `process-unhandled-replies` — ほぼ同一
3. **`sendThreadsReply()`**: `check-replies`, `process-unhandled-replies` — 異なるシグネチャ
4. **`processTemplateAutoReply()`**: `check-replies`, `process-unhandled-replies` — ほぼ同一
5. **`logActivity()`**: 複数関数に重複
6. **Gemini API呼び出し + キーローテーション**: 複数関数に重複

**推奨**: `_shared/` に共通ユーティリティとして抽出。

---

## 5. 推奨修正優先度

### Phase 1: 即座に対応（1-2日）

| # | 対応 | 対象 |
|---|------|------|
| 1 | PBKDF2ソルトをランダム生成に変更 | `_shared/crypto.ts` |
| 2 | 鍵パディングの削除（32バイト厳密要件） | `_shared/crypto.ts`, `save-secret` |
| 3 | タイミング安全な署名比較の導入 | `secure-webhook-handler`, `enhanced-webhook-security` |
| 4 | Webhook検証バイパスの除去 | `threads-webhook` |
| 5 | Gemini APIキーをヘッダー方式に変更 | 全Gemini使用関数 |

### Phase 2: 短期対応（1週間）

| # | 対応 | 対象 |
|---|------|------|
| 6 | cronジョブ関数にシークレットベース認証を追加 | 全cron関数（約10関数） |
| 7 | ユーザー向け関数にJWT認証を追加 | `threads-post`, `threads-auto-reply`, 画像生成関数等 |
| 8 | CORSオリジン制限 | 全関数 |
| 9 | supabase-jsバージョンの統一 | 全関数 |
| 10 | module-level可変ステートの除去 | `check-replies`, `process-unhandled-replies` |

### Phase 3: 中期対応（2-4週間）

| # | 対応 | 対象 |
|---|------|------|
| 11 | 共通ユーティリティの `_shared/` 抽出 | 重複コード全般 |
| 12 | 統一的なレート制限ミドルウェアの導入 | 全関数 |
| 13 | 入力検証（Zod）の全関数統一 | 全関数 |
| 14 | エラーレスポンスの標準化 | 全関数 |
| 15 | 大規模関数のモジュール分割 | `threads-post`, `auto-post-generator`, `check-replies`, `process-unhandled-replies` |

### Phase 4: 長期対応

| # | 対応 | 対象 |
|---|------|------|
| 16 | 暗号化スキーム移行（新ソルト方式） | 全暗号化データ |
| 17 | 型安全性の向上（`any` 型の排除） | 全関数 |
| 18 | E2Eテストの拡充 | 全関数 |
| 19 | ログ監査（機密情報の除去） | 全関数 |
| 20 | Resend送信元ドメインの本番設定 | `send-password-reset` |

---

## 付録: 認証が必須な関数一覧と推奨認証方式

| 関数 | 現在の認証 | 推奨認証方式 |
|------|-----------|-------------|
| `threads-post` | なし | JWT or cron-secret |
| `threads-auto-reply` | なし | 内部呼び出しのみ許可（cron-secret） |
| `auto-post-generator` | なし | cron-secret |
| `auto-scheduler` | なし | cron-secret |
| `auto-scheduler-fix` | なし | cron-secret + 管理者JWT |
| `check-replies` | なし | cron-secret |
| `process-unhandled-replies` | なし | cron-secret |
| `webhook-reply-check` | なし | cron-secret |
| `self-reply-processor` | なし | cron-secret |
| `detect-rate-limited-personas` | なし | cron-secret |
| `fetch-threads-user-ids` | なし | cron-secret |
| `fix-inactive-personas` | なし | cron-secret + 管理者JWT |
| `fix-stuck-ai-replies` | なし | cron-secret + 管理者JWT |
| `reset-stuck-ai-replies` | なし | cron-secret + 管理者JWT |
| `refresh-threads-tokens` | なし | cron-secret |
| `generate-image-gradio` | なし | JWT |
| `generate-image-huggingface` | なし | JWT |
| `generate-image-stable-diffusion` | なし | JWT + IDOR対策 |
| `generate-auto-reply` | なし | 内部呼び出しのみ許可 |
| `threads-oauth-callback` | なし | state + PKCE |
| `send-password-reset` | なし | レート制限強化（現状維持可） |

---

*本レビューは全31関数+ `_shared/crypto.ts` を対象に実施しました。テスト関数（`test-*`, `comprehensive-*`, `quality-*`, `final-*`）はプロダクションコードではないためレビュー対象外です。*
