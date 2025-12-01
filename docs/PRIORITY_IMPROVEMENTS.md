# 優先度別改善提案
**作成日**: 2025-12-01  
**ステータス**: 重複投稿防止完了後の次期改善項目

---

## 🔴 緊急度: 高（即座に対応推奨）

### 1. **トークン期限切れ通知システム**
**問題**: 
- 複数のペルソナでトークンが期限切れ
- ユーザーが気付かないまま投稿が失敗し続ける
- エラーログ: `Session has expired on Thursday, 20-Nov-25`

**提案実装**:
```typescript
// 1. トークン検証Edge Function
// supabase/functions/validate-persona-tokens/index.ts
async function validateToken(accessToken: string, personaId: string) {
  const response = await fetch(
    `https://graph.threads.net/v1.0/me?access_token=${accessToken}`
  );
  
  if (response.status === 400 || response.status === 401) {
    const error = await response.json();
    if (error.error?.code === 190) {
      // トークン期限切れ
      await markTokenExpired(personaId);
      await createUserAlert(personaId, 'token_expired');
      return { valid: false, reason: 'expired' };
    }
  }
  
  return { valid: true };
}

// 2. UI通知コンポーネント
// src/components/TokenExpiryAlert.tsx
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>トークン期限切れ</AlertTitle>
  <AlertDescription>
    ペルソナ「{personaName}」のThreadsトークンが期限切れです。
    再認証が必要です。
  </AlertDescription>
  <Button onClick={refreshToken}>トークンを更新</Button>
</Alert>
```

**影響度**: **大**  
**実装時間**: 2-3時間

---

### 2. **レート制限の自動検出と一時停止**
**問題**:
- レート制限されたペルソナが投稿を試行し続ける
- エラーログ: `Instagramアカウントは制限されています (error_subcode: 2207050)`
- 無駄なAPI呼び出しとログ肥大化

**提案実装**:
```typescript
// threads-post/index.ts のエラーハンドリング改善
if (response.status === 400) {
  const errorData = JSON.parse(responseText);
  
  // レート制限検出
  if (errorData.error?.error_subcode === 2207050) {
    // ペルソナを一時停止
    await supabase
      .from('personas')
      .update({
        is_rate_limited: true,
        rate_limit_detected_at: new Date().toISOString(),
        rate_limit_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        rate_limit_reason: errorData.error?.error_user_msg || 'Rate limited'
      })
      .eq('id', personaId);
    
    // 自動投稿設定を一時停止
    await supabase
      .from('auto_post_configs')
      .update({ is_active: false })
      .eq('persona_id', personaId);
    
    // ユーザー通知
    await createUserAlert(personaId, 'rate_limited');
    
    throw new RateLimitError('Persona auto-paused due to rate limit');
  }
}

// 自動再開のCronジョブ
// rate_limit_until を超過したペルソナを自動的に is_rate_limited=false に戻す
```

**影響度**: **大**  
**実装時間**: 1-2時間

---

## 🟡 緊急度: 中（計画的に対応）

### 3. **エラーコード別の詳細処理**
**目的**: threads-postのエラーハンドリングを精緻化

**実装箇所**:
- `supabase/functions/threads-post/index.ts`
- エラーレスポンスの解析部分（行: 490-513）

**提案**:
```typescript
enum ThreadsErrorCode {
  TOKEN_EXPIRED = 190,
  RATE_LIMITED = 1,
  INVALID_PARAMS = 100,
  PERMISSIONS = 200,
}

