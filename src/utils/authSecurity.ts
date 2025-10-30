
import { supabase } from '@/integrations/supabase/client';
import { enhancedSecurity } from './enhancedSecurity';

export interface LoginAttempt {
  email: string;
  success: boolean;
  timestamp: Date;
  ip_address?: string;
  user_agent?: string;
}

export const authSecurity = {
  // ログイン前のブルートフォース攻撃チェック
  checkLoginEligibility: async (email: string): Promise<{ allowed: boolean; reason?: string }> => {
    try {
      // データベース関数を使用してチェック
      const { data, error } = await supabase.rpc('check_login_attempts', {
        user_email: email
      });

      if (error) {
        console.error('Login eligibility check failed:', error);
        return { allowed: true }; // エラー時はログインを許可（可用性優先）
      }

      if (!data) {
        return { 
          allowed: false, 
          reason: 'このメールアドレスは一時的にブロックされています。15分後にお試しください。' 
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Login eligibility check error:', error);
      return { allowed: true };
    }
  },

  // ログイン試行の記録
  recordLoginAttempt: async (attempt: LoginAttempt) => {
    try {
      // セキュリティイベントとして記録
      await enhancedSecurity.logSecurityEvent({
        event_type: attempt.success ? 'login_success' : 'login_failed',
        ip_address: attempt.ip_address,
        user_agent: attempt.user_agent,
        details: {
          email: attempt.email,
          timestamp: attempt.timestamp.toISOString(),
          success: attempt.success
        }
      });

      // 従来のログイン試行記録も継続
      await enhancedSecurity.logLoginAttempt(attempt);
    } catch (error) {
      console.error('Failed to record login attempt:', error);
    }
  },

  // パスワード強度検証
  validatePasswordStrength: async (password: string): Promise<{ valid: boolean; errors: string[] }> => {
    try {
      const { data, error } = await supabase.rpc('validate_password_strength', {
        password
      });

      if (error) {
        console.error('Password validation error:', error);
        return { 
          valid: false, 
          errors: ['パスワード検証中にエラーが発生しました'] 
        };
      }

      const result = data as { valid: boolean; errors: string[] };
      return {
        valid: result.valid,
        errors: result.errors || []
      };
    } catch (error) {
      console.error('Password strength validation error:', error);
      return { 
        valid: false, 
        errors: ['パスワード検証中にエラーが発生しました'] 
      };
    }
  },

  // セッション監視
  monitorSession: async (userId: string, action: string) => {
    try {
      await enhancedSecurity.monitorSessionActivity(userId, action);
    } catch (error) {
      console.error('Session monitoring error:', error);
    }
  },

  // 安全なログアウト
  secureLogout: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        await authSecurity.monitorSession(session.user.id, 'logout');
      }

      // セッションクリア
      await supabase.auth.signOut();
      
      // ローカルストレージ/セッションストレージのクリア（iOS Safari保護）
      try {
        if (typeof window !== 'undefined' && 'localStorage' in window) {
          localStorage.removeItem('supabase.auth.token');
        }
      } catch (e) {
        console.warn('localStorage remove failed (ignored):', e);
      }
      try {
        if (typeof window !== 'undefined' && 'sessionStorage' in window) {
          sessionStorage.clear();
        }
      } catch (e) {
        console.warn('sessionStorage clear failed (ignored):', e);
      }
      
    } catch (error) {
      console.error('Secure logout error:', error);
      // エラーがあってもログアウトは実行
      await supabase.auth.signOut();
    }
  }
};
