import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export class AuthHandler {
  private static instance: AuthHandler;
  private isHandling403 = false;
  private retryCount = 0;
  private lastRetryTime = 0;
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_WINDOW_MS = 60000; // 1分以内のリトライのみカウント

  static getInstance(): AuthHandler {
    if (!AuthHandler.instance) {
      AuthHandler.instance = new AuthHandler();
    }
    return AuthHandler.instance;
  }

  private constructor() {
    console.log('🔧 Initializing AuthHandler with interceptor setup');
    // Supabaseクライアントのエラーハンドリングを設定
    this.setupSupabaseInterceptor();
  }

  private setupSupabaseInterceptor() {
    // Supabaseのグローバルエラーハンドリング
    const originalFetch = window.fetch;
    console.log('🔧 Setting up fetch interceptor for 403 error handling');
    
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      // Supabase APIリクエストの場合のみ処理
      if (args[0] && typeof args[0] === 'string' && args[0].includes('supabase.co')) {
        if (response.status === 403) {
          console.log('🚫 403 error detected in Supabase API call:', args[0]);
          const clonedResponse = response.clone();
          try {
            const errorData = await clonedResponse.json();
            console.log('📋 403 error details:', errorData);
            
            if (errorData.message?.includes('invalid claim') || 
                errorData.message?.includes('bad_jwt') ||
                errorData.message?.includes('missing sub claim')) {
              console.log('🔐 Authentication error detected, triggering auth handler');
              this.handle403Error();
            }
          } catch (parseError) {
            console.log('⚠️ Failed to parse error response, continuing without auth handling');
          }
        }
      }
      
      return response;
    };
    
    console.log('✅ Fetch interceptor setup completed');
  }

  async handle403Error() {
    if (this.isHandling403) return;
    
    this.isHandling403 = true;
    
    // タイムウィンドウ外なら���トライカウントをリセット
    const now = Date.now();
    if (now - this.lastRetryTime > this.RETRY_WINDOW_MS) {
      console.log('⏰ リトライウィンドウ外のため、カウントをリセット');
      this.retryCount = 0;
    }
    this.lastRetryTime = now;
    this.retryCount++;
    
    console.log(`🔐 403エラーを検出しました (${this.retryCount}/${this.MAX_RETRIES}, ウィンドウ: ${this.RETRY_WINDOW_MS}ms)`);

    try {
      // リトライ回数が上限に達した場合のみログアウト
      if (this.retryCount > this.MAX_RETRIES) {
        console.log('⚠️ リトライ上限に達しました。サインアウトします');
        await this.forceSignOut();
        return;
      }

      // セッションの再取得を試行
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.log('🔓 セッションが無効です。リトライします...');
        // 即座にログアウトせず、少し待ってからリトライ
        await new Promise(resolve => setTimeout(resolve, 1000));
        return;
      }

      // セッションが有効な場合、トークンリフレッシュを試行
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.log('🔄 トークンリフレッシュに失敗しました。リトライします...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('✅ トークンリフレッシュが成功しました');
        this.retryCount = 0; // 成功したらカウンターをリセット
        toast({
          title: "認証更新",
          description: "セッションが更新されました。",
        });
      }
    } catch (error) {
      console.error('認証エラーハンドリング中にエラーが発生:', error);
      // エラーが発生しても即座にログアウトせず、リトライする
      if (this.retryCount > this.MAX_RETRIES) {
        await this.forceSignOut();
      }
    } finally {
      this.isHandling403 = false;
    }
  }

  private async forceSignOut() {
    try {
      // ローカルストレージとセッションストレージのクリア
      localStorage.clear();
      sessionStorage.clear();
      
      // Supabaseセッションのクリア
      await supabase.auth.signOut({ scope: 'local' });
      
      toast({
        title: "認証期限切れ",
        description: "セッションの有効期限が切れました。再度ログインしてください。",
        variant: "destructive",
      });

      // ログインページにリダイレクト
      setTimeout(() => {
        window.location.href = '/auth';
      }, 1500);
      
    } catch (error) {
      console.error('強制サインアウト中にエラーが発生:', error);
      // エラーが発生してもリダイレクトは実行
      window.location.href = '/auth';
    }
  }

  // 手動でセッション再取得を試行する関数
  async retrySession(): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        return false;
      }

      // セッションが有効な場合、追加のバリデーション
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

// シングルトンインスタンスを初期化
export const authHandler = AuthHandler.getInstance();