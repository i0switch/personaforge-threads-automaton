import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { MultiTimeSelector } from "@/components/AutoPost/MultiTimeSelector";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

const setMeta = (name: string, content: string) => {
  const meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (meta) meta.content = content;
  else {
    const m = document.createElement("meta");
    m.setAttribute("name", name);
    m.setAttribute("content", content);
    document.head.appendChild(m);
  }
};

const ensureCanonical = (path: string) => {
  const existing = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  const href = window.location.origin + path;
  if (existing) existing.href = href;
  else {
    const link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", href);
    document.head.appendChild(link);
  }
};

export default function AutoPostSchedules() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [personaMap, setPersonaMap] = useState<Record<string, string>>({});
  const [testGenerating, setTestGenerating] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  // 日本標準時に固定
  const timeZone = 'Asia/Tokyo';

  useEffect(() => {
    document.title = "設定済みスケジュール編集 | Threads-Genius AI";
    setMeta("description", "完全オートポストのスケジュール一覧と編集");
    ensureCanonical("/auto-post-mode/schedules");
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const [configsRes, personasRes] = await Promise.all([
      supabase
        .from('auto_post_configs')
        .select('*, post_times, multi_time_enabled')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('personas')
        .select('id, name')
        .eq('user_id', user.id)
    ]);

    if (configsRes.error) {
      console.error(configsRes.error);
      toast({ title: 'エラー', description: '設定の読み込みに失敗しました', variant: 'destructive' });
    } else {
      setConfigs(configsRes.data || []);
    }

    if (personasRes.error) {
      console.error(personasRes.error);
    } else {
      const map = Object.fromEntries((personasRes.data || []).map((p: any) => [p.id, p.name]));
      setPersonaMap(map);
    }

    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const toggleActive = async (id: string, active: boolean) => {
    const config = configs.find(c => c.id === id);
    if (!config) return;

    // ペルソナのpost_queueをクリーンアップ（自動生成のみ）
    const { error: cleanupError } = await supabase.rpc('cleanup_auto_generated_schedules_only', {
      p_persona_id: config.persona_id
    });
    
    if (cleanupError) {
      console.error('Failed to cleanup post queue:', cleanupError);
      // クリーンアップエラーは警告のみ、処理続行
    }

    const { error } = await supabase.from('auto_post_configs').update({ is_active: !active }).eq('id', id);
    if (error) {
      toast({ title: 'エラー', description: '更新に失敗しました', variant: 'destructive' });
    } else {
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, is_active: !active } : c));
      toast({ title: '更新しました', description: '状態を変更しました' });
    }
  };

  const deleteConfig = async (id: string) => {
    const { error } = await supabase.from('auto_post_configs').delete().eq('id', id);
    if (error) {
      toast({ title: 'エラー', description: '削除に失敗しました', variant: 'destructive' });
    } else {
      setConfigs(prev => prev.filter(c => c.id !== id));
      toast({ title: '削除しました', description: '設定を削除しました' });
    }
  };

  const updateConfig = async (id: string, fields: any) => {
    const config = configs.find(c => c.id === id);
    if (!config) return;

    // ペルソナのpost_queueをクリーンアップ（時間関連の変更の場合・自動生成のみ）
    if (fields.post_time || fields.post_times || fields.next_run_at) {
      const { error: cleanupError } = await supabase.rpc('cleanup_auto_generated_schedules_only', {
        p_persona_id: config.persona_id
      });
      
      if (cleanupError) {
        console.error('Failed to cleanup post queue:', cleanupError);
        // クリーンアップエラーは警告のみ、処理続行
      }
    }

    // 複数時間設定の場合、next_run_atを計算
    if (fields.post_times && config.multi_time_enabled) {
      const { data: nextRunAt, error: calcError } = await supabase.rpc('calculate_next_multi_time_run', {
        p_current_time: new Date().toISOString(),
        time_slots: fields.post_times,
        timezone_name: config.timezone || 'UTC'
      });
      
      if (calcError) {
        console.error('Failed to calculate next run time:', calcError);
        toast({ title: 'エラー', description: '次回実行時刻の計算に失敗しました', variant: 'destructive' });
        return;
      }
      
      fields.next_run_at = nextRunAt;
    }

    const { error } = await supabase.from('auto_post_configs').update(fields).eq('id', id);
    if (error) {
      toast({ title: 'エラー', description: '保存に失敗しました', variant: 'destructive' });
    } else {
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c));
      toast({ title: '保存しました', description: '設定を更新しました' });
      // 設定を再読み込みして最新の状態を表示
      load();
    }
  };

  const computeNextRun = (hhmm: string, currentNext: string) => {
    const [hh, mm] = hhmm.split(':').map(Number);
    
    // 現在のUTC時刻
    const nowUTC = new Date();
    
    // JSTでの現在の日付を取得（YYYY-MM-DD形式）
    const jstDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(nowUTC);
    
    // JSTでの現在時刻（HH:MM:SS形式）
    const jstTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(nowUTC);
    
    // 設定時刻のJST表現
    const targetTimeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
    
    // 今日の設定時刻がまだ未来かチェック
    let targetDateStr = jstDateStr;
    if (targetTimeStr <= jstTimeStr) {
      // 既に過ぎているので翌日に
      const tomorrow = new Date(nowUTC.getTime() + 24 * 60 * 60 * 1000);
      targetDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(tomorrow);
    }
    
    // JST日時をISO 8601形式でUTCに変換
    const jstDateTime = new Date(`${targetDateStr}T${targetTimeStr}+09:00`);
    return jstDateTime.toISOString();
  };

  const handleTestGenerate = async (configId: string) => {
    const config = configs.find(c => c.id === configId);
    if (!config) return;

    setTestGenerating(prev => ({ ...prev, [configId]: true }));
    setTestResults(prev => ({ ...prev, [configId]: '' }));

    try {
      console.log('🚀 Invoking test-auto-post-generate for config:', configId);
      const { data, error } = await supabase.functions.invoke('test-auto-post-generate', {
        body: {
          personaId: config.persona_id,
          customPrompt: config.prompt_template,
          contentPrefs: config.content_prefs
        }
      });

      console.log('📦 Response received:', { data, error });

      // エラー詳細をログ出力
      if (error) {
        console.error('❌ Edge function invoke error:', error);
        console.error('Error details:', {
          message: error.message,
          context: error.context,
          details: JSON.stringify(error)
        });
        throw new Error(`エッジファンクションエラー: ${error.message || JSON.stringify(error)}`);
      }

      if (data?.success && data?.content) {
        console.log('✅ Test generation successful');
        setTestResults(prev => ({ ...prev, [configId]: data.content }));
        toast({ title: 'テスト生成完了', description: '投稿内容を生成しました' });
      } else if (data?.error) {
        console.error('❌ Function returned error:', data.error);
        // エッジファンクションからのエラーメッセージを表示
        throw new Error(data.error);
      } else {
        console.error('❌ Unexpected response format:', data);
        throw new Error('テスト生成に失敗しました（不明なエラー）');
      }
    } catch (error) {
      console.error('💥 Test generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'テスト生成に失敗しました';
      
      // Gemini API キー未設定の場合は設定ページへのリンクを表示
      if (errorMessage.includes('Gemini API key is not configured')) {
        toast({ 
          title: 'Gemini APIキーが未設定', 
          description: '設定画面でGemini APIキーを登録してください', 
          variant: 'destructive',
          action: (
            <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
              設定へ
            </Button>
          )
        });
      } else {
        toast({ 
          title: 'テスト生成エラー', 
          description: errorMessage, 
          variant: 'destructive' 
        });
      }
    } finally {
      setTestGenerating(prev => ({ ...prev, [configId]: false }));
    }
  };

  if (loading) {
    return (<div className="min-h-screen bg-background p-6"><div className="max-w-5xl mx-auto">読み込み中...</div></div>);
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              戻る
            </Button>
            <div>
              <h1 className="text-3xl font-bold">設定済みスケジュール編集</h1>
              <p className="text-muted-foreground mt-1">自動投稿設定の有効化/編集/削除</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => navigate('/auto-post-mode/wizard')}>新規ウィザード</Button>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>スケジュール一覧</CardTitle>
            <CardDescription>タイムゾーン: {timeZone}</CardDescription>
          </CardHeader>
          <CardContent>
            {configs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">設定がありません</p>
                <Button onClick={() => navigate('/auto-post-mode/wizard')}>新規作成</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {configs.map((c) => (
                  <div key={c.id} className="border rounded-lg p-4 space-y-4">
                    {/* ヘッダー情報 */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">
                          次回実行 (JST): {new Date(c.next_run_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-sm">ペルソナ: {personaMap[c.persona_id as string] || '未設定'}</div>
                        <div className="text-sm">
                          モード: {c.multi_time_enabled ? `複数時間（${c.post_times?.length || 0}個）` : '単一時間'}
                        </div>
                        <div className="text-sm">有効: {c.is_active ? 'ON' : 'OFF'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant={c.is_active ? 'outline' : 'default'} onClick={() => toggleActive(c.id, c.is_active)}>
                          {c.is_active ? '無効化' : '有効化'}
                        </Button>
                        <Button variant="destructive" onClick={() => deleteConfig(c.id)}>削除</Button>
                      </div>
                    </div>

                    {/* 時間設定 */}
                    <div>
                      {c.multi_time_enabled ? (
                        <MultiTimeSelector
                          times={(c.post_times || []).map((t: string) => t.slice(0, 5))}
                          onChange={(newTimes) => {
                            const postTimes = newTimes.map(t => t + ':00');
                            updateConfig(c.id, { 
                              post_times: postTimes,
                              post_time: postTimes[0] || c.post_time // フォールバック
                            });
                          }}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`time-${c.id}`} className="text-sm">投稿時間</Label>
                          <Input 
                            id={`time-${c.id}`} 
                            type="time" 
                            defaultValue={String(c.post_time).slice(0,5)} 
                            onBlur={(e) => updateConfig(c.id, { 
                              post_time: `${e.target.value}:00`, 
                              next_run_at: computeNextRun(e.target.value, c.next_run_at) 
                            })} 
                            className="h-9 w-[120px]" 
                          />
                        </div>
                      )}
                    </div>
                    <div className="w-full space-y-2">
                      <div>
                        <Label className="text-sm">投稿方針</Label>
                        <Textarea
                          placeholder="例: 教育的・フレンドリー・短文中心 など"
                          defaultValue={c.content_prefs || ''}
                          onBlur={(e) => updateConfig(c.id, { content_prefs: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-sm">カスタムプロンプト</Label>
                        <Textarea defaultValue={c.prompt_template || ''} onBlur={(e) => updateConfig(c.id, { prompt_template: e.target.value })} />
                      </div>
                      
                      {/* テスト生成機能 */}
                      <div className="border-t pt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">テスト生成</Label>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleTestGenerate(c.id)}
                            disabled={testGenerating[c.id]}
                          >
                            {testGenerating[c.id] ? '生成中...' : '現在の設定でテスト生成'}
                          </Button>
                        </div>
                        {testResults[c.id] && (
                          <div className="bg-muted p-3 rounded-md">
                            <p className="text-sm text-muted-foreground mb-1">生成結果:</p>
                            <p className="text-sm whitespace-pre-wrap">{testResults[c.id]}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
