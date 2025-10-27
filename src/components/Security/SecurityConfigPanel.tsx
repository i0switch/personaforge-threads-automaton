
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Clock, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SecurityConfig {
  anomalyDetection: boolean;
  activityLogging: boolean;
  securityAlerts: boolean;
  autoSecurityScan: boolean;
  sessionTimeout: boolean;
  strongPasswordPolicy: boolean;
}

export const SecurityConfigPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<SecurityConfig>({
    anomalyDetection: true,
    activityLogging: true,
    securityAlerts: true,
    autoSecurityScan: false,
    sessionTimeout: true,
    strongPasswordPolicy: true
  });
  const [nextScanTime, setNextScanTime] = useState<Date | null>(null);

  useEffect(() => {
    loadSecurityConfig();
    
    if (config.autoSecurityScan) {
      const nextScan = new Date();
      nextScan.setHours(nextScan.getHours() + 24);
      setNextScanTime(nextScan);
    }
  }, [user]);

  const loadSecurityConfig = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setConfig(prev => ({
          ...prev,
          // プロファイルから設定を読み込む
        }));
      }
    } catch (error) {
      console.error('Error loading security config:', error);
    }
  };

  const updateConfig = async (key: keyof SecurityConfig, value: boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    
    try {
      // 設定変更をログに記録
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user?.id,
          action_type: 'security_setting_changed',
          description: `Security setting '${key}' changed to ${value}`,
          metadata: { 
            setting: key, 
            value, 
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent
          }
        });

      toast({
        title: "設定を更新しました",
        description: `セキュリティ設定「${getSettingDisplayName(key)}」を変更しました。`,
      });

      if (key === 'autoSecurityScan' && value) {
        const nextScan = new Date();
        nextScan.setHours(nextScan.getHours() + 24);
        setNextScanTime(nextScan);
      }
    } catch (error) {
      console.error('Error updating security config:', error);
      toast({
        title: "エラー",
        description: "設定の更新に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const getSettingDisplayName = (key: keyof SecurityConfig): string => {
    const displayNames: Record<keyof SecurityConfig, string> = {
      'anomalyDetection': '異常活動検知',
      'activityLogging': '活動ログ記録',
      'securityAlerts': 'セキュリティアラート',
      'autoSecurityScan': '自動セキュリティスキャン',
      'sessionTimeout': 'セッションタイムアウト',
      'strongPasswordPolicy': '強力なパスワードポリシー'
    };
    return displayNames[key];
  };

  return (
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
              <Label>異常活動検知</Label>
              <p className="text-sm text-muted-foreground">
                短時間での大量リクエストや失敗した認証試行を検知します
              </p>
            </div>
            <Switch
              checked={config.anomalyDetection}
              onCheckedChange={(checked) => updateConfig('anomalyDetection', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>活動ログ記録</Label>
              <p className="text-sm text-muted-foreground">
                重要な操作をログに記録してセキュリティ監査に使用します
              </p>
            </div>
            <Switch
              checked={config.activityLogging}
              onCheckedChange={(checked) => updateConfig('activityLogging', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>セキュリティアラート</Label>
              <p className="text-sm text-muted-foreground">
                セキュリティ上の問題が検出された時に通知を受け取ります
              </p>
            </div>
            <Switch
              checked={config.securityAlerts}
              onCheckedChange={(checked) => updateConfig('securityAlerts', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>自動セキュリティスキャン</Label>
              <p className="text-sm text-muted-foreground">
                定期的にセキュリティスキャンを自動実行します（24時間間隔）
              </p>
            </div>
            <Switch
              checked={config.autoSecurityScan}
              onCheckedChange={(checked) => updateConfig('autoSecurityScan', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>セッションタイムアウト</Label>
              <p className="text-sm text-muted-foreground">
                一定時間非アクティブ後に自動ログアウトします
              </p>
            </div>
            <Switch
              checked={config.sessionTimeout}
              onCheckedChange={(checked) => updateConfig('sessionTimeout', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>強力なパスワードポリシー</Label>
              <p className="text-sm text-muted-foreground">
                パスワードの複雑性要件を強化します
              </p>
            </div>
            <Switch
              checked={config.strongPasswordPolicy}
              onCheckedChange={(checked) => updateConfig('strongPasswordPolicy', checked)}
            />
          </div>
        </div>

        {nextScanTime && config.autoSecurityScan && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              次回自動スキャン (JST): {nextScanTime.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
