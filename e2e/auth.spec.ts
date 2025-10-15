import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'test-auth@example.com',
  password: 'TestPassword123!',
  displayName: 'Test User'
};

test.describe('認証フロー', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('ログインページにアクセスできる', async ({ page }) => {
    await page.goto('/auth');
    await expect(page).toHaveURL('/auth');
    await expect(page.locator('h1')).toContainText(/ログイン|サインイン/i);
  });

  test('無効な認証情報でログイン失敗', async ({ page }) => {
    await page.goto('/auth');
    
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // エラーメッセージを確認
    await expect(page.locator('text=/エラー|失敗|invalid/i')).toBeVisible({ timeout: 5000 });
  });

  test('新規ユーザー登録フロー', async ({ page }) => {
    await page.goto('/auth');
    
    // サインアップタブに切り替え
    const signupTab = page.locator('text=/新規登録|サインアップ/i');
    if (await signupTab.isVisible()) {
      await signupTab.click();
    }

    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    
    // 表示名フィールドがある場合
    const displayNameInput = page.locator('input[name="displayName"]');
    if (await displayNameInput.isVisible()) {
      await displayNameInput.fill(TEST_USER.displayName);
    }

    await page.click('button[type="submit"]');

    // 登録完了または確認メール送信メッセージ
    await expect(page.locator('text=/登録完了|メールを送信|確認/i')).toBeVisible({ timeout: 10000 });
  });

  test('セッション検証：無効トークン自動クリア', async ({ page }) => {
    // コンソールログを監視
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.goto('/');
    
    // 無効なトークンをlocalStorageに注入
    await page.evaluate(() => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid';
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: invalidToken,
        refresh_token: 'invalid-refresh'
      }));
    });

    // ページリロード
    await page.reload();
    await page.waitForTimeout(2000);

    // 無効トークンが検出・クリアされたことを確認
    const hasInvalidTokenLog = logs.some(log => 
      log.includes('Invalid session detected') || 
      log.includes('Invalid token')
    );
    
    expect(hasInvalidTokenLog).toBeTruthy();
  });

  test('セッション検証：有効トークンは保持', async ({ page }) => {
    await page.goto('/auth');

    // 実際のログイン（モック）
    await page.evaluate(() => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        btoa(JSON.stringify({ 
          sub: 'test-user-id', 
          exp: Math.floor(Date.now() / 1000) + 3600 
        })) + '.signature';
      
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: validToken,
        refresh_token: 'valid-refresh'
      }));
    });

    await page.reload();
    
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));
    
    await page.waitForTimeout(2000);

    // 有効トークン確認ログ
    const hasValidTokenLog = logs.some(log => 
      log.includes('Valid session confirmed')
    );
    
    expect(hasValidTokenLog).toBeTruthy();
  });
});