function handleThreadsError(status: number, error: any, personaId: string) {
  switch (error.code) {
    case ThreadsErrorCode.TOKEN_EXPIRED:
      return { action: 'pause_persona', retry: false, notify: true };
    case ThreadsErrorCode.RATE_LIMITED:
      return { action: 'pause_24h', retry: false, notify: true };
    case ThreadsErrorCode.INVALID_PARAMS:
      return { action: 'mark_invalid', retry: false, notify: false };
    default:
      return { action: 'retry', retry: true, notify: false };
  }
}
```

**影響度**: **中**  
**実装時間**: 2時間

---

### 4. **トークンヘルスチェック（定期実行）**
**目的**: 投稿失敗前にトークン問題を検出

**実装**:
```sql
-- Cron: 毎日1回実行
SELECT cron.schedule(
  'check-token-health-daily',
  '0 0 * * *', -- 毎日午前0時
  $$
  SELECT net.http_post(
    url:='https://tqcgbsnoiarnawnppwia.functions.supabase.co/check-token-health',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

**影響度**: **中**  
**実装時間**: 1時間

---

### 5. **投稿失敗理由の詳細分類**
**目的**: ダッシュボードで失敗原因を可視化

**実装**:
```typescript
// postsテーブルに failure_reason カラム追加
ALTER TABLE posts ADD COLUMN failure_reason TEXT;
ALTER TABLE posts ADD COLUMN failure_category TEXT; 
-- categories: 'token_expired', 'rate_limited', 'api_error', 'network_error', etc.

// UIでの表示
<Badge variant={getFailureBadgeVariant(post.failure_category)}>
  {getFailureReasonLabel(post.failure_reason)}
</Badge>
```

**影響度**: **中**  
**実装時間**: 1.5時間

---

## 🟢 緊急度: 低（最適化・機能拡張）

### 6. **トークンキャッシュ機構**
**目的**: 同じペルソナの複数投稿でトークン取得を最適化

```typescript
const tokenCache = new Map<string, { token: string; expires: number }>();

async function getCachedToken(personaId: string): Promise<string> {
  const cached = tokenCache.get(personaId);
  if (cached && cached.expires > Date.now()) {
    return cached.token;
  }
  
  const token = await retrieveToken(personaId);
  tokenCache.set(personaId, {
    token,
    expires: Date.now() + 5 * 60 * 1000 // 5分間キャッシュ
  });
  
  return token;
}
```

**影響度**: **小**（パフォーマンス改善）  
**実装時間**: 1時間

---

### 7. **投稿成功率メトリクス収集**
**目的**: ダッシュボードでの可視化と傾向分析

```sql
CREATE TABLE posting_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL,
  date DATE NOT NULL,
  attempts INTEGER DEFAULT 0,
  successes INTEGER DEFAULT 0,
  failures INTEGER DEFAULT 0,
  token_errors INTEGER DEFAULT 0,
  rate_limit_errors INTEGER DEFAULT 0,
  success_rate NUMERIC GENERATED ALWAYS AS (
    CASE WHEN attempts > 0 THEN (successes::numeric / attempts) * 100 ELSE 0 END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**影響度**: **小**（可視化）  
**実装時間**: 2時間

---

### 8. **自動リカバリーの精度向上**
**目的**: リトライロジックのスマート化

```typescript
// リトライ戦略の改善
function calculateRetryDelay(retryCount: number, errorType: string): number {
  // エラータイプ別の待機時間
  const baseDelays = {
    'network_error': 5,      // 5分
    'api_error': 15,         // 15分
    'token_expired': null,   // リトライ不要
    'rate_limited': null,    // リトライ不要
  };
  
  const baseDelay = baseDelays[errorType] || 15;
  if (baseDelay === null) return null; // リトライしない
  
  // 指数バックオフ: 5分 → 10分 → 20分
  return baseDelay * Math.pow(2, retryCount);
}
```

**影響度**: **小**  
**実装時間**: 1時間

---

## 📈 メトリクス監視

### **KPI設定**

| メトリクス | 目標値 | 現在値 | 状態 |
|-----------|--------|--------|------|
| 重複投稿率 | 0% | **0%** | ✅ 達成 |
| Stuck処理数 | 0件 | **0件** | ✅ 達成 |
| 状態整合性 | 100% | **100%** | ✅ 達成 |
| 投稿成功率 | >90% | 計測中 | 📊 要実装 |
| トークン健全性 | >95% | 不明 | 📊 要実装 |

---

## 🎯 次のマイルストーン

### **フェーズ2: 信頼性向上**
- [ ] トークン期限切れ通知UI
- [ ] レート制限自動検出と一時停止
- [ ] エラー分類システム

### **フェーズ3: 可観測性向上**
- [ ] 投稿成功率ダッシュボード
- [ ] トークンヘルスチェック
- [ ] エラー傾向分析

### **フェーズ4: 最適化**
- [ ] トークンキャッシュ
- [ ] スマートリトライ
- [ ] パフォーマンス改善

---

**レビュー担当**: Lovable AI  
**承認ステータス**: ユーザー確認待ち
