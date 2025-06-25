
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { securityAudit } from "@/utils/securityAudit";

export const SecuritySettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    anomalyDetection: true,
    activityLogging: true,
    securityAlerts: true,
    autoSecurityScan: false
  });
  const [loading, setLoading] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<any>(null);

  useEffect(() => {
    loadSecuritySettings();
  }, [user]);

  const loadSecuritySettings = async () => {
    if (!user) return;

    try {
      // セキュリティ設定を読み込み（プロファイルから）
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        // 既存の設定があれば反映
        setSettings(prev => ({
          ...prev,
          // プロファイルから設定を読み込む場合の処理
        }));
      }
    } catch (error) {
      console.error('Error loading security settings:', error);
    }
  };

  const updateSetting = async (key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    try {
      // 設定変更をログに記録
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user?.id,
          action_type: 'security_setting_changed',
          description: `${key} setting changed to ${value}`,
          metadata: { setting: key, value, timestamp: new Date().toISOString() }
        });

      toast({
        title: "設定を更新しました",
        description: `セキュリティ設定「${key}」を変更しました。`,
      });
    } catch (error) {
      console.error('Error updating security setting:', error);
      toast({
        title: "エラー",
        description: "設定の更新に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const runSecurityScan = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await securityAudit.performSecurityScan(user.id);
      setLastScanResult(result);

      toast({
        title: "セキュリティスキャン完了",
        description: `スキャンが完了しました。${result.vulnerabilities.high + result.vulnerabilities.medium + result.vulnerabilities.low}件の問題が検出されました。`,
      });
    } catch (error) {
      console.error('Security scan error:', error);
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
            <Shield className="h-5 w-5" />
            セキュリティ設定
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="anomaly-detection">異常活動検知</Label>
                <p className="text-sm text-muted-foreground">
                  短時間での大量リクエストや失敗した認証試行を検知します
                </p>
              </div>
              <Switch
                id="anomaly-detection"
                checked={settings.anomalyDetection}
                onCheckedChange={(checked) => updateSetting('anomalyDetection', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="activity-logging">活動ログ記録</Label>
                <p className="text-sm text-muted-foreground">
                  重要な操作をログに記録してセキュリティ監査に使用します
                </p>
              </div>
              <Switch
                id="activity-logging"
                checked={settings.activityLogging}
                onCheckedChange={(checked) => updateSetting('activityLogging', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="security-alerts">セキュリティアラート</Label>
                <p className="text-sm text-muted-foreground">
                  セキュリティ上の問題が検出された時に通知を受け取ります
                </p>
              </div>
              <Switch
                id="security-alerts"
                checked={settings.securityAlerts}
                onCheckedChange={(checked) => updateSetting('securityAlerts', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-scan">自動セキュリティスキャン</Label>
                <p className="text-sm text-muted-foreground">
                  定期的にセキュリティスキャンを自動実行します
                </p>
              </div>
              <Switch
                id="auto-scan"
                checked={settings.autoSecurityScan}
                onCheckedChange={(checked) => updateSetting('autoSecurityScan', checked)}
              />
            </div>
          </div>

          <div className="pt-4 border-t">
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
          </div>
        </CardContent>
      </Card>

      {lastScanResult && (
        <Card>
          <CardHeader>
            <CardTitle>最新スキャン結果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-600">
                  {lastScanResult.vulnerabilities.high}
                </div>
                <div className="text-sm text-red-600">重要</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-xl font-bold text-yellow-600">
                  {lastScanResult.vulnerabilities.medium}
                </div>
                <div className="text-sm text-yellow-600">中程度</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold text-gray-600">
                  {lastScanResult.vulnerabilities.low}
                </div>
                <div className="text-sm text-gray-600">軽微</div>
              </div>
            </div>

            <div className="space-y-2">
              {lastScanResult.recommendations.map((rec: string, index: number) => (
                <Alert key={index}>
                  <Info className="h-4 w-4" />
                  <AlertDescription>{rec}</AlertDescription>
                </Alert>
              ))}
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              最終スキャン: {new Date(lastScanResult.lastScan).toLocaleString('ja-JP')}
            </p>
          </CardContent>
        </Card>
      )}

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>重要:</strong> データベース関数のセキュリティ強化が完了しています。
          OTP設定と漏洩パスワード保護については、Supabaseダッシュボードで手動設定が必要です。
        </AlertDescription>
      </Alert>
    </div>
  );
};
