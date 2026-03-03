# PersonaForge Threads Automaton — 包括的バグ監査レポート

**日時**: 2025年7月  
**対象**: personaforge-threads-automaton リポジトリ全体  
**監査ルール**: コード変更・PR作成・コミット一切禁止。読み取り専用調査のみ。

---

## 1. システム概要

| 項目 | 内容 |
|------|------|
| **フロントエンド** | React + Vite + TypeScript (SPA) |
| **バックエンド** | Supabase Edge Functions (Deno runtime, 44+関数) |
| **データベース** | Supabase PostgreSQL (28テーブル, 50+ RPC関数, 221マイグレーション) |
| **外部API** | Threads Graph API (Meta), Gemini 2.5 Flash (Google AI), Resend (メール) |
| **暗号化** | AES-256-GCM (raw key + PBKDF2 fallback), HMAC-SHA256 (Webhook検証) |
| **認証** | Supabase Auth + JWT, CRON_SECRET (スケジューラ), admin RPC (管理者) |
| **デプロイ** | https://threads-genius-ai.lovable.app |
| **プロジェクトID** | tqcgbsnoiarnawnppwia |

### 主要自動化フロー
1. **自動投稿**: `auto-post-generator` (CRON) → `auto-scheduler` (CRON) → `threads-post`
2. **Webhook自動返信**: `threads-webhook` (受信) → `threads-auto-reply` / テンプレート返信
3. **ポーリング返信チェック**: `check-replies` / `webhook-reply-check` (CRON) → 自動返信
4. **トークン管理**: `refresh-threads-tokens` (CRON) → Threads API token refresh
5. **スタック復旧**: `process-unhandled-replies` / `fix-stuck-ai-replies` / `reset-stuck-ai-replies`

---

## 2. バグ候補一覧

### P0 — 本番障害直結（認証崩壊・無限ループ・データ破壊）

---

#### BUG-001: マイグレーションSQLにservice_roleキーがハードコード（秘密鍵漏洩）

| 項目 | 内容 |
|------|------|
| **重度** | P0 — クリティカル |
| **カテゴリ** | セキュリティ / 秘密鍵漏洩 |
| **場所** | `supabase/migrations/` 内 複数ファイル |
| **根拠コード** | 20250930103604…sql L12, 20250924134959…sql L9,L23, 20251007001958…sql L51,L77, 20251016041242…sql L8, 20250629142738…sql L24 |

**証拠**: cron.schedule() のSQL内に以下2種類のJWTトークンがプレーンテキストで埋め込まれている:

1. **anon key** (`role: "anon"`) — 11ファイル25箇所
2. **service_role key** (`role: "service_role"`) — 6ファイル10箇所

**影響**: マイグレーションファイルはGitリポジトリに永続化されるため、リポジトリにアクセスできる全員がservice_roleキー（RLS完全バイパス）を取得可能。anonキー自体は公開想定だが、service_roleキーの漏洩は全テーブルの読み書き・削除が第三者から可能になる致命的問題。

**別のservice_roleキー断片**: 20250629142738…sql L24 に別キーが存在。鍵のローテーション途中の可能性があり、旧キーが失効していない場合は二重のリスク。

---

#### BUG-002: 複数Edge Functionに認証チェックなし（verify_jwt=false時に外部呼び出し可能）

| 項目 | 内容 |
|------|------|
| **重度** | P0 — クリティカル |
| **カテゴリ** | 認証 / アクセス制御欠如 |
| **場所** | 複数Edge Function |

config.toml では全関数が `verify_jwt = true` だが、ユーザー報告によると**本番環境では多くが `verify_jwt = false`** に設定されている。以下の関数はコード内部に認証チェックが一切ないため、`verify_jwt = false`の場合は誰でも呼び出せる:

