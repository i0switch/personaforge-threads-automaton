import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MultiTimeSelector } from "./MultiTimeSelector";

interface RandomPostConfig {
  id: string;
  persona_id: string;
  is_active: boolean;
  random_times: string[];
  next_run_at: string | null;
  timezone: string;
}

interface Persona {
  id: string;
  name: string;
}

export function RandomPostConfig() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [configs, setConfigs] = useState<RandomPostConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPersonas, setProcessingPersonas] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // ペルソナとランダムポスト設定を並行取得
      const [personasResult, configsResult] = await Promise.all([
        supabase
          .from('personas')
          .select('id, name')
          .eq('user_id', user.id)
          .eq('is_active', true),
        supabase
          .from('random_post_configs')
          .select('*')
          .eq('user_id', user.id)
      ]);

      if (personasResult.error) throw personasResult.error;
      if (configsResult.error) throw configsResult.error;

      setPersonas(personasResult.data || []);
      setConfigs(configsResult.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'エラー',
        description: 'データの読み込みに失敗しました',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getConfigForPersona = (personaId: string): RandomPostConfig | null => {
    return configs.find(c => c.persona_id === personaId) || null;
  };

  const calculateNextRun = (times: string[], timezone: string = 'UTC'): string => {
    if (times.length === 0) return new Date().toISOString();

    const now = new Date();
    const today = new Date();
    
    // 今日の残り時間をチェック
    for (const time of times.sort()) {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledTime = new Date();
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      if (scheduledTime > now) {
        return scheduledTime.toISOString();
      }
    }
    
    // 今日の時間がすべて過ぎた場合は明日の最初の時間
    const [hours, minutes] = times[0].split(':').map(Number);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(hours, minutes, 0, 0);
    
    return tomorrow.toISOString();
  };

  const togglePersonaConfig = async (persona: Persona) => {
    // 処理中は重複操作を防ぐ
    if (processingPersonas.has(persona.id)) return;
    
    const existingConfig = getConfigForPersona(persona.id);

    try {
      // 処理開始
      setProcessingPersonas(prev => new Set([...prev, persona.id]));

      // ランダムポスト機能を有効にする場合、完全オートポスト設定をチェック
      if (!existingConfig || !existingConfig.is_active) {
        const { data: autoPostConfigs, error: checkError } = await supabase
          .from('auto_post_configs')
          .select('id, is_active')
          .eq('persona_id', persona.id)
          .eq('is_active', true);

        if (checkError) throw checkError;

        if (autoPostConfigs && autoPostConfigs.length > 0) {
          toast({
            title: '完全オートポスト設定を無効化',
            description: `${persona.name}の完全オートポスト設定（${autoPostConfigs.length}件）が自動的に無効になります`,
            variant: 'default'
          });
        }
      }

      // ペルソナのpost_queueをクリーンアップ（自動生成のみ）
      const { error: cleanupError } = await supabase.rpc('cleanup_auto_generated_schedules_only', {
        p_persona_id: persona.id
      });
      
      if (cleanupError) {
        console.error('Failed to cleanup post queue:', cleanupError);
        // クリーンアップエラーは警告のみ、処理続行
      }

      if (existingConfig) {
        // 既存設定の ON/OFF 切り替え
        const newActive = !existingConfig.is_active;
        const { error } = await supabase
          .from('random_post_configs')
          .update({ is_active: newActive })
          .eq('id', existingConfig.id);

        if (error) throw error;

        setConfigs(prev => prev.map(c => 
          c.id === existingConfig.id ? { ...c, is_active: newActive } : c
        ));

        toast({
          title: newActive ? 'ランダムポスト有効化' : 'ランダムポスト無効化',
          description: `${persona.name}のランダムポストを${newActive ? '有効' : '無効'}にしました`
        });
      } else {
        // 新規設定作成（デフォルト時間で）
        const defaultTimes = ['09:00', '12:00', '18:00'];
        const nextRunAt = calculateNextRun(defaultTimes);

        const { data, error } = await supabase
          .from('random_post_configs')
          .insert({
            user_id: user!.id,
            persona_id: persona.id,
            is_active: true,
            random_times: defaultTimes.map(t => t + ':00'),
            next_run_at: nextRunAt,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          })
          .select()
          .single();

        if (error) {
          // エラーが23505（一意制約違反）の場合は重複として処理
          if (error.code === '23505') {
            toast({
              title: '設定済み',
              description: 'このペルソナのランダムポスト設定は既に存在します',
              variant: 'default'
            });
            // データを再読み込みして最新の状態に同期
            await loadData();
            return;
          }
          throw error;
        }

        setConfigs(prev => [...prev, data]);
        toast({
          title: 'ランダムポスト有効化',
          description: `${persona.name}のランダムポストを有効にしました`
        });
      }
    } catch (error) {
      console.error('Failed to toggle config:', error);
      toast({
        title: 'エラー',
        description: '設定の更新に失敗しました',
        variant: 'destructive'
      });
    } finally {
      // 処理終了
      setProcessingPersonas(prev => {
        const newSet = new Set(prev);
        newSet.delete(persona.id);
        return newSet;
      });
    }
  };

  const updateRandomTimes = async (personaId: string, newTimes: string[]) => {
    const config = getConfigForPersona(personaId);
    if (!config) return;

    try {
      // ペルソナのpost_queueをクリーンアップ（自動生成のみ）
      const { error: cleanupError } = await supabase.rpc('cleanup_auto_generated_schedules_only', {
        p_persona_id: personaId
      });
      
      if (cleanupError) {
        console.error('Failed to cleanup post queue:', cleanupError);
        // クリーンアップエラーは警告のみ、処理続行
      }

      const formattedTimes = newTimes.map(t => t + ':00');
      const nextRunAt = calculateNextRun(newTimes, config.timezone);

      const { error } = await supabase
        .from('random_post_configs')
        .update({ 
          random_times: formattedTimes,
          next_run_at: nextRunAt
        })
        .eq('id', config.id);

      if (error) throw error;

      setConfigs(prev => prev.map(c => 
        c.id === config.id 
          ? { ...c, random_times: formattedTimes, next_run_at: nextRunAt }
          : c
      ));

      toast({
        title: '時間設定更新',
        description: 'ランダムポスト時間を更新しました'
      });
    } catch (error) {
      console.error('Failed to update times:', error);
      toast({
        title: 'エラー',
        description: '時間設定の更新に失敗しました',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">読み込み中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ランダムポスト設定</CardTitle>
        <CardDescription>
          ペルソナごとにランダムな時間での自動投稿を設定します。有効にすると個別のスケジュール設定よりも優先されます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {personas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>アクティブなペルソナがありません</p>
            <p className="text-sm">まずペルソナを作成してください</p>
          </div>
        ) : (
          personas.map(persona => {
            const config = getConfigForPersona(persona.id);
            const isActive = config?.is_active || false;

            return (
              <div key={persona.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{persona.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {config ? (
                        isActive ? 
                          `アクティブ - 次回: ${config.next_run_at ? new Date(config.next_run_at).toLocaleString() : '未設定'}` :
                          'ランダムポスト無効'
                      ) : (
                        'ランダムポスト未設定'
                      )}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={isActive}
                      disabled={processingPersonas.has(persona.id)}
                      onCheckedChange={() => togglePersonaConfig(persona)}
                    />
                    <Label>有効</Label>
                  </div>
                </div>

                {config && isActive && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">ランダム投稿時間</Label>
                    <MultiTimeSelector
                      times={(config.random_times || []).map((t: string) => t.slice(0, 5))}
                      onChange={(newTimes) => updateRandomTimes(persona.id, newTimes)}
                    />
                    <p className="text-xs text-muted-foreground">
                      設定した時間からランダムに選択して投稿します
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}