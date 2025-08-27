import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export class AuthHandler {
  private static instance: AuthHandler;
  private isHandling403 = false;

  static getInstance(): AuthHandler {
    if (!AuthHandler.instance) {
      AuthHandler.instance = new AuthHandler();
    }
    return AuthHandler.instance;
  }

  private constructor() {
    // Supabaseクライアントのエラーハンドリングを設定
    this.setupSupabaseInterceptor();
  }

  private setupSupabaseInterceptor() {
    // Supabaseのグローバルエラーハンドリング
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      // Supabase APIリクエストの場合のみ処理
      if (args[0] && typeof args[0] === 'string' && args[0].includes('supabase.co')) {
        if (response.status === 403) {
          const clonedResponse = response.clone();
          try {
            const errorData = await clonedResponse.json();
            if (errorData.message?.includes('invalid claim') || 
                errorData.message?.includes('bad_jwt') ||
                errorData.message?.includes('missing sub claim')) {
              this.handle403Error();
            }
          } catch {
            // JSON解析に失敗した場合はそのまま進む
          }
        }
      }
      
      return response;
    };
  }

  async handle403Error() {
    if (this.isHandling403) return;
    
    this.isHandling403 = true;
    console.log('🔐 403エラーを検出しました。認証状態をクリアしています...');

    try {
      // セッションの再取得を試行
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.log('🔓 セッションが無効です。サインアウト処理を実行します');
        await this.forceSignOut();
      } else {
        // セッションが有効な場合、トークンリフレッシュを試行
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.log('🔄 トークンリフレッシュに失敗しました。サインアウトします');
          await this.forceSignOut();
        } else {
          console.log('✅ トークンリフレッシュが成功しました');
          toast({
            title: "認証更新",
            description: "セッションが更新されました。",
          });
        }
      }
    } catch (error) {
      console.error('認証エラーハンドリング中にエラーが発生:', error);
      await this.forceSignOut();
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