| 関数名 | リスク |
|--------|--------|
| `threads-auto-reply` | 任意のペルソナIDで返信生成・送信を強制実行 |
| `auto-post-generator` | 全ペルソナのAI投稿を一斉トリガー（CRON_SECRET チェックなし） |
| `detect-rate-limited-personas` | 全ペルソナのレート制限フラグを操作 |
| `fix-stuck-ai-replies` | 送信済み返信をpendingに戻し二重送信を誘発 |
| `reset-stuck-ai-replies` | 全stuck返信を一斉リセット → 大量再処理 |
| `self-reply-processor` | 任意ペルソナの自己返信を強制実行 |
| `check-replies` | 全ペルソナの返信チェックと自動返信を強制実行 |
| `webhook-reply-check` | 同上 |
| `fetch-threads-user-ids` | 全ペルソナのThreadsプロフィール情報を取得 |

**影響**: 攻撃者が `POST https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/fix-stuck-ai-replies` を叩くだけで、全ユーザーの既送信返信がリセットされ大量の二重返信が発生する。`auto-post-generator` を連打すれば無制限のスパム投稿が生成される。

---

#### BUG-003: ボット間返信ループの不完全な防止

| 項目 | 内容 |
|------|------|
| **重度** | P0 — クリティカル |
| **カテゴリ** | 無限ループ / 自動化事故 |
| **場所** | `threads-webhook/index.ts`, `check-replies/index.ts`, `webhook-reply-check/index.ts` |

**証拠**: 自己返信検出ロジック:

```typescript
// threads-webhook/index.ts
const isSelf = reply.username === persona.threads_username || 
               reply.username === persona.name;

// check-replies/index.ts 
const isSelf = 
  thread.username === persona.name ||
  thread.username === persona.threads_username ||
  thread.owner_id === persona.user_id ||
  thread.author_id === persona.user_id;
```

**問題点**:
1. `persona.name`（表示名）とThreadsユーザー名は異なる可能性がある → 自分の返信を検出できない
2. **クロスペルソナのループ防止が皆無**: ペルソナAがペルソナBの投稿に返信 → Bのwebhookが発火しAに返信 → Aのwebhookが発火… = **無限ループ**
3. `webhook-reply-check` には自己返信チェックが `threads_username` と `persona.name` のみ（`owner_id`/`author_id` チェックなし）
4. ボットの返信には特別なマーカーがないため、他アカウントのボットとの間でもループが発生し得る

**影響**: 同一ユーザーが2つ以上のペルソナを運用し、互いの投稿に返信設定を有効にした場合、各WebhookトリガーでAPI呼び出しが指数関数的に増大。Threads APIのレート制限に到達するまで停止しない。

---

#### BUG-004: レート制限チェックのフェイルオープン設計

| 項目 | 内容 |
|------|------|
| **重度** | P0 |
| **カテゴリ** | セキュリティ / レート制限 |
| **場所** | `threads-webhook/index.ts` checkRateLimit関数, `send-password-reset/index.ts` |

**証拠** (threads-webhook): レート制限チェック関数でDB エラー時に `{ allowed: true }` を返す設計。

**証拠** (send-password-reset): `checkRateLimit` でDBエラー時に `return false`（= レート制限なし）。

**影響**: DBエラー発生時、レート制限が無効化されWebhook処理やパスワードリセットが無制限に実行される。DDoS攻撃やResource Exhaustionに対して脆弱。

---

#### BUG-005: OAuth callbackのstate検証がサーバーサイドで未実施

| 項目 | 内容 |
|------|------|
| **重度** | P0 |
| **カテゴリ** | 認証 / CSRF |
| **場所** | `threads-oauth-callback/index.ts` (サーバー), `ThreadsOAuthCallback.tsx` (クライアント) |

**証拠**: クライアント側 (`ThreadsOAuthCallback.tsx`) では `sessionStorage` に保存した state と URL パラメータの state を比較検証しているが、**サーバーサイド** (`threads-oauth-callback/index.ts`) はリクエストボディの `code` と `persona_id` のみを受け取り、state パラメータを一切検証していない。

```typescript
// ThreadsOAuthCallback.tsx (クライアント) - state検証あり
if (!returnedState || !savedState || returnedState !== savedState) {
  setStatus('error');
  return;
}

// threads-oauth-callback/index.ts (サーバー) - state検証なし
const { code, persona_id, redirect_uri } = await req.json();
```

