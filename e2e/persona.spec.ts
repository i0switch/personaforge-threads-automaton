import { test, expect } from '@playwright/test';

// テスト用の認証情報（実際の環境に合わせて調整）
const TEST_CREDENTIALS = {
  email: process.env.TEST_EMAIL || 'tspecial68kg@gmail.com',
  password: process.env.TEST_PASSWORD || 'test-password'
};

test.describe('ペルソナ設定', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン
    await page.goto('/auth');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    // ダッシュボードに遷移するまで待機
    await page.waitForURL(/\/(dashboard|persona|index)?/, { timeout: 10000 });
  });

  test('ペルソナ一覧ページにアクセス', async ({ page }) => {
    await page.goto('/persona-setup');
    await expect(page).toHaveURL('/persona-setup');
    await expect(page.locator('text=/ペルソナ|Persona/i')).toBeVisible();
  });

  test('新規ペルソナ作成ボタンが表示される', async ({ page }) => {
    await page.goto('/persona-setup');
    const createButton = page.locator('button:has-text("新規作成"), button:has-text("Create New")');
    await expect(createButton).toBeVisible();
  });

  test('ペルソナ設定保存（認証トークン検証）', async ({ page }) => {
    await page.goto('/persona-setup');

    // コンソールエラーを監視
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // 新規作成ボタンをクリック
    const createButton = page.locator('button:has-text("新規作成"), button:has-text("Create New")').first();
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(1000);
    }

    // フォーム入力
    const nameInput = page.locator('input[name="name"], input[placeholder*="名前"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('テストペルソナ');
    }

    const ageInput = page.locator('input[name="age"], input[placeholder*="年齢"]').first();
    if (await ageInput.isVisible()) {
      await ageInput.fill('25');
    }

    const personalityInput = page.locator('textarea[name="personality"], textarea[placeholder*="性格"]').first();
    if (await personalityInput.isVisible()) {
      await personalityInput.fill('明るく前向きな性格');
    }

    // 保存ボタンをクリック
    const saveButton = page.locator('button[type="submit"], button:has-text("保存"), button:has-text("Save")').first();
    if (await saveButton.isVisible()) {
      await saveButton.click();

      // 保存完了を待機（トーストまたは成功メッセージ）
      await page.waitForTimeout(3000);

      // 認証エラーが発生していないことを確認
      const hasAuthError = errors.some(err => 
        err.includes('invalid claim') ||
        err.includes('missing sub claim') ||
        err.includes('bad_jwt') ||
        err.includes('認証トークンが無効')
      );

      expect(hasAuthError).toBeFalsy();

      // 成功メッセージまたはトーストを確認
      const successMessage = page.locator('text=/保存しました|成功|Success/i');
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    }
  });

  test('ペルソナ編集：トークンリフレッシュ確認', async ({ page }) => {
    await page.goto('/persona-setup');

    // コンソールログを監視
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    // 既存ペルソナの編集ボタンをクリック
    const editButton = page.locator('button:has-text("編集"), button:has-text("Edit")').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(1000);

      // 保存ボタンをクリック
      const saveButton = page.locator('button[type="submit"], button:has-text("保存")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(3000);

        // セッションリフレッシュログを確認
        const hasRefreshLog = logs.some(log => 
          log.includes('Refreshing authentication session') ||
          log.includes('Session refreshed successfully')
        );

        expect(hasRefreshLog).toBeTruthy();
      }
    }
  });

  test('トークン有効性チェック：auth.uid()テスト', async ({ page }) => {
    await page.goto('/persona-setup');

    const logs: string[] = [];
    const errors: string[] = [];
    
    page.on('console', msg => {
      logs.push(msg.text());
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // 編集操作を実行
    const editButton = page.locator('button:has-text("編集"), button:has-text("Edit")').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(1000);

      const saveButton = page.locator('button[type="submit"]').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(3000);

        // auth.uid()テストのログを確認
        const hasAuthUidTest = logs.some(log => 
          log.includes('Testing auth.uid()')
        );

        // auth.uid()テストエラーがないことを確認
        const hasAuthUidError = errors.some(err => 
          err.includes('Auth UID test failed')
        );

        expect(hasAuthUidTest).toBeTruthy();
        expect(hasAuthUidError).toBeFalsy();
      }
    }
  });
});
