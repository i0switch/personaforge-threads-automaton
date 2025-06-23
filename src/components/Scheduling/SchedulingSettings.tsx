
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Settings, Clock } from "lucide-react";

interface SchedulingSettingsData {
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
  const [settings, setSettings] = useState<SchedulingSettingsData>({
    optimal_hours: [9, 12, 15, 18, 21],
    timezone: 'Asia/Tokyo',
    auto_schedule_enabled: false,
    queue_limit: 10,
    retry_enabled: true
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheduling_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading scheduling settings:', error);
      toast({
        title: "エラー",
        description: "スケジュール設定の読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const settingsData = {
        ...settings,
        user_id: user.id,
        updated_at: new Date().toISOString()
      };

      if (settings.id) {
        const { error } = await supabase
          .from('scheduling_settings')
          .update(settingsData)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('scheduling_settings')
          .insert(settingsData)
          .select()
          .single();
        if (error) throw error;
        setSettings(prev => ({ ...prev, id: data.id }));
      }

      toast({
        title: "成功",
        description: "スケジュール設定を保存しました。",
      });
    } catch (error) {
      console.error('Error saving scheduling settings:', error);
      toast({
        title: "エラー",
        description: "スケジュール設定の保存に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOptimalHoursChange = (hourString: string) => {
    const hours = hourString.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h) && h >= 0 && h <= 23);
    setSettings(prev => ({ ...prev, optimal_hours: hours }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>読み込み中...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          スケジュール設定
        </CardTitle>
        <CardDescription>
          自動投稿とスケジューリングの設定を管理します。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>自動スケジュール</Label>
            <p className="text-sm text-muted-foreground">
              最適な時間帯に自動で投稿をスケジュールします。
            </p>
          </div>
          <Switch
            checked={settings.auto_schedule_enabled}
            onCheckedChange={(checked) => 
              setSettings(prev => ({ ...prev, auto_schedule_enabled: checked }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>最適な投稿時間（時）</Label>
          <Input
            value={settings.optimal_hours.join(', ')}
            onChange={(e) => handleOptimalHoursChange(e.target.value)}
            placeholder="9, 12, 15, 18, 21"
          />
          <p className="text-sm text-muted-foreground">
            カンマ区切りで時間を指定してください（0-23）。
          </p>
        </div>

        <div className="space-y-2">
          <Label>タイムゾーン</Label>
          <Select
            value={settings.timezone}
            onValueChange={(value) => setSettings(prev => ({ ...prev, timezone: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
              <SelectItem value="America/New_York">America/New_York</SelectItem>
              <SelectItem value="Europe/London">Europe/London</SelectItem>
              <SelectItem value="UTC">UTC</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>キュー制限</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={settings.queue_limit}
            onChange={(e) => setSettings(prev => ({ ...prev, queue_limit: parseInt(e.target.value) || 10 }))}
          />
          <p className="text-sm text-muted-foreground">
            同時にキューに入れられる投稿の最大数。
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>自動リトライ</Label>
            <p className="text-sm text-muted-foreground">
              投稿失敗時に自動で再試行します。
            </p>
          </div>
          <Switch
            checked={settings.retry_enabled}
            onCheckedChange={(checked) => 
              setSettings(prev => ({ ...prev, retry_enabled: checked }))
            }
          />
        </div>

        <Button onClick={saveSettings} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            '設定を保存'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