**影響**: クライアント側のチェックはDevToolsでバイパス可能。攻撃者が直接Edge Functionを呼び出せば、任意のcodeとpersona_idの組み合わせでトークンを設定できる（CSRF攻撃）。ただし、有効なcodeの入手が前提条件。

---

### P1 — 自動化機能の障害（投稿失敗・返信重複・設定不整合）

---

#### BUG-006: トークンリフレッシュの非アトミック性（トークン消失リスク）

| 項目 | 内容 |
|------|------|
| **重度** | P1 |
| **カテゴリ** | データ整合性 / トークン管理 |
| **場所** | `refresh-threads-tokens/index.ts` |

**問題**: Threads APIで新トークンを取得した後にDB更新を行う。API呼び出しは成功したが（古いトークンはサーバー側で無効化）、DB更新が失敗した場合、有効なトークンが永久に失われる。

**影響**: 該当ペルソナの全自動化が停止し、手動でOAuth再認証が必要になる。

---

#### BUG-007: check-replies と webhook-reply-check の同時実行による返信二重処理

| 項目 | 内容 |
|------|------|
| **重度** | P1 |
| **カテゴリ** | 競合状態 / 重複処理 |
| **場所** | `check-replies/index.ts`, `webhook-reply-check/index.ts`, `threads-webhook/index.ts` |

**問題**: 3つの独立した経路が同じ返信を検出・処理する:
1. `threads-webhook` — Webhook受信時にリアルタイム処理
2. `check-replies` — CRONでポーリングし、未処理返信を自動返信処理まで実行
3. `webhook-reply-check` — CRONでポーリングし、同様に保存+自動返信トリガー

各経路は `reply_id` の重複チェックを行うが、**`check-replies` は返信保存後に即座に `threads-auto-reply` を invoke** する一方、`webhook-reply-check` も独立して同じ返信に対して `threads-auto-reply` を invoke する。`threads-auto-reply` 内のアトミックロック(`auto_reply_sent=false` チェック)で最終的に1回のみ送信されるが、失敗→リトライの競合でエッジケースの二重送信リスクが残る。

---

#### BUG-008: webhook-reply-check で自動返信のステータス管理が不完全

| 項目 | 内容 |
|------|------|
| **重度** | P1 |
| **カテゴリ** | ステータス管理 / 返信漏れ |
| **場所** | `webhook-reply-check/index.ts` checkRepliesForPersona() |

**証拠**: `webhook-reply-check` は新規返信を `reply_status: 'pending'` で保存後、`threads-auto-reply` を invoke するが:
- invoke成功時に `reply_status` を更新しない（pendingのまま）
- invoke失敗時もステータスを更新しない
- `check-replies` が同じ返信を `pending && auto_reply_sent=false` で検出し、再度 `threads-auto-reply` を呼ぶ可能性がある

`check-replies` 側はきちんとロック＋ステータス管理をしているが、`webhook-reply-check` はそれを行わない。

---

#### BUG-009: check-replies の processCount チェックが開始時にのみ実行

| 項目 | 内容 |
|------|------|
| **重度** | P1（軽度） |
| **カテゴリ** | ロジックエラー |
| **場所** | `check-replies/index.ts` L32-38 |

**証拠**:
```typescript
let processCount = 0;

// 処理数制限チェック ← この時点で processCount=0 なので必ず通過
if (processCount >= MAX_PROCESS_COUNT) {
  console.log('⚠️ 処理数制限に達しました。');
  return ...;
}
```

最初の `if` は `processCount=0` の時点で評価されるため、常にfalse。実質的なガードはループ内の `if (processCount > MAX_PROCESS_COUNT)` のみ。初期チェックはデッドコード。

---

#### BUG-010: auto-post-generator のタイムゾーン処理に重複コードとデッドブランチ

| 項目 | 内容 |
|------|------|
| **重度** | P1 |
| **カテゴリ** | ロジックエラー / タイムゾーン |
| **場所** | `auto-post-generator/index.ts` |

