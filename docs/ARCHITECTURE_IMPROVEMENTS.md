# アーキテクチャ改善ドキュメント

## 実装完了項目

### 1. 型の一元化（DB ↔ API ↔ UI）✅

**目的**: 型の二重定義やズレを防ぐ

**実装内容**:
- `src/types/persona.ts` を Supabase 自動生成型ベースにリファクタリング
- `Database['public']['Tables']['personas']` から直接型を派生
- 型の完全な一貫性を確保

**変更箇所**:
```typescript
// Before: 独自型定義
export interface Persona { ... }

// After: Supabase生成型から派生
import type { Database } from '@/integrations/supabase/types';
export type Persona = Database['public']['Tables']['personas']['Row'];
export type PersonaInsert = Database['public']['Tables']['personas']['Insert'];
export type PersonaUpdate = Database['public']['Tables']['personas']['Update'];
```

**メリット**:
- DBスキーマ変更時の自動型更新
- 型の不一致によるバグを防止
- コード補完の精度向上

---

### 2. エラー監視・トラッキングシステム ✅

**目的**: 障害原因の迅速特定、エラーパターンの分析

**新規ファイル**:
- `src/utils/errorTracking.ts`: エラートラッキングシステム

**主要機能**:

#### 2.1 エラー記録
```typescript
errorTracker.trackError(error, {
  component: 'ComponentName',
  action: 'user_action',
  userId: user.id,
  additionalData: { ... }
}, 'critical');
```

#### 2.2 パフォーマンス計測
```typescript
errorTracker.trackPerformance('API_CALL', duration, context);
```

#### 2.3 Web Vitals 自動計測
- **LCP** (Largest Contentful Paint): 最大コンテンツの描画時間
- **FID** (First Input Delay): 最初の入力遅延
- **CLS** (Cumulative Layout Shift): レイアウトシフトの累積

#### 2.4 グローバルエラーハンドラー
- 未処理のエラーを自動キャッチ
- Promise拒否を自動キャッチ
- Supabase `security_events` テーブルに記録

**統合箇所**:
- `src/components/ErrorBoundary.tsx`: Reactエラー境界でトラッキング
- `src/contexts/AuthContext.tsx`: 認証時に初期化

**データフロー**:
```
エラー発生
  ↓
errorTracker.trackError()
  ↓
1. コンソール出力（開発環境）
2. メモリ内保持（最新100件）
3. Supabase security_eventsテーブルに記録
```

---

### 3. RLS最小権限化 ✅ (既存実装の確認)

**現状**: 既に実装済み
- 全テーブルでRLS有効化
- `auth.uid()` ベースの所有権検証
- `SECURITY DEFINER` 関数による権限チェック

**主要ポリシー例**:
```sql
-- personas テーブル
CREATE POLICY "Users can view their own personas"
ON personas FOR SELECT
USING (auth.uid() = user_id);

-- 管理者権限チェック
CREATE POLICY "Admins can view all personas"
ON personas FOR SELECT
USING (is_admin(auth.uid()));
```

---

### 4. 認証フロー堅牢化 ✅ (既存実装の確認)

**現状**: 既に実装済み
- `src/contexts/AuthContext.tsx`: セッション管理
- `src/utils/authHandler.ts`: 403エラーハンドリング
- `src/utils/authSecurity.ts`: ブルートフォース攻撃対策
- iOS Safari特殊対応

**セキュリティ機能**:
- ログイン試行回数制限（15分間で5回まで）
- パスワード強度検証
- セッション監視・自動更新
- トークン検証

---

## パフォーマンス指標

### Web Vitals 目標値
| 指標 | 良好 | 改善が必要 | 不良 |
|------|------|-----------|------|
| LCP  | ≤2.5s | 2.5s-4.0s | >4.0s |
| FID  | ≤100ms | 100ms-300ms | >300ms |
| CLS  | ≤0.1 | 0.1-0.25 | >0.25 |

### エラートラッキング重要度
- `critical`: システムダウン、データ損失
- `high`: 未処理エラー、認証失敗
- `medium`: API失敗、一部機能不全
- `low`: パフォーマンス問題、軽微な警告

---

## 今後の拡張可能性

### 外部監視ツール統合（未実装）
現在はSupabaseとコンソールにログ記録していますが、以下の統合が可能：

#### Sentry統合例
```typescript
// src/utils/errorTracking.ts に追加
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

#### その他の選択肢
- **LogRocket**: セッションリプレイ、ユーザー行動追跡
- **Datadog**: インフラ監視、APM
- **New Relic**: アプリケーションパフォーマンス監視

---

## 開発者向けガイド

### エラートラッキングの使い方

```typescript
import { errorTracker } from '@/utils/errorTracking';

// コンポーネント内でのエラー記録
try {
  await riskyOperation();
} catch (error) {
  errorTracker.trackError(error as Error, {
    component: 'MyComponent',
    action: 'riskyOperation',
    userId: user?.id,
    additionalData: { inputData: '...' }
  }, 'high');
}

// パフォーマンス計測
const start = performance.now();
await apiCall();
const duration = performance.now() - start;
errorTracker.trackPerformance('API_CALL_NAME', duration);
```

### エラーパターン分析

```typescript
// 最近のエラー取得
const recentErrors = errorTracker.getRecentErrors(20);

// パターン分析
const patterns = errorTracker.analyzeErrorPatterns();
console.log(patterns); 
// [{ pattern: 'PersonaSetup', count: 15 }, ...]
```

---

## 運用ガイド

### エラーログの確認方法

1. **開発環境**: ブラウザコンソールで自動出力
2. **本番環境**: Supabase Dashboard → Database → `security_events` テーブル

### SQLクエリ例

```sql
-- 過去24時間のクリティカルエラー
SELECT * FROM security_events
WHERE event_type LIKE 'error_%'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- エラー頻度TOP10
SELECT 
  details->>'component' as component,
  COUNT(*) as error_count
FROM security_events
WHERE event_type LIKE 'error_%'
GROUP BY component
ORDER BY error_count DESC
LIMIT 10;
```

---

## 変更履歴

| 日付 | 変更内容 | 担当者 |
|------|----------|--------|
| 2025-01-XX | 型の一元化、エラートラッキング実装 | AI Assistant |

---

## 関連ドキュメント

- [Supabase Types Documentation](https://supabase.com/docs/guides/api/generating-types)
- [Web Vitals](https://web.dev/vitals/)
- [Error Boundary (React)](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
