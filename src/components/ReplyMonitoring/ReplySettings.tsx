
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Persona {
  id: string;
  name: string;
}

interface ReplyCheckSetting {
  id: string;
  persona_id: string;
  check_interval_minutes: number;
  is_active: boolean;
  last_check_at?: string;
}

interface WebhookSetting {
  id: string;
  persona_id: string;
  webhook_url?: string;
  verify_token?: string;
  is_active: boolean;
}

export const ReplySettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [replyCheckSettings, setReplyCheckSettings] = useState<ReplyCheckSetting[]>([]);
  const [webhookSettings, setWebhookSettings] = useState<WebhookSetting[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // ペルソナを取得
      const { data: personasData, error: personasError } = await supabase
        .from('personas')
        .select('id, name')
        .eq('user_id', user!.id);

      if (personasError) throw personasError;
      setPersonas(personasData || []);

      // リプライチェック設定を取得
      const { data: replyData, error: replyError } = await supabase
        .from('reply_check_settings')
        .select('*')
        .eq('user_id', user!.id);

      if (replyError) throw replyError;
      setReplyCheckSettings(replyData || []);

      // Webhook設定を取得
      const { data: webhookData, error: webhookError } = await supabase
        .from('webhook_settings')
        .select('*')
        .eq('user_id', user!.id);

      if (webhookError) throw webhookError;
      setWebhookSettings(webhookData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'エラー',
        description: 'データの取得に失敗しました',
        variant: 'destructive'
      });
    }
  };

  const updateReplyCheckSetting = async (personaId: string, updates: Partial<ReplyCheckSetting>) => {
    try {
      setLoading(true);
      
      const existingSetting = replyCheckSettings.find(s => s.persona_id === personaId);
      
      if (existingSetting) {
        // 更新
        const { error } = await supabase
          .from('reply_check_settings')
          .update(updates)
          .eq('id', existingSetting.id);
          
        if (error) throw error;
      } else {
        // 新規作成
        const { error } = await supabase
          .from('reply_check_settings')
          .insert({
            user_id: user!.id,
            persona_id: personaId,
            ...updates
          });
          
        if (error) throw error;
      }

      await fetchData();
      toast({
        title: '成功',
        description: 'リプライチェック設定を更新しました'
      });
    } catch (error) {
      console.error('Error updating reply check setting:', error);
      toast({
        title: 'エラー',
        description: '設定の更新に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateWebhookSetting = async (personaId: string, updates: Partial<WebhookSetting>) => {
    try {
      setLoading(true);
      
      const existingSetting = webhookSettings.find(s => s.persona_id === personaId);
      
      if (existingSetting) {
        // 更新
        const { error } = await supabase
          .from('webhook_settings')
          .update(updates)
          .eq('id', existingSetting.id);
          
        if (error) throw error;
      } else {
        // 新規作成
        const { error } = await supabase
          .from('webhook_settings')
          .insert({
            user_id: user!.id,
            persona_id: personaId,
            ...updates
          });
          
        if (error) throw error;
      }

      await fetchData();
      toast({
        title: '成功',
        description: 'Webhook設定を更新しました'
      });
    } catch (error) {
      console.error('Error updating webhook setting:', error);
      toast({
        title: 'エラー',
        description: '設定の更新に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const runManualCheck = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('check-replies');
      
      if (error) throw error;
      
      toast({
        title: '成功',
        description: `手動チェックが完了しました。${data.repliesFound}件の新しいリプライが見つかりました。`
      });
    } catch (error) {
      console.error('Error running manual check:', error);
      toast({
        title: 'エラー',
        description: '手動チェックに失敗しました',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getReplyCheckSetting = (personaId: string) => {
    return replyCheckSettings.find(s => s.persona_id === personaId);
  };

  const getWebhookSetting = (personaId: string) => {
    return webhookSettings.find(s => s.persona_id === personaId);
  };

  const webhookUrl = `${window.location.origin}/api/threads-webhook`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>リプライ監視設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label htmlFor="persona-select">ペルソナを選択</Label>
            <Select value={selectedPersona} onValueChange={setSelectedPersona}>
              <SelectTrigger>
                <SelectValue placeholder="ペルソナを選択してください" />
              </SelectTrigger>
              <SelectContent>
                {personas.map((persona) => (
                  <SelectItem key={persona.id} value={persona.id}>
                    {persona.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPersona && (
            <div className="space-y-6">
              {/* Webhook設定 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Webhook設定</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Webhook URL</Label>
                    <Input
                      value={webhookUrl}
                      readOnly
                      className="bg-gray-50"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      このURLをThreads Webhookに設定してください
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="verify-token">Verify Token</Label>
                    <Input
                      id="verify-token"
                      value={getWebhookSetting(selectedPersona)?.verify_token || ''}
                      onChange={(e) => {
                        updateWebhookSetting(selectedPersona, {
                          verify_token: e.target.value
                        });
                      }}
                      placeholder="Webhook verification token"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={getWebhookSetting(selectedPersona)?.is_active || false}
                      onCheckedChange={(checked) => {
                        updateWebhookSetting(selectedPersona, {
                          is_active: checked
                        });
                      }}
                    />
                    <Label>Webhook有効</Label>
                  </div>
                </CardContent>
              </Card>

              {/* ポーリング設定 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">ポーリング設定</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="check-interval">チェック間隔（分）</Label>
                    <Input
                      id="check-interval"
                      type="number"
                      min="1"
                      max="60"
                      value={getReplyCheckSetting(selectedPersona)?.check_interval_minutes || 5}
                      onChange={(e) => {
                        updateReplyCheckSetting(selectedPersona, {
                          check_interval_minutes: parseInt(e.target.value)
                        });
                      }}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={getReplyCheckSetting(selectedPersona)?.is_active || false}
                      onCheckedChange={(checked) => {
                        updateReplyCheckSetting(selectedPersona, {
                          is_active: checked
                        });
                      }}
                    />
                    <Label>ポーリング有効</Label>
                  </div>

                  {getReplyCheckSetting(selectedPersona)?.last_check_at && (
                    <p className="text-sm text-gray-500">
                      最後のチェック: {new Date(getReplyCheckSetting(selectedPersona)!.last_check_at!).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button 
                onClick={runManualCheck}
                disabled={loading}
                className="w-full"
              >
                {loading ? '実行中...' : '手動でリプライをチェック'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