**問題**: `if (cfg.timezone === 'Asia/Tokyo')` の内部にもう一度同一条件の `if (cfg.timezone === 'Asia/Tokyo')` がネストされている。fallbackブランチ（else側）には到達不能なコードが含まれる。

**影響**: `Asia/Tokyo` 以外のタイムゾーン設定が正しく処理されない可能性。投稿が意図しない時刻にスケジュールされうる。

---

#### BUG-011: threads-post のキュー更新失敗時にposts ステータスをrevert するが、Threads上の投稿は既に公開済み

| 項目 | 内容 |
|------|------|
| **重度** | P1 |
| **カテゴリ** | データ整合性 |
| **場所** | `threads-post/index.ts` キュー更新ロジック |

**証拠**:
```typescript
// posts 更新成功後、queue 更新失敗時:
await supabase
  .from('posts')
  .update({ status: 'scheduled', published_at: null })
  .eq('id', postId);
throw new Error(`Post published but failed to update queue status`);
```

**影響**: Threads上には投稿が公開されているのに、DBではステータスが `scheduled` に戻る。次のCRONでauto-schedulerが同じ投稿を再度処理→二重投稿。

---

#### BUG-012: self-reply-processor に認証チェックなし

| 項目 | 内容 |
|------|------|
| **重度** | P1 |
| **カテゴリ** | 認証 / アクセス制御 |
| **場所** | `self-reply-processor/index.ts` |

**問題**: JWT検証もCRON_SECRETチェックもなし。`verify_jwt=false` の場合、外部から `{ limit: 20 }` で呼び出し可能。全ユーザーのpending self-reply jobsを処理してしまう。

---

### P2 — UI不整合・パフォーマンス・改善推奨

---

#### BUG-013: フロントエンド Supabase Realtime が無効化（スタブ化）されている

| 項目 | 内容 |
|------|------|
| **重度** | P2 |
| **カテゴリ** | 機能制限 / リアルタイム性 |
| **場所** | `src/integrations/supabase/client.ts` |

**証拠**:
```typescript
// Realtime globally disabled (CSP)
try {
  const noop = () => {};
  const stubChannel = () => { ... };
  (supabase as any).channel = stubChannel;
  (supabase as any).realtime = { channel: stubChannel, ... };
} catch {}
```

**影響**: Realtimeサブスクリプションが一切機能しない。UIは30秒ポーリング（`usePersonaLimit`, `useThreadsRateLimitAlert`）に依存。CSP制限が理由とのコメントだが、Realtimeが必要な機能（ライブ通知等）が追加された場合にサイレントに失敗する。

---

#### BUG-014: iOS Safariでの認証ポーリング間隔が10秒固定

| 項目 | 内容 |
|------|------|
| **重度** | P2 |
| **カテゴリ** | パフォーマンス / UX |
| **場所** | `src/contexts/AuthContext.tsx` |

**証拠**: `isIOSSafari` 検出時に `setInterval(checkAuthState, 10000)` で10秒ごとにセッションチェック。ユーザーがアイドル状態でも不要なAPIリクエストが継続する。

---

#### BUG-015: admin-reset-password が listUsers() で全ユーザーを取得

| 項目 | 内容 |
|------|------|
| **重度** | P2 |
| **カテゴリ** | パフォーマンス / スケーラビリティ |
| **場所** | `admin-reset-password/index.ts` |

**問題**: パスワードリセット対象ユーザーをメールアドレスで検索するために `supabase.auth.admin.listUsers()` を使用。ユーザー数が増大するとメモリ使用量とレスポンス時間が線形に増加。

---

#### BUG-016: `_shared/crypto.ts` の isEncrypted が短い暗号化値を誤判定

| 項目 | 内容 |
|------|------|
| **重度** | P2 |
| **カテゴリ** | 暗号化 / エッジケース |
| **場所** | `_shared/crypto.ts` isEncrypted() |

