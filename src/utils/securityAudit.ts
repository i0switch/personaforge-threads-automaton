
import { supabase } from '@/integrations/supabase/client';
import { securityMiddleware } from './securityMiddleware';

export interface SecurityAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  category: 'authentication' | 'authorization' | 'injection' | 'file_upload' | 'rate_limit' | 'suspicious_activity';
  message: string;
  details: any;
  resolved: boolean;
  created_at: string;
}

export interface SecurityScanResult {
  vulnerabilities: {
    high: number;
    medium: number;
    low: number;
  };
  recommendations: string[];
  lastScan: string;
}

export const securityAudit = {
  // 異常な活動を検知
  detectAnomalousActivity: async (userId: string, activity: any) => {
    try {
      // 短時間での大量リクエスト検知
      const recentLogs = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (recentLogs.data && recentLogs.data.length > 50) {
        await securityAudit.createAlert({
          type: 'warning',
          category: 'rate_limit',
          message: '短時間での大量リクエストが検出されました',
          details: {
            userId,
            requestCount: recentLogs.data.length,
            timeWindow: '5分',
            activity
          }
        });
      }

      // 失敗したログイン試行の監視
      const failedAttempts = recentLogs.data?.filter(log => 
        log.action_type?.includes('failed') || log.action_type?.includes('error')
      ).length || 0;

      if (failedAttempts > 10) {
        await securityAudit.createAlert({
          type: 'critical',
          category: 'authentication',
          message: '複数回の認証失敗が検出されました',
          details: {
            userId,
            failedAttempts,
            timeWindow: '5分'
          }
        });
      }

    } catch (error) {
      console.error('Anomaly detection error:', error);
    }
  },

  // セキュリティアラートを作成
  createAlert: async (alert: Omit<SecurityAlert, 'id' | 'resolved' | 'created_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('activity_logs')
        .insert({
          user_id: user?.id || 'system',
          action_type: `security_alert_${alert.category}`,
          description: alert.message,
          metadata: {
            type: alert.type,
            category: alert.category,
            details: alert.details,
            timestamp: new Date().toISOString()
          }
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to create security alert:', error);
    }
  },

  // セキュリティスキャンを実行
  performSecurityScan: async (userId: string): Promise<SecurityScanResult> => {
    const vulnerabilities = { high: 0, medium: 0, low: 0 };
    const recommendations: string[] = [];

    try {
      // APIキーの安全性チェック
      const { data: apiKeys } = await supabase
        .from('user_api_keys')
        .select('key_name, created_at')
        .eq('user_id', userId);

      if (apiKeys) {
        // 古いAPIキーの警告
        const oldKeys = apiKeys.filter(key => {
          const keyAge = Date.now() - new Date(key.created_at).getTime();
          return keyAge > 90 * 24 * 60 * 60 * 1000; // 90日以上
        });

        if (oldKeys.length > 0) {
          vulnerabilities.medium += oldKeys.length;
          recommendations.push(`${oldKeys.length}個のAPIキーが90日以上更新されていません。定期的な更新を推奨します。`);
        }
      }

      // 最近のセキュリティイベントチェック
      const { data: recentAlerts } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .like('action_type', 'security_%')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (recentAlerts && recentAlerts.length > 0) {
        const criticalAlerts = recentAlerts.filter(alert => {
          // metadataがnullまたはundefinedの場合の処理
          if (!alert.metadata) return false;
          
          // metadataが文字列の場合はJSONパースを試行
          if (typeof alert.metadata === 'string') {
            try {
              const parsed = JSON.parse(alert.metadata);
              return parsed.type === 'critical';
            } catch {
              return false;
            }
          }
          
          // metadataがオブジェクトの場合は直接アクセス
          if (typeof alert.metadata === 'object' && alert.metadata !== null) {
            return (alert.metadata as any).type === 'critical';
          }
          
          return false;
        }).length;
        
        if (criticalAlerts > 0) {
          vulnerabilities.high += criticalAlerts;
          recommendations.push(`${criticalAlerts}件の重要なセキュリティアラートが未解決です。`);
        }
      }

      // ペルソナのセキュリティ設定チェック
      const { data: personas } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (personas) {
        const weakConfig = personas.filter(persona => 
          !persona.threads_app_secret || !persona.webhook_verify_token
        ).length;

        if (weakConfig > 0) {
          vulnerabilities.medium += weakConfig;
          recommendations.push(`${weakConfig}個のペルソナでセキュリティ設定が不完全です。`);
        }
      }

      // 基本的なセキュリティ推奨事項
      if (vulnerabilities.high === 0 && vulnerabilities.medium === 0) {
        recommendations.push('セキュリティ設定は良好です。定期的なスキャンを継続してください。');
      }

      return {
        vulnerabilities,
        recommendations,
        lastScan: new Date().toISOString()
      };

    } catch (error) {
      console.error('Security scan error:', error);
      return {
        vulnerabilities: { high: 1, medium: 0, low: 0 },
        recommendations: ['セキュリティスキャン中にエラーが発生しました。'],
        lastScan: new Date().toISOString()
      };
    }
  },

  // セキュリティ設定の検証
  validateSecuritySettings: async (userId: string) => {
    const issues: string[] = [];

    try {
      // プロファイル設定の確認
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!profile) {
        issues.push('プロファイル設定が見つかりません');
      }

      // 自動返信設定の確認
      if (profile?.auto_reply_enabled && profile?.ai_auto_reply_enabled) {
        issues.push('自動返信とAI自動返信が同時に有効になっています');
      }

      // APIキーの確認
      const { data: apiKeys } = await supabase
        .from('user_api_keys')
        .select('key_name')
        .eq('user_id', userId);

      const hasGeminiKey = apiKeys?.some(key => key.key_name === 'GEMINI_API_KEY');
      if (profile?.ai_auto_reply_enabled && !hasGeminiKey) {
        issues.push('AI自動返信が有効ですが、Gemini APIキーが設定されていません');
      }

      return issues;

    } catch (error) {
      console.error('Security validation error:', error);
      return ['セキュリティ設定の検証中にエラーが発生しました'];
    }
  }
};
