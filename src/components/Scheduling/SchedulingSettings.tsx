
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Settings, Clock, AlertCircle } from "lucide-react";

interface SchedulingSettings {
  id?: string;
  optimal_hours: number[];
  timezone: string;
  auto_schedule_enabled: boolean;
  queue_limit: number;
  retry_enabled: boolean;
}

export const SchedulingSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SchedulingSettings>({
    optimal_hours: [9, 12, 15, 18, 21],
    timezone: 'Asia/Tokyo',
    auto_schedule_enabled: false,
    queue_limit: 10,
    retry_enabled: true,
  });

  useEffect(() => {
    console.log("SchedulingSettings useEffect - user:", user);
    if (user) {
      loadSettings();
    } else {
      setLoading(false);
      setError("ユーザー情報が見つかりません。");
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) {
      setError("ユーザー情報が見つかりません。");
      setLoading(false);
      return;
    }
    
    console.log("Loading scheduling settings for user:", user.id);
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('scheduling_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log("Settings query result:", { data, error });

      if (error) {
        console.error('Error loading settings:', error);
        setError(`設定の読み込みエラー: ${error.message}`);
        return;
      }

      if (data) {
        console.log("Found existing settings:", data);
        setSettings({
          id: data.id,
          optimal_hours: data.optimal_hours || [9, 12, 15, 18, 21],
          timezone: data.timezone || 'Asia/Tokyo',
          auto_schedule_enabled: data.auto_schedule_enabled || false,
          queue_limit: data.queue_limit || 10,
          retry_enabled: data.retry_enabled || true,
        });
      } else {
        console.log("No existing settings found, using defaults");
      }
    } catch (error) {
      console.error('Unexpected error loading settings:', error);
      setError(`予期しないエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) {
      toast({
        title: "エラー",
        description: "ユーザー情報が見つかりません。",
        variant: "destructive",
      });
      return;
    }
    
    setSaving(true);
    try {
    const settingsData = {
      user_id: user.id,
      optimal_hours: settings.optimal_hours,
      timezone: 'Asia/Tokyo', // 日本標準時に固定
      auto_schedule_enabled: settings.auto_schedule_enabled,
      queue_limit: settings.queue_limit,
      retry_enabled: settings.retry_enabled,
    };

      console.log("Saving settings:", settingsData);

      if (settings.id) {
        const { error } = await supabase
          .from('scheduling_settings')
          .update(settingsData)
          .eq('id', settings.id);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('scheduling_settings')
          .insert([settingsData])
          .select()
          .single();
        
        if (error) throw error;
        setSettings(prev => ({ ...prev, id: data.id }));
      }

      toast({
        title: "成功",
        description: "設定が保存されました。",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "エラー",
        description: `設定の保存に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateOptimalHours = (hourString: string) => {
    try {
      const hours = hourString.split(',').map(h => parseInt(h.trim())).filter(h => h >= 0 && h <= 23);
      setSettings(prev => ({ ...prev, optimal_hours: hours }));
    } catch (error) {
      console.error('Error parsing hours:', error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>設定を読み込み中...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadSettings} variant="outline">
              再試行
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          スケジューリング設定
        </CardTitle>
        <CardDescription>
          自動投稿の動作を設定します。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="optimal-hours">最適な投稿時間（時）</Label>
          <Input
            id="optimal-hours"
            placeholder="9,12,15,18,21"
            value={settings.optimal_hours.join(',')}
            onChange={(e) => updateOptimalHours(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            カンマ区切りで入力してください（例：9,12,15,18,21）
          </p>
        </div>

        <div className="space-y-2">
          <Label>タイムゾーン</Label>
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm font-medium">日本標準時（JST / Asia/Tokyo）</p>
            <p className="text-xs text-muted-foreground mt-1">
              すべての時刻は日本標準時で管理されます
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="queue-limit">キュー上限数</Label>
          <Input
            id="queue-limit"
            type="number"
            min="1"
            max="100"
            value={settings.queue_limit}
            onChange={(e) => setSettings(prev => ({ ...prev, queue_limit: parseInt(e.target.value) || 10 }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-schedule">自動スケジュール有効</Label>
            <p className="text-sm text-muted-foreground">
              下書き投稿を自動的にスケジュールします
            </p>
          </div>
          <Switch
            id="auto-schedule"
            checked={settings.auto_schedule_enabled}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_schedule_enabled: checked }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="retry">リトライ有効</Label>
            <p className="text-sm text-muted-foreground">
              失敗した投稿を自動的に再試行します
            </p>
          </div>
          <Switch
            id="retry"
            checked={settings.retry_enabled}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, retry_enabled: checked }))}
          />
        </div>

        <Button onClick={saveSettings} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 mr-2" />
              設定を保存
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
