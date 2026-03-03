
import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authSecurity } from "@/utils/authSecurity";
import { authHandler } from "@/utils/authHandler";
import { initializeErrorTracking } from '@/utils/errorTracking';

// Supabase認証関連のストレージのみクリア（他アプリ設定は保持）
const SUPABASE_STORAGE_PREFIX = 'sb-';
function clearSupabaseStorage() {
  const lsKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(SUPABASE_STORAGE_PREFIX)) lsKeys.push(key);
  }
  lsKeys.forEach(k => localStorage.removeItem(k));

  const ssKeys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(SUPABASE_STORAGE_PREFIX)) ssKeys.push(key);
  }
  ssKeys.forEach(k => sessionStorage.removeItem(k));
}

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
    if (import.meta.env.DEV) console.log('Setting up auth state listener');

    const ua = navigator.userAgent;
    const isIpadOS13Plus = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || isIpadOS13Plus;
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|OPiOS|EdgiOS|mercury/.test(ua);
    const isWebKit = /AppleWebKit/.test(ua) || /WebKit/.test(ua);
    const isIOSSafari = isIOS && isSafari && isWebKit;

    let subscription: any = null;

    if (isIOSSafari) {
      if (import.meta.env.DEV) console.warn('iOS Safari 環境のため、auth監視をポーリングに切り替えます');
      
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
            if (import.meta.env.DEV) console.log('Token refresh failed, clearing session');
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }
          
          if (event === 'SIGNED_OUT' || !session) {
            if (import.meta.env.DEV) console.log('User signed out or session invalid, clearing state');
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
        if (import.meta.env.DEV) console.log('プレビュー環境を検出。本番環境にリダイレクトします...');
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

        if (import.meta.env.DEV) console.log('🔍 Checking for existing session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('❌ Error getting session:', error);
      // Supabase認証キーのみクリア（他アプリ設定は保持）
      clearSupabaseStorage();
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

              // base64url対応デコード
              let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              while (base64.length % 4) {
                base64 += '=';
              }
              const payload = JSON.parse(atob(base64));
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

            if (import.meta.env.DEV) console.log('✅ Session token valid');
          } catch (tokenError) {
            console.error('❌ Token validation failed, clearing session:', tokenError);
            clearSupabaseStorage();
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
          if (import.meta.env.DEV) console.log(session ? '✅ Found existing valid session' : 'ℹ️ No session found');
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
        clearSupabaseStorage();
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
      if (import.meta.env.DEV) console.log('Cleaning up auth listener');
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
      if (import.meta.env.DEV) console.log('Attempting signup for:', email);
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
      if (import.meta.env.DEV) console.log('Signup result:', error ? 'error' : 'success');
      
      // プロファイル・アカウントステータスはDBトリガー(handle_new_user)で自動作成
      // フロントからの二重作成は行わない
      
      return { error };
    } catch (error) {
      console.error('Signup error:', error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      if (import.meta.env.DEV) console.log('Attempting signin for:', email);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (import.meta.env.DEV) console.log('Signin result:', error ? 'error' : 'success');

      if (!error) {
        // セッション監視（ログイン）
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.id) {
              authSecurity.monitorSession(session.user.id, 'login');
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
      if (import.meta.env.DEV) console.log('Attempting signout');

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

  if (import.meta.env.DEV) console.log('AuthProvider rendering with user:', !!user, 'loading:', loading);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
