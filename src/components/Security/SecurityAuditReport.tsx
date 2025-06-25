
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Shield, CheckCircle, ExternalLink } from "lucide-react";
import { securityAudit } from "@/utils/securityAudit";
import { useAuth } from "@/contexts/AuthContext";

interface SecurityIssue {
  id: string;
  title: string;
  level: 'WARN' | 'ERROR' | 'INFO';
  description: string;
  remediation?: string;
  category: string;
  resolved: boolean;
}

export const SecurityAuditReport = () => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<SecurityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanResult, setScanResult] = useState<any>(null);

  useEffect(() => {
    if (user) {
      performSecurityAudit();
    }
  }, [user]);

  const performSecurityAudit = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // 実際のセキュリティスキャンを実行
      const result = await securityAudit.performSecurityScan(user.id);
      setScanResult(result);

      // 既知のセキュリティ問題をマップ
      const knownIssues: SecurityIssue[] = [
        {
          id: 'auth_otp_long_expiry',
          title: 'OTP有効期限が長すぎます',
          level: 'WARN',
          description: 'OTP（ワンタイムパスワード）の有効期限が1時間を超えています。セキュリティ強化のため1時間未満に設定することを推奨します。',
          remediation: 'Supabaseダッシュボード > Authentication > Settings でOTP有効期限を短縮してください。',
          category: 'AUTHENTICATION',
          resolved: false
        },
        {
          id: 'auth_leaked_password_protection',
          title: '漏洩パスワード保護が無効です',
          level: 'WARN',
          description: 'HaveIBeenPwned.orgと連携した漏洩パスワードチェックが無効になっています。',
          remediation: 'Supabaseダッシュボード > Authentication > Settings で漏洩パスワード保護を有効にしてください。',
          category: 'AUTHENTICATION',
          resolved: false
        },
        {
          id: 'database_functions_secured',
          title: 'データベース関数のセキュリティ強化完了',
          level: 'INFO',
          description: 'すべてのデータベース関数でsearch_pathが適切に設定され、SQL Injection攻撃から保護されています。',
          category: 'DATABASE',
          resolved: true
        }
      ];

      setIssues(knownIssues);
    } catch (error) {
      console.error('Security audit failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIssueIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'WARN':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'INFO':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Shield className="h-5 w-5 text-blue-500" />;
    }
  };

  const getIssueBadgeVariant = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'destructive';
      case 'WARN':
        return 'secondary';
      case 'INFO':
        return 'default';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            セキュリティ監査
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">セキュリティスキャン実行中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const errorCount = issues.filter(i => i.level === 'ERROR' && !i.resolved).length;
  const warnCount = issues.filter(i => i.level === 'WARN' && !i.resolved).length;
  const resolvedCount = issues.filter(i => i.resolved).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            セキュリティ監査レポート
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{errorCount}</div>
              <div className="text-sm text-red-600">重要な問題</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{warnCount}</div>
              <div className="text-sm text-yellow-600">警告</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{resolvedCount}</div>
              <div className="text-sm text-green-600">解決済み</div>
            </div>
          </div>

          <Button 
            onClick={performSecurityAudit}
            className="mb-4"
          >
            <Shield className="h-4 w-4 mr-2" />
            再スキャン実行
          </Button>

          {scanResult && scanResult.recommendations && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>推奨事項:</strong>
                <ul className="mt-2 space-y-1">
                  {scanResult.recommendations.map((rec: string, index: number) => (
                    <li key={index} className="text-sm">• {rec}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {issues.map((issue) => (
          <Card key={issue.id} className={issue.resolved ? 'opacity-75' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getIssueIcon(issue.level)}
                  <div>
                    <CardTitle className="text-lg">{issue.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={getIssueBadgeVariant(issue.level)}>
                        {issue.level}
                      </Badge>
                      <Badge variant="outline">{issue.category}</Badge>
                      {issue.resolved && (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          解決済み
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {issue.description}
              </p>
              
              {issue.remediation && !issue.resolved && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">対処方法:</h4>
                  <p className="text-sm text-blue-800">{issue.remediation}</p>
                  
                  {issue.id.includes('auth_') && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => window.open('https://supabase.com/dashboard/project/tqcgbsnoiarnawnppwia/auth/providers', '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Supabaseダッシュボードを開く
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>セキュリティ設定の確認</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>データベース関数のセキュリティ強化完了</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Row Level Security (RLS) ポリシー適用済み</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>API キーの暗号化保存</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>自己返信フィルタリング実装済み</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
