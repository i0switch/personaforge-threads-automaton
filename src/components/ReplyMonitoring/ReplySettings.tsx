
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

export const ReplySettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkInterval, setCheckInterval] = useState(5);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('reply_check_settings')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setCheckInterval(data.check_interval_minutes);
        setIsActive(data.is_active);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('reply_check_settings')
        .upsert({
          user_id: user!.id,
          check_interval_minutes: checkInterval,
          is_active: isActive
        });

      if (error) throw error;

      toast({
        title: '成功',
        description: '設定を保存しました'
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'エラー',
        description: '設定の保存に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>リプライ監視設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="check-interval">チェック間隔（分）</Label>
            <Input
              id="check-interval"
              type="number"
              min="1"
              max="60"
              value={checkInterval}
              onChange={(e) => setCheckInterval(parseInt(e.target.value))}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="is-active">監視を有効にする</Label>
          </div>
          
          <Button onClick={saveSettings} disabled={loading}>
            {loading ? '保存中...' : '設定を保存'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook設定</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Threads APIのWebhook設定については、Meta for Developersのドキュメントを参照してください。
          </p>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input 
              value={`${window.location.origin}/functions/v1/threads-webhook`}
              readOnly
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-500">
              この URLをThreads APIのWebhook設定に使用してください
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export { ReplySettings as default };