**証拠**: `isEncrypted` は値の長さが40文字以下の場合、プレーンテキストと判定する。しかし、理論上短いデータを暗号化した場合にBase64結果が40文字以下になりうる（IV + 短平文 + tag のBase64 concatenation）。

---

#### BUG-017: フロントエンドの enhancedSecurity.checkBruteForceAttempts がエラー時に true を返す

| 項目 | 内容 |
|------|------|
| **重度** | P2 |
| **カテゴリ** | セキュリティ / フェイルオープン |
| **場所** | `src/utils/enhancedSecurity.ts` checkBruteForceAttempts() |

**証拠**:
```typescript
checkBruteForceAttempts: async (email: string): Promise<boolean> => {
  try {
    ...
    return !Boolean(data); // data=true → false (ブロックしない)
  } catch (error) {
    return true; // エラー時 → ブロック（true = is_blocked）
  }
},
```

**影響**: `checkBruteForceAttempts` のcatch節は `return true`（ブロック判定）だが、呼び出し元の `authSecurity.checkLoginEligibility` とは別のRPC (`check_login_attempts`) を使用しており、この関数自体が呼ばれているか不明瞭。二重のブルートフォースチェック実装が混在している。

---

#### BUG-018: config.toml と本番環境の verify_jwt 設定の乖離

| 項目 | 内容 |
|------|------|
| **重度** | P2（ガバナンス） |
| **カテゴリ** | 設定管理 / セキュリティ |
| **場所** | `supabase/config.toml` |

**証拠**: config.toml は全44+関数で `verify_jwt = true` だが、本番では多くが `false`。ローカル開発環境と本番のセキュリティ設定が異なるため、ローカルテストでは発見できないアクセス制御の問題が存在する。

---

#### BUG-019: OAuth redirect_uri がクライアントから受け入れ可能

| 項目 | 内容 |
|------|------|
| **重度** | P2 |
| **カテゴリ** | セキュリティ / OAuth |
| **場所** | `threads-oauth-callback/index.ts` |

**証拠**: リクエストボディの `redirect_uri` を受け入れ、フォールバックチェーンでクライアント提供値を使用。サーバー側で許可リストとの照合を行っていない。

**影響**: Threads APIのApp設定で許可URIが制限されているため直接の悪用は難しいが、防御の深層が不足している。

---

#### BUG-020: ErrorTracker の CLS値がms閾値で誤評価される可能性

| 項目 | 内容 |
|------|------|
| **重度** | P2（軽度） |
| **カテゴリ** | 計測 / ロジックエラー |
| **場所** | `src/utils/errorTracking.ts` |

**証拠**: `trackPerformance` は `value > 3000` (3秒) 超過時にエラー記録するが、CLS はスコア値（通常 0〜1 程度）でありms単位ではない。CLSがエラーとして記録されることはないが、コメントにも「閾値を修正すべきだが、まずは値をそのまま送る」と記載されており未解決。

---

## 3. 曖昧項目（判定保留）

| ID | 項目 | 判定保留理由 |
|----|------|-------------|
| AMB-001 | `threads-webhook` のHMAC検証キー（`THREADS_WEBHOOK_SECRET`）が正しく設定されているか | 環境変数の実値は確認不可 |
| AMB-002 | `check-replies` で `reply.owner_id`/`reply.author_id` がThreads APIレスポンスに実際に含まれるか | Threads Graph API仕様上、`owner_id`フィールドは返信オブジェクトに存在しない可能性が高い → 自己返信チェックの `owner_id` ブランチが常にfalseの可能性 |
| AMB-003 | `process-unhandled-replies` (2429行) の残り部分に追加バグがあるか | 先頭500行のみ詳細確認。残りは概要レベル |
| AMB-004 | RLSポリシーの確認 | Supabase Dashboard/MCP経由でのRLSポリシー取得が未実施。service_role key使用のEdge FunctionはRLSバイパスするため、RLS設定がフロントエンド直接クエリにのみ影響 |
| AMB-005 | `retrieve-secret` Edge Functionの内容 | 読み取り未実施。多くの関数がトークン復号にこの関数を使用しているが、内部ロジック未確認 |
| AMB-006 | `threads-auto-reply` で `req.clone().json()` がエラーハンドラで使用されている | リクエストボディが既に消費されている場合に `clone()` が機能するか仕様依存 |

