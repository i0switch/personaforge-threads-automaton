
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield, AlertTriangle, Save } from "lucide-react";

interface SecurityConfig {
  rateLimitEnabled: boolean;
  rateLimitRequests: number;
  rateLimitWindow: number;
  auditLogEnabled: boolean;
  alertsEnabled: boolean;
  alertEmail: string;
  intrusionDetectionEnabled: boolean;
  suspiciousActivityThreshold: number;
}

export const SecuritySettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<SecurityConfig>({
    rateLimitEnabled: true,
    rateLimitRequests: 100,
    rateLimitWindow: 60,
    auditLogEnabled: true,
    alertsEnabled: true,
    alertEmail: '',
    intrusionDetectionEnabled: true,
    suspiciousActivityThreshold: 10
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSecurityConfig();
    }
  }, [user]);

  const loadSecurityConfig = async () => {
    try {
      // プロファイルから設定を読み込み
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profile) {
        setConfig(prev => ({
          ...prev,
          alertEmail: profile.display_name || ''
        }));
      }
    } catch (error) {
      console.error('Failed to load security config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSecurityConfig = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // 設定をactivity_logsに保存
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user.id,
          action_type: 'security_settings_updated',
          description: 'セキュリティ設定が更新されました',
          metadata: {
            config,
            timestamp: new Date().toISOString()
          }
        });

      toast({
        title: "成功",
        description: "セキュリティ設定が保存されました",
      });
    } catch (error) {
      console.error('Failed to save security config:', error);
      toast({
        title: "エラー",
        description: "設定の保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfigChange = (key: keyof SecurityConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            セキュリティ設定
          </h2>
          <p className="text-muted-foreground">
            システムのセキュリティ機能を設定
          </p>
        </div>
        <Button onClick={saveSecurityConfig} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? '保存中...' : '設定を保存'}
        </Button>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          セキュリティ設定の変更は慎重に行ってください。不適切な設定はシステムの動作に影響を与える可能性があります。
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>レート制限</CardTitle>
            <CardDescription>
              APIリクエストの頻度を制限してDDoS攻撃を防ぎます
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="rate-limit"
                checked={config.rateLimitEnabled}
                onCheckedChange={(checked) => handleConfigChange('rateLimitEnabled', checked)}
              />
              <Label htmlFor="rate-limit">レート制限を有効にする</Label>
            </div>
            
            {config.rateLimitEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="rate-requests">最大リクエスト数</Label>
                  <Input
                    id="rate-requests"
                    type="number"
                    value={config.rateLimitRequests}
                    onChange={(e) => handleConfigChange('rateLimitRequests', parseInt(e.target.value))}
                    min="1"
                    max="1000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate-window">時間枠（秒）</Label>
                  <Input
                    id="rate-window"
                    type="number"
                    value={config.rateLimitWindow}
                    onChange={(e) => handleConfigChange('rateLimitWindow', parseInt(e.target.value))}
                    min="1"
                    max="3600"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>監査ログ</CardTitle>
            <CardDescription>
              システムの活動を記録・監視します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="audit-log"
                checked={config.auditLogEnabled}
                onCheckedChange={(checked) => handleConfigChange('auditLogEnabled', checked)}
              />
              <Label htmlFor="audit-log">監査ログを有効にする</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>セキュリティアラート</CardTitle>
            <CardDescription>
              セキュリティイベントの通知設定
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="alerts"
                checked={config.alertsEnabled}
                onCheckedChange={(checked) => handleConfigChange('alertsEnabled', checked)}
              />
              <Label htmlFor="alerts">アラートを有効にする</Label>
            </div>
            
            {config.alertsEnabled && (
              <div className="space-y-2">
                <Label htmlFor="alert-email">通知先メールアドレス</Label>
                <Input
                  id="alert-email"
                  type="email"
                  value={config.alertEmail}
                  onChange={(e) => handleConfigChange('alertEmail', e.target.value)}
                  placeholder="alerts@example.com"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>侵入検知</CardTitle>
            <CardDescription>
              不審な活動を自動検知します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="intrusion-detection"
                checked={config.intrusionDetectionEnabled}
                onCheckedChange={(checked) => handleConfigChange('intrusionDetectionEnabled', checked)}
              />
              <Label htmlFor="intrusion-detection">侵入検知を有効にする</Label>
            </div>
            
            {config.intrusionDetectionEnabled && (
              <div className="space-y-2">
                <Label htmlFor="suspicious-threshold">不審な活動の閾値</Label>
                <Select
                  value={config.suspiciousActivityThreshold.toString()}
                  onValueChange={(value) => handleConfigChange('suspiciousActivityThreshold', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5回の失敗試行</SelectItem>
                    <SelectItem value="10">10回の失敗試行</SelectItem>
                    <SelectItem value="15">15回の失敗試行</SelectItem>
                    <SelectItem value="20">20回の失敗試行</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
