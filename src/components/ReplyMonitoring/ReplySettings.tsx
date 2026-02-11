
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
import { AlertCircle } from 'lucide-react';

interface Persona {
  id: string;
  name: string;
}

export const ReplySettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkInterval, setCheckInterval] = useState(5);
  const [isActive, setIsActive] = useState(true);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');
  const [configuredPersonaIds, setConfiguredPersonaIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchPersonas();
      fetchSettings();
    }
  }, [user]);

  const fetchPersonas = async () => {
    const { data } = await supabase
      .from('personas')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (data) setPersonas(data);
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('reply_check_settings')
        .select('*')
        .eq('user_id', user!.id);

      if (error) throw error;
      
      if (data && data.length > 0) {
        setConfiguredPersonaIds(new Set(data.map(s => s.persona_id)));
        // Load the first setting as default view
        const first = data[0];
        setSelectedPersonaId(first.persona_id);
        setCheckInterval(first.check_interval_minutes ?? 5);
        setIsActive(first.is_active ?? true);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handlePersonaChange = async (personaId: string) => {
    setSelectedPersonaId(personaId);
    // Load existing settings for this persona
    const { data } = await supabase
      .from('reply_check_settings')
      .select('*')
      .eq('user_id', user!.id)
      .eq('persona_id', personaId)
      .maybeSingle();
    
    if (data) {
      setCheckInterval(data.check_interval_minutes ?? 5);
      setIsActive(data.is_active ?? true);
    } else {
      setCheckInterval(5);
      setIsActive(true);
    }
  };

  const saveSettings = async () => {
    if (!selectedPersonaId) {
      toast({
        title: 'エラー',
        description: 'ペルソナを選択してください',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('reply_check_settings')
        .upsert({
          user_id: user!.id,
          persona_id: selectedPersonaId,
          check_interval_minutes: checkInterval,
          is_active: isActive
        }, { onConflict: 'user_id,persona_id' });

      if (error) throw error;

      setConfiguredPersonaIds(prev => new Set([...prev, selectedPersonaId]));
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
            <Label>対象ペルソナ</Label>
            <Select value={selectedPersonaId} onValueChange={handlePersonaChange}>
              <SelectTrigger>
                <SelectValue placeholder="ペルソナを選択してください" />
              </SelectTrigger>
              <SelectContent>
                {personas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {configuredPersonaIds.has(p.id) ? '✓' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedPersonaId && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                ペルソナを選択しないと設定を保存できません
              </p>
            )}
          </div>

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
          
          <Button onClick={saveSettings} disabled={loading || !selectedPersonaId}>
            {loading ? '保存中...' : '設定を保存'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook設定</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Threads APIのWebhook設定については、Meta for Developersのドキュメントを参照してください。
          </p>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input 
              value={`https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/threads-webhook`}
              readOnly
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              この URLをThreads APIのWebhook設定に使用してください
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export { ReplySettings as default };
