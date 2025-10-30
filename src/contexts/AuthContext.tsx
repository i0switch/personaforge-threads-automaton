
import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authSecurity } from "@/utils/authSecurity";
import { authHandler } from "@/utils/authHandler";
import { initializeErrorTracking } from '@/utils/errorTracking';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
  retryAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Development logging only
  if (import.meta.env.DEV) {
    console.log('AuthProvider initialized');
  }
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let initialLoadComplete = false;
    let pollTimer: number | null = null;
    console.log('Setting up auth state listener');

    const ua = navigator.userAgent;
    const isIpadOS13Plus = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || isIpadOS13Plus;
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|OPiOS|EdgiOS|mercury/.test(ua);
    const isWebKit = /AppleWebKit/.test(ua) || /WebKit/.test(ua);
    const isIOSSafari = isIOS && isSafari && isWebKit;

    let subscription: any = null;

    if (isIOSSafari) {
      console.warn('iOS Safari 環境のため、auth監視をポーリングに切り替えます');
      
      // iOS Safariではポーリングで認証状態をチェック
      const checkAuthState = async () => {
        if (!mounted) return;
        
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) {
            console.error('Error getting session during polling:', error);
            return;
          }
          
          if (session) {
            setSession(session);
            setUser(session.user);
          } else {
            setSession(null);
            setUser(null);
          }
          
          if (!initialLoadComplete) {
            setLoading(false);
            initialLoadComplete = true;
          }
        } catch (error) {
          console.error('Auth polling error:', error);
        }
      };
      
      // 初回チェック
      checkAuthState();
      // 定期的なポーリング
      pollTimer = window.setInterval(checkAuthState, 10000);
    } else {
      // 通常のブラウザではRealtime監視
      subscription = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!mounted) return;
          
          if (import.meta.env.DEV) {
            console.log('Auth state change:', event, session?.user?.id);
          }
          
          // Handle token revoked or signed out events
          if (event === 'TOKEN_REFRESHED' && !session) {
            console.log('Token refresh failed, clearing session');
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }
          
          if (event === 'SIGNED_OUT' || !session) {
            console.log('User signed out or session invalid, clearing state');
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }
          
          setSession(session);
          setUser(session?.user ?? null);
          
          // Always update loading state on auth changes
          if (mounted) {
            setLoading(false);
            initialLoadComplete = true;
          }
        }
      ).data.subscription;
    }

    // プレビュー→本番リダイレクトガード
    const checkAndRedirectFromPreview = () => {
      const currentHost = window.location.hostname;
      const currentUrl = window.location.href;
      
      if (currentHost.includes('preview--threads-genius-ai.lovable.app')) {
        console.log('プレビュー環境を検出。本番環境にリダイレクトします...');
        const targetUrl = currentUrl.replace('preview--threads-genius-ai.lovable.app', 'threads-genius-ai.lovable.app');
        window.location.replace(targetUrl);
        return true; // リダイレクト実行
      }
      return false; // リダイレクトなし
    };

    // Check for existing session
    const initializeAuth = async () => {
      try {
        // プレビュー→本番リダイレクトチェック
        if (checkAndRedirectFromPreview()) {
          return; // リダイレクト中のため処理中断
        }

        console.log('🔍 Checking for existing session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('❌ Error getting session:', error);
          // Clear potentially corrupted session data
          localStorage.clear();
          sessionStorage.clear();
          await supabase.auth.signOut({ scope: 'local' });
          if (mounted && !initialLoadComplete) {
            setSession(null);
            setUser(null);
            setLoading(false);
            initialLoadComplete = true;
          }
          return;
        }
        
        // Validate session if it exists
        if (session) {
          try {
            // トークン構造と内容を検証
            const parts = session.access_token.split('.');
            if (parts.length !== 3) {
              console.error('❌ Invalid token structure');
              throw new Error('Invalid token structure');
            }

            const payload = JSON.parse(atob(parts[1]));
            if (!payload.sub) {
              console.error('❌ Token missing sub claim');
              throw new Error('Token missing sub claim');
            }

            if (payload.exp && payload.exp * 1000 < Date.now()) {
              console.error('❌ Token expired');
              throw new Error('Token expired');
            }

            // Check if token is still valid by making a simple API call
            const { error: testError } = await supabase.from('user_account_status').select('user_id').limit(1);
            if (testError && (testError.message.includes('invalid claim') || testError.message.includes('bad_jwt'))) {
              console.error('❌ Session token invalid:', testError.message);
              throw new Error('Session token invalid');
            }

            console.log('✅ Session token valid');
          } catch (tokenError) {
            console.error('❌ Token validation failed, clearing session:', tokenError);
            localStorage.clear();
            sessionStorage.clear();
            await supabase.auth.signOut({ scope: 'local' });
            if (mounted && !initialLoadComplete) {
              setSession(null);
              setUser(null);
              setLoading(false);
              initialLoadComplete = true;
            }
            return;
          }
        }
        
        if (mounted && !initialLoadComplete) {
          console.log(session ? '✅ Found existing valid session' : 'ℹ️ No session found');
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          initialLoadComplete = true;
          
          // エラートラッキング初期化
          if (session?.user) {
            initializeErrorTracking(session.user.id);
          }
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        // Clear session on any error
        localStorage.clear();
        sessionStorage.clear();
        await supabase.auth.signOut({ scope: 'local' });
        if (mounted && !initialLoadComplete) {
          setSession(null);
          setUser(null);
          setLoading(false);
          initialLoadComplete = true;
        }
      }
    };

    initializeAuth();

    return () => {
      console.log('Cleaning up auth listener');
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
    };
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      console.log('Attempting signup for:', email); // デバッグ用ログ追加
      // 本番環境のURLを強制使用
      const redirectUrl = 'https://threads-genius-ai.lovable.app/';
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName
          }
        }
      });
      console.log('Signup result:', error ? 'error' : 'success'); // デバッグ用ログ追加
      
      // サインアップ成功時にプロファイルとアカウントステータスを作成
      if (!error && data.user) {
        try {
          console.log('Creating profile for new user:', data.user.id);
          
          // プロファイル作成
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: data.user.id,
              display_name: displayName || email
            });
          
          if (profileError) {
            console.error('Profile creation error:', profileError);
          } else {
            console.log('Profile created successfully');
          }
          
          // アカウントステータス作成
          const { error: statusError } = await supabase
            .from('user_account_status')
            .insert({
              user_id: data.user.id,
              is_active: true,
              is_approved: true,
              persona_limit: 1
            });
          
          if (statusError) {
            console.error('Account status creation error:', statusError);
          } else {
            console.log('Account status created successfully');
          }
        } catch (profileCreationError) {
          console.error('Error creating user profile data:', profileCreationError);
          // プロファイル作成エラーはサインアップをブロックしない
        }
      }
      
      return { error };
    } catch (error) {
      console.error('Signup error:', error); // デバッグ用ログ追加
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting signin for:', email); // デバッグ用ログ追加
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      console.log('Signin result:', error ? 'error' : 'success'); // デバッグ用ログ追加

      if (!error) {
        // セッション監視（ログイン）
        setTimeout(() => {
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.id) {
              authSecurity.monitorSession(user.id, 'login');
            }
          });
        }, 0);
      }

      return { error };
    } catch (error) {
      console.error('Signin error:', error); // デバッグ用ログ追加
      return { error };
    }
  };
  const signOut = async () => {
    try {
      console.log('Attempting signout'); // デバッグ用ログ追加

      // セッション監視（ログアウト）
      try {
        if (user?.id) {
          await authSecurity.monitorSession(user.id, 'logout');
        }
      } catch (e) {
        console.error('Monitor logout error:', e);
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        // Handle specific error cases
        if (error.message.includes('session_not_found') || 
            error.message.includes('Session not found')) {
          // Session already invalid, just clear local state
          setSession(null);
          setUser(null);
          return;
        }
        throw error;
      }
      
      // Clear local state on successful sign out
      setSession(null);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      // On any error, clear local state to prevent inconsistent state
      setSession(null);
      setUser(null);
      throw error;
    }
  };
  const retryAuth = async (): Promise<boolean> => {
    try {
      const success = await authHandler.retrySession();
      if (success) {
        // セッション状態を更新
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
      }
      return success;
    } catch (error) {
      console.error('Auth retry failed:', error);
      return false;
    }
  };

  const value = {
    user,
    session,
    signUp,
    signIn,
    signOut,
    loading,
    retryAuth,
  };

  console.log('AuthProvider rendering with user:', !!user, 'loading:', loading); // デバッグ用ログ追加

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