---

## 4. テストギャップ

### 4.1 E2Eテスト（Playwright）
現在のE2Eは3ファイル:
- `auth.spec.ts` — ログイン/セッション検証
- `persona.spec.ts` — ペルソナ一覧/作成ボタン
- `token-validation.spec.ts` — トークン自動検証

**カバーされていないシナリオ**:
- OAuth認証フロー（Threads OAuth → callback処理）
- 自動投稿の設定→実行→確認フロー
- 返信自動化の設定→Webhook受信→返信送信フロー
- トークン期限切れ時のUI表示とリカバリ
- 管理者パスワードリセット
- レート制限時のUIフィードバック

### 4.2 Edge Function テスト
- Edge Functionの自動テストが存在しない
- `.http` ファイル（`test-auto-post-fix.http`, `test-threads-post.http` 等）は手動テスト用
- CRON関数の統合テストなし

### 4.3 未テストの重要パス
- クロスペルソナ返信ループの発生と停止
- `fix-stuck-ai-replies` / `reset-stuck-ai-replies` 実行後の二重送信検証
- トークンリフレッシュ中のDB障害からの復旧
- 221マイグレーション適用順序の整合性
- Threads API レート制限（error_subcode 2207050/2207051）時のグレースフル停止

---

## 5. 未確認領域

| 領域 | 理由 |
|------|------|
| **RLSポリシー** | Supabase Dashboard/MCP未接続。マイグレーションSQL内のCREATE POLICY文は一部確認したが、全テーブルの網羅的確認は未実施 |
| **retrieve-secret / store-secret** | Edge Function内容未読 |
| **generate-image-huggingface** | 画像生成Edge Function未読 |
| **create-threads-container / check-container-status** | 未読 |
| **template-random-post** | 未読 |
| **SECURITY DEFINER関数** (DB) | `auto_cleanup_stuck_replies`, `encrypt_access_token`, `decrypt_access_token`, `is_admin`, `check_login_attempts` 等のDB関数の実装詳細 |
| **Vault (supabase_vault)** | Supabase Vault の使用状況と暗号化キーの管理方法 |
| **production Edge Function のデプロイ設定** | `verify_jwt` の実際の値。config.toml はローカル用であり本番に反映されない |
| **残り16+ Edge Function** | 全44+関数のうち約18関数を詳細読了。残りは概要レベル |

---

## 6. 重要度サマリー

| 重度 | 件数 | 代表例 |
|------|------|--------|
| **P0** | 5件 | BUG-001(秘密鍵漏洩), BUG-002(認証なし), BUG-003(ループ), BUG-004(フェイルオープン), BUG-005(OAuth CSRF) |
| **P1** | 7件 | BUG-006〜012（トークン消失, 二重処理, ステータス不整合, デッドコード等） |
| **P2** | 8件 | BUG-013〜020（Realtimeスタブ, ポーリング, パフォーマンス等） |
| **曖昧** | 6件 | AMB-001〜006 |

---

## 7. 推奨対応優先順

1. **即日**: BUG-001 — マイグレーションからservice_roleキーを除去し、Supabase Dashboardでキーをローテーション
2. **即日**: BUG-002 — 全Edge Functionのverify_jwt設定を監査し、CRON_SECRET/JWT認証をコード内に実装
3. **当週**: BUG-003 — ボット間ループ防止ロジックの実装（reply_depth制限、クロスペルソナ検出）
4. **当週**: BUG-004 — レート制限のフェイルクローズ化
5. **当週**: BUG-005 — サーバーサイドOAuth state検証の追加
6. **次週**: BUG-006〜012 — P1バグの順次対応
7. **継続**: E2Eテスト拡充、Edge Functionテスト追加

---

*本レポートはコードの読み取り専用調査に基づくものであり、一切のコード変更は行っていません。*
