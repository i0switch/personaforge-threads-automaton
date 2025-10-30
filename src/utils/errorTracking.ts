/**
 * エラー監視・トラッキングシステム
 * 目的：障害原因の迅速特定、エラーパターンの分析
 */

import { supabase } from '@/integrations/supabase/client';

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  additionalData?: Record<string, any>;
}

export interface TrackedError {
  message: string;
  stack?: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class ErrorTracker {
  private errors: TrackedError[] = [];
  private maxErrors = 100; // メモリ内保持上限

  /**
   * エラーを記録（セキュリティイベントとして保存）
   */
  async trackError(error: Error | string, context: ErrorContext, severity: TrackedError['severity'] = 'medium') {
    const trackedError: TrackedError = {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' ? error.stack : undefined,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
      severity,
    };

    // メモリ内保持
    this.errors.push(trackedError);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // コンソール出力（開発環境）
    if (import.meta.env.DEV) {
      console.error(`[${severity.toUpperCase()}]`, trackedError.message, trackedError);
    }

    // Supabaseセキュリティイベントに記録
    try {
      await supabase.from('security_events').insert({
        event_type: `error_${severity}`,
        user_id: context.userId || null,
        ip_address: null, // クライアント側では取得不可
        user_agent: navigator.userAgent,
        details: {
          message: trackedError.message,
          stack: trackedError.stack,
          component: context.component,
          action: context.action,
          url: trackedError.context.url,
          additionalData: context.additionalData,
        },
      });
    } catch (loggingError) {
      // ログ記録失敗は無視（無限ループ防止）
      console.warn('Failed to log error to Supabase:', loggingError);
    }
  }

  /**
   * パフォーマンス計測
   */
  trackPerformance(metricName: string, value: number, context?: ErrorContext) {
    if (import.meta.env.DEV) {
      console.log(`[PERF] ${metricName}:`, value, 'ms', context);
    }

    // 閾値超過時はエラーとして記録
    if (value > 3000) { // 3秒以上
      this.trackError(
        `Performance issue: ${metricName} took ${value}ms`,
        { ...context, action: 'performance_monitoring' },
        'low'
      );
    }
  }

  /**
   * Web Vitals計測（LCP, FID, CLS）
   */
  trackWebVitals() {
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        this.trackPerformance('LCP', lastEntry.renderTime || lastEntry.loadTime);
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      // First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.trackPerformance('FID', entry.processingStart - entry.startTime);
        });
      });
      fidObserver.observe({ type: 'first-input', buffered: true });

      // Cumulative Layout Shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      // ページ離脱時にCLSを記録
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.trackPerformance('CLS', clsValue * 1000); // スコアをms換算
        }
      });
    }
  }

  /**
   * 最近のエラー取得
   */
  getRecentErrors(count: number = 10): TrackedError[] {
    return this.errors.slice(-count);
  }

  /**
   * エラーパターン分析
   */
  analyzeErrorPatterns(): { pattern: string; count: number }[] {
    const patterns = new Map<string, number>();
    
    this.errors.forEach((error) => {
      const pattern = error.context.component || 'unknown';
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    });

    return Array.from(patterns.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count);
  }
}

// シングルトンインスタンス
export const errorTracker = new ErrorTracker();

/**
 * グローバルエラーハンドラー初期化
 */
export const initializeErrorTracking = (userId?: string) => {
  // 未処理のエラーをキャッチ
  window.addEventListener('error', (event) => {
    errorTracker.trackError(
      event.error || event.message,
      {
        component: 'global',
        action: 'unhandled_error',
        userId,
        additionalData: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      },
      'high'
    );
  });

  // 未処理のPromise拒否をキャッチ
  window.addEventListener('unhandledrejection', (event) => {
    errorTracker.trackError(
      event.reason,
      {
        component: 'global',
        action: 'unhandled_promise_rejection',
        userId,
      },
      'high'
    );
  });

  // Web Vitals計測開始
  errorTracker.trackWebVitals();

  console.log('✅ Error tracking initialized');
};
