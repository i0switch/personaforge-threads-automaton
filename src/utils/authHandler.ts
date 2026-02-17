import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Supabase関連のlocalStorageキーパターン
const SUPABASE_STORAGE_KEY_PREFIX = 'sb-';

/**
 * Supabase認証関連のストレージのみをクリア（他アプリ設定は保持）
 */
function clearAuthStorage() {
  // localStorage: Supabaseキーのみ削除
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(SUPABASE_STORAGE_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));

  // sessionStorage: Supabaseキーのみ削除
  const sessionKeysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith(SUPABASE_STORAGE_KEY_PREFIX)) {
      sessionKeysToRemove.push(key);
    }
  }
  sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
}

export class AuthHandler {
  private static instance: AuthHandler;
  private isHandling403 = false;
  private retryCount = 0;
  private lastRetryTime = 0;
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_WINDOW_MS = 60000;

  static getInstance(): AuthHandler {
    if (!AuthHandler.instance) {
      AuthHandler.instance = new AuthHandler();
    }
    return AuthHandler.instance;
  }

  private constructor() {
    console.log('🔧 Initializing AuthHandler (no fetch monkey-patch)');
    // fetch上書きは廃止: Supabase onAuthStateChangeとQueryのerrorハンドリングで対応
  }

  async handle403Error() {
    if (this.isHandling403) return;
    
    this.isHandling403 = true;
    
    const now = Date.now();
    if (now - this.lastRetryTime > this.RETRY_WINDOW_MS) {
      this.retryCount = 0;
    }
    this.lastRetryTime = now;
    this.retryCount++;
    
    console.log(`🔐 403エラーを検出 (${this.retryCount}/${this.MAX_RETRIES})`);

    try {
      if (this.retryCount > this.MAX_RETRIES) {
        console.log('⚠️ リトライ上限。サインアウトします');
        await this.forceSignOut();
        return;
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.log('🔓 セッション無効。リトライ待機...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return;
      }

      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.log('🔄 トークンリフレッシュ失敗');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('✅ トークンリフレッシュ成功');
        this.retryCount = 0;
        toast({
          title: "認証更新",
          description: "セッションが更新されました。",
        });
      }
    } catch (error) {
      console.error('認証エラーハンドリング中にエラー:', error);
      if (this.retryCount > this.MAX_RETRIES) {
        await this.forceSignOut();
      }
    } finally {
      this.isHandling403 = false;
    }
  }

  private async forceSignOut() {
    try {
      clearAuthStorage();
      await supabase.auth.signOut({ scope: 'local' });
      
      toast({
        title: "認証期限切れ",
        description: "セッションの有効期限が切れました。再度ログインしてください。",
        variant: "destructive",
      });

      setTimeout(() => {
        window.location.href = '/auth';
      }, 1500);
      
    } catch (error) {
      console.error('強制サインアウト中にエラー:', error);
      window.location.href = '/auth';
    }
  }

  async retrySession(): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        return false;
      }

      const { error: testError } = await supabase
        .from('user_account_status')
        .select('user_id')
        .limit(1);

      if (testError) {
        console.log('セッションバリデーション失敗:', testError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('セッション再取得エラー:', error);
      return false;
    }
  }
}

export const authHandler = AuthHandler.getInstance();
