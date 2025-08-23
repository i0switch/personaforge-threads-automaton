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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    
    // iOS Safari特有の問題を検出
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                       /WebKit/.test(navigator.userAgent) && 
                       !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent);
    
    // プレビュー環境チェック
    const isPreview = window.location.hostname.includes('preview--threads-genius-ai.lovable.app');
    if (isPreview) {
      console.log('プレビュー環境でエラー発生。本番環境にリダイレクトします...');
      const targetUrl = window.location.href.replace('preview--threads-genius-ai.lovable.app', 'threads-genius-ai.lovable.app');
      window.location.replace(targetUrl);
      return;
    }
    
    // Store error details for better debugging
    if (typeof window !== 'undefined') {
      (window as any).__lastErrorInfo = {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        isPreview: isPreview,
        hostname: window.location.hostname,
        isIOSSafari: isIOSSafari
      };
    }
    
    // エラー詳細をSupabaseにログ送信（非同期、エラーを投げない）
    setTimeout(async () => {
      try {
        await supabase.from('security_events').insert({
          event_type: 'client_error',
          details: {
            error_message: error.message,
            error_stack: error.stack,
            component_stack: errorInfo.componentStack,
            user_agent: navigator.userAgent,
            is_ios_safari: isIOSSafari,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            is_preview: isPreview
          }
        });
        console.log('エラーログをSupabaseに送信しました');
      } catch (logError) {
        console.warn('エラーログ送信失敗:', logError);
      }
    }, 0);
  }

  public render() {
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
              {import.meta.env.DEV && this.state.error && (
                <div className="text-xs text-left bg-muted p-3 rounded mt-4 overflow-auto">
                  <pre>{this.state.error.message}</pre>
                </div>
              )}
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
                  
                  // セッションストレージクリア
                  sessionStorage.clear();
                  
                  console.log('iOS Safari向けキャッシュクリア実行');
                } catch (clearError) {
                  console.warn('キャッシュクリア失敗:', clearError);
                }
              }
              
              if (window.location.hostname.includes('preview')) {
                const targetUrl = window.location.href.replace('preview--threads-genius-ai.lovable.app', 'threads-genius-ai.lovable.app');
                window.location.replace(targetUrl);
              } else {
                window.location.reload();
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