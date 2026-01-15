import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { errorTracker } from '@/utils/errorTracking';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  private _isMounted = false;
  private _pendingTimeouts: number[] = [];

  public state: State = {
    hasError: false
  };

  public componentDidMount() {
    this._isMounted = true;
  }

  public componentWillUnmount() {
    this._isMounted = false;
    // すべての保留中のタイムアウトをクリア
    this._pendingTimeouts.forEach(id => clearTimeout(id));
    this._pendingTimeouts = [];
  }

  public static getDerivedStateFromError(error: Error): State {
    // removeChild エラーはReact DOMの競合問題で、通常は無害
    // ブラウザ拡張機能やポータルの競合が原因のことが多い
    const isRemoveChildError = error.message?.includes('removeChild') || 
                               error.name === 'NotFoundError';
    
    // removeChildエラーの場合はページリロードで回復を試みる
    if (isRemoveChildError && typeof window !== 'undefined') {
      console.warn('removeChild DOM競合を検出しました。自動回復を試みます...');
      
      // 短い遅延後にリロードを試みる（無限ループを防ぐため、セッション中1回のみ）
      const reloadKey = '__removeChildReloadAttempted';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, 'true');
        setTimeout(() => {
          window.location.reload();
        }, 100);
        // リロード中はエラー画面を表示しない
        return { hasError: false };
      }
    }
    
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('======= ErrorBoundary: 詳細エラーログ開始 =======');
    console.error('エラーメッセージ:', error.message);
    console.error('エラースタック:', error.stack);
    console.error('コンポーネントスタック:', errorInfo.componentStack);
    
    // エラートラッキングシステムに記録
    errorTracker.trackError(error, {
      component: 'ErrorBoundary',
      action: 'component_error',
      additionalData: {
        componentStack: errorInfo.componentStack,
      },
    }, 'critical');
    
    // 環境情報の詳細収集
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                       /WebKit/.test(navigator.userAgent) && 
                       !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent);
    const isPreview = window.location.hostname.includes('preview--threads-genius-ai.lovable.app');
    const currentTime = new Date().toISOString();
    
    // 詳細情報をコンソールに出力
    console.error('環境情報:', {
      userAgent: navigator.userAgent,
      url: window.location.href,
      hostname: window.location.hostname,
      isIOSSafari,
      isPreview,
      timestamp: currentTime,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      localStorageAvailable: (() => {
        try {
          const test = '__test__';
          localStorage.setItem(test, test);
          localStorage.removeItem(test);
          return true;
        } catch {
          return false;
        }
      })(),
      sessionStorageAvailable: (() => {
        try {
          const test = '__test__';
          sessionStorage.setItem(test, test);
          sessionStorage.removeItem(test);
          return true;
        } catch {
          return false;
        }
      })()
    });
    
    // プレビュー環境からのリダイレクト（少し待機してからDOM操作の競合を防ぐ）
    if (isPreview) {
      console.log('プレビュー環境でエラー発生。本番環境にリダイレクトします...');
      const timeoutId = window.setTimeout(() => {
        const targetUrl = window.location.href.replace('preview--threads-genius-ai.lovable.app', 'threads-genius-ai.lovable.app');
        window.location.replace(targetUrl);
      }, 100);
      this._pendingTimeouts.push(timeoutId);
      return;
    }
    
    // グローバルエラー情報の保存
    if (typeof window !== 'undefined') {
      (window as any).__lastErrorInfo = {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: currentTime,
        isPreview,
        hostname: window.location.hostname,
        isIOSSafari,
        userAgent: navigator.userAgent,
        url: window.location.href,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        storageStatus: {
          localStorage: (() => {
            try {
              const test = '__test__';
              localStorage.setItem(test, test);
              localStorage.removeItem(test);
              return 'available';
            } catch {
              return 'unavailable';
            }
          })(),
          sessionStorage: (() => {
            try {
              const test = '__test__';
              sessionStorage.setItem(test, test);
              sessionStorage.removeItem(test);
              return 'available';
            } catch {
              return 'unavailable';
            }
          })()
        }
      };
    }
    
    // Supabaseへの詳細ログ送信（複数回リトライ）
    const sendErrorLog = async (retryCount = 0) => {
      // コンポーネントがアンマウントされていたら中止
      if (!this._isMounted) {
        console.log('ErrorBoundary: コンポーネントがアンマウントされたため、ログ送信を中止');
        return;
      }

      try {
        console.log(`エラーログ送信試行 ${retryCount + 1}/3`);
        
        const logData = {
          event_type: 'critical_client_error',
          user_id: null, // 認証エラーの可能性があるため
          details: {
            error_message: error.message,
            error_name: error.name,
            error_stack: error.stack,
            component_stack: errorInfo.componentStack,
            user_agent: navigator.userAgent,
            url: window.location.href,
            hostname: window.location.hostname,
            is_ios_safari: isIOSSafari,
            is_preview: isPreview,
            timestamp: currentTime,
            language: navigator.language,
            platform: navigator.platform,
            cookie_enabled: navigator.cookieEnabled,
            online_status: navigator.onLine,
            viewport_size: `${window.innerWidth}x${window.innerHeight}`,
            local_storage_available: (() => {
              try {
                const test = '__test__';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
              } catch {
                return false;
              }
            })(),
            session_storage_available: (() => {
              try {
                const test = '__test__';
                sessionStorage.setItem(test, test);
                sessionStorage.removeItem(test);
                return true;
              } catch {
                return false;
              }
            })(),
            retry_count: retryCount
          }
        };
        
        const { data, error: insertError } = await supabase
          .from('security_events')
          .insert(logData);
        
        if (insertError) {
          throw insertError;
        }
        
        console.log('✅ エラーログをSupabaseに送信成功:', data);
        console.error('======= ErrorBoundary: 詳細エラーログ終了 =======');
        
      } catch (logError) {
        console.warn(`❌ エラーログ送信失敗 (試行 ${retryCount + 1}/3):`, logError);
        
        if (retryCount < 2 && this._isMounted) {
          // 1秒後にリトライ（コンポーネントがマウントされている場合のみ）
          const timeoutId = window.setTimeout(() => sendErrorLog(retryCount + 1), 1000);
          this._pendingTimeouts.push(timeoutId);
        } else {
          console.error('❌ エラーログ送信を諦めました');
          console.error('======= ErrorBoundary: 詳細エラーログ終了 =======');
        }
      }
    };
    
    // 非同期でログ送信（即座に実行）
    sendErrorLog();
  }

  public render() {
    const debug = (() => {
      try {
        return new URLSearchParams(window.location.search).get('debug') === '1';
      } catch {
        return false;
      }
    })();
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-md mx-auto text-center space-y-4">
            <AlertCircle className="h-16 w-16 mx-auto text-destructive" />
          <div>
            <h1 className="text-2xl font-bold mb-2">予期しないエラーが発生しました</h1>
            <p className="text-muted-foreground mb-4">
              申し訳ございませんが、予期しないエラーが発生しました。
              {window.location.hostname.includes('preview') ? 
                '本番環境に移動してお試しください。' : 
                'ページを再読み込みしてください。'
              }
              {(debug || import.meta.env.DEV) && (
                <>
                  <br />
                  <span className="text-xs text-destructive-foreground font-mono">{this.state.error?.message || (window as any).__lastErrorInfo?.error || '詳細なし'}</span>
                </>
              )}
            </p>
                <div className="space-y-2">
                  <div className="text-left bg-destructive/10 border border-destructive/30 p-3 rounded">
                    <p className="text-sm font-semibold">エラー詳細</p>
                    <p className="text-sm break-words">{this.state.error?.message || '不明なエラー'}</p>
                  </div>
                  <div className="text-xs text-left bg-muted p-3 rounded overflow-auto max-h-60">
                    <pre className="whitespace-pre-wrap">{this.state.error?.stack || 'no stack'}</pre>
                  </div>
                  {(debug || import.meta.env.DEV) && (
                    <div className="text-xs text-left bg-muted p-3 rounded overflow-auto max-h-40">
                      <p className="font-semibold mb-1">__lastErrorInfo (JSON)</p>
                      <pre className="whitespace-pre-wrap">{JSON.stringify((window as any).__lastErrorInfo ?? {}, null, 2)}</pre>
                    </div>
                  )}
                </div>
            </div>
          <Button 
            onClick={() => {
              // iOS Safari特有の対策
              const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                                 /WebKit/.test(navigator.userAgent) && 
                                 !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent);
              
              if (isIOSSafari) {
                try {
                  // Service Worker登録解除
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(registrations => {
                      registrations.forEach(registration => registration.unregister());
                    });
                  }
                  
                  // セッション/ローカルストレージクリア
                  sessionStorage.clear();
                  try { localStorage.clear(); } catch {}
                  
                  console.log('iOS Safari向けキャッシュクリア実行（SW/Storage cleared）');
                } catch (clearError) {
                  console.warn('キャッシュクリア失敗:', clearError);
                }
              }
              
              // キャッシュバスター付きでリロード
              const url = new URL(window.location.href);
              url.searchParams.set('cb', Date.now().toString());
              if (window.location.hostname.includes('preview')) {
                const targetUrl = url.toString().replace('preview--threads-genius-ai.lovable.app', 'threads-genius-ai.lovable.app');
                window.location.replace(targetUrl);
              } else {
                window.location.replace(url.toString());
              }
            }} 
            className="w-full"
          >
            {window.location.hostname.includes('preview') ? '本番環境に移動' : 'ページを再読み込み'}
          </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}