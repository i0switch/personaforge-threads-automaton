
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { authSecurity } from '@/utils/authSecurity';

export const useSecureAuth = () => {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const secureSignIn = async (email: string, password: string) => {
    setIsProcessing(true);
    
    try {
      // ブルートフォース攻撃チェック
      const eligibilityCheck = await authSecurity.checkLoginEligibility(email);
      
      if (!eligibilityCheck.allowed) {
        toast({
          title: "ログインがブロックされました",
          description: eligibilityCheck.reason || "しばらく時間をおいてからお試しください。",
          variant: "destructive",
        });
        
        // 失敗を記録
        await authSecurity.recordLoginAttempt({
          email,
          success: false,
          timestamp: new Date(),
          ip_address: 'blocked',
          user_agent: navigator.userAgent
        });
        
        return { success: false, error: eligibilityCheck.reason };
      }

      // 実際のログイン試行
      const result = await signIn(email, password);
      
      // ログイン試行を記録
      await authSecurity.recordLoginAttempt({
        email,
        success: result.success,
        timestamp: new Date(),
        user_agent: navigator.userAgent
      });

      if (result.success) {
        toast({
          title: "ログイン成功",
          description: "ようこそ！",
        });
        
        // セッション監視開始
        if (result.user) {
          await authSecurity.monitorSession(result.user.id, 'login_success');
        }
      } else {
        toast({
          title: "ログインに失敗しました",
          description: result.error || "メールアドレスまたはパスワードが正しくありません。",
          variant: "destructive",
        });
      }

      return result;
    } catch (error) {
      console.error('Secure sign in error:', error);
      
      // エラーも記録
      await authSecurity.recordLoginAttempt({
        email,
        success: false,
        timestamp: new Date(),
        user_agent: navigator.userAgent
      });

      toast({
        title: "エラーが発生しました",
        description: "ログイン処理中にエラーが発生しました。",
        variant: "destructive",
      });

      return { success: false, error: "予期しないエラーが発生しました" };
    } finally {
      setIsProcessing(false);
    }
  };

  const secureSignUp = async (email: string, password: string, displayName?: string) => {
    setIsProcessing(true);
    
    try {
      // パスワード強度確認
      const passwordValidation = await authSecurity.validatePasswordStrength(password);
      
      if (!passwordValidation.valid) {
        toast({
          title: "パスワードが要件を満たしていません",
          description: passwordValidation.errors.join(', '),
          variant: "destructive",
        });
        
        return { 
          success: false, 
          error: `パスワード要件: ${passwordValidation.errors.join(', ')}` 
        };
      }

      // 実際のサインアップ
      const result = await signUp(email, password, displayName);
      
      if (result.success) {
        toast({
          title: "アカウント作成成功",
          description: "確認メールをお送りしました。メールボックスをご確認ください。",
        });
        
        // セッション監視開始
        if (result.user) {
          await authSecurity.monitorSession(result.user.id, 'signup_success');
        }
      } else {
        toast({
          title: "アカウント作成に失敗しました",
          description: result.error || "アカウント作成中にエラーが発生しました。",
          variant: "destructive",
        });
      }

      return result;
    } catch (error) {
      console.error('Secure sign up error:', error);
      
      toast({
        title: "エラーが発生しました",
        description: "アカウント作成中にエラーが発生しました。",
        variant: "destructive",
      });

      return { success: false, error: "予期しないエラーが発生しました" };
    } finally {
      setIsProcessing(false);
    }
  };

  const secureSignOut = async () => {
    try {
      await authSecurity.secureLogout();
      
      toast({
        title: "ログアウトしました",
        description: "安全にログアウトしました。",
      });
    } catch (error) {
      console.error('Secure sign out error:', error);
      
      toast({
        title: "ログアウト中にエラーが発生しました",
        description: "再度お試しください。",
        variant: "destructive",
      });
    }
  };

  return {
    secureSignIn,
    secureSignUp,
    secureSignOut,
    isProcessing
  };
};
