import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

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
        hostname: window.location.hostname
      };
    }
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