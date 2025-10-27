
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Scan, Info, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { securityAudit, SecurityScanResult } from "@/utils/securityAudit";
import { supabase } from "@/integrations/supabase/client";

export const SecurityScanPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<SecurityScanResult | null>(null);

  const runSecurityScan = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await securityAudit.performSecurityScan(user.id);
      setScanResult(result);

      // スキャン実行をログに記録
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user.id,
          action_type: 'security_scan_executed',
          description: 'Manual security scan executed',
          metadata: {
            vulnerabilities: result.vulnerabilities,
            timestamp: new Date().toISOString()
          }
        });

      const totalIssues = result.vulnerabilities.high + result.vulnerabilities.medium + result.vulnerabilities.low;
      
      toast({
        title: "セキュリティスキャン完了",
        description: `スキャンが完了しました。${totalIssues}件の問題が検出されました。`,
        variant: totalIssues > 0 ? "destructive" : "default"
      });
    } catch (error) {
      console.error('Security scan error:', error);
      
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user?.id,
          action_type: 'security_scan_failed',
          description: 'Security scan failed',
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }
        });

      toast({
        title: "エラー",
        description: "セキュリティスキャンに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateCurrentSettings = async () => {
    if (!user) return;

    try {
      const issues = await securityAudit.validateSecuritySettings(user.id);
      
      if (issues.length === 0) {
        toast({
          title: "設定確認完了",
          description: "セキュリティ設定に問題は見つかりませんでした。",
        });
      } else {
        toast({
          title: "設定の確認",
          description: `${issues.length}件の改善点が見つかりました。`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Settings validation error:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            セキュリティスキャン
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button onClick={runSecurityScan} disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  スキャン中...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  セキュリティスキャン実行
                </>
              )}
            </Button>
            <Button variant="outline" onClick={validateCurrentSettings}>
              設定確認
            </Button>
          </div>

          {scanResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-xl font-bold text-red-600">
                    {scanResult.vulnerabilities.high}
                  </div>
                  <div className="text-sm text-red-600">重要</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-xl font-bold text-yellow-600">
                    {scanResult.vulnerabilities.medium}
                  </div>
                  <div className="text-sm text-yellow-600">中程度</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xl font-bold text-gray-600">
                    {scanResult.vulnerabilities.low}
                  </div>
                  <div className="text-sm text-gray-600">軽微</div>
                </div>
              </div>

              <div className="space-y-2">
                {scanResult.recommendations.map((rec: string, index: number) => (
                  <Alert key={index}>
                    <Info className="h-4 w-4" />
                    <AlertDescription>{rec}</AlertDescription>
                  </Alert>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                最終スキャン (JST): {new Date(scanResult.lastScan).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
              </p>
            </div>
          )}

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>重要:</strong> データベース関数のセキュリティ強化が完了しています。
              OTP設定と漏洩パスワード保護については、Supabaseダッシュボードで手動設定が必要です。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};
