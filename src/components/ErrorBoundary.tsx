import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('======= ErrorBoundary: 詳細エラーログ開始 =======');
    console.error('エラーメッセージ:', error.message);
    console.error('エラースタック:', error.stack);
    console.error('コンポーネントスタック:', errorInfo.componentStack);
    
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
    
    // プレビュー環境からの即座リダイレクト
    if (isPreview) {
      console.log('プレビュー環境でエラー発生。本番環境にリダイレクトします...');
      const targetUrl = window.location.href.replace('preview--threads-genius-ai.lovable.app', 'threads-genius-ai.lovable.app');
      window.location.replace(targetUrl);
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
        
        if (retryCount < 2) {
          // 1秒後にリトライ
          setTimeout(() => sendErrorLog(retryCount + 1), 1000);
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
            </p>
                <div className="space-y-2">
                  <div className="text-left bg-destructive/10 border border-destructive/30 p-3 rounded">
                    <p className="text-sm font-semibold">エラー詳細</p>
                    <p className="text-sm break-words">{this.state.error?.message || '不明なエラー'}</p>
                  </div>
                  <div className="text-xs text-left bg-muted p-3 rounded overflow-auto max-h-60">
                    <pre className="whitespace-pre-wrap">{(window as any).__lastErrorInfo?.componentStack || this.state.error?.stack || 'no stack'}</pre>
                  </div>
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