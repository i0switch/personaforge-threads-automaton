import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
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

const schema = z.object({
  personaId: z.string().uuid({ message: "ペルソナを選択してください" }),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  contentPrefs: z.string().optional(),
  prompt: z.string().min(1, "カスタムプロンプトを入力してください"),
  multiTimeEnabled: z.boolean().optional(),
  multiTimes: z.array(z.string()).optional(),
});

export default function AutoPostWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [personas, setPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [randomPostPersonas, setRandomPostPersonas] = useState<Set<string>>(new Set());

  // form state
  const [personaId, setPersonaId] = useState("");
  const [time, setTime] = useState("09:00");
  const [contentPrefs, setContentPrefs] = useState("");
  const [prompt, setPrompt] = useState("");
  
  // 複数時間設定
  const [multiTimeEnabled, setMultiTimeEnabled] = useState(false);
  const [multiTimes, setMultiTimes] = useState<string[]>([]);

  useEffect(() => {
    document.title = "新規完全オートポストウィザード | Threads-Genius AI";
    setMeta("description", "ペルソナ・時間・プロンプトを設定して自動投稿を作成");
    ensureCanonical("/auto-post-mode/wizard");
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      
      // ペルソナとランダムポスト設定を並行取得
      const [personasResult, randomPostResult] = await Promise.all([
        supabase
          .from('personas')
          .select('id, name, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('random_post_configs')
          .select('persona_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
      ]);
      
      if (personasResult.error) {
        console.error(personasResult.error);
      } else {
        setPersonas(personasResult.data || []);
      }
      
      if (randomPostResult.error) {
        console.error('Failed to load random post configs:', randomPostResult.error);
      } else {
        const randomPersonaIds = new Set((randomPostResult.data || []).map(r => r.persona_id));
        setRandomPostPersonas(randomPersonaIds);
      }
      
      setLoading(false);
    };
    load();
  }, [user]);

  // 日本標準時に固定
  const timeZone = 'Asia/Tokyo';

  const computeNextRun = (hhmm: string) => {
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

  // 複数時間設定の次回実行時刻を計算
  const computeNextMultiTimeRun = async (times: string[]) => {
    try {
      const { data, error } = await supabase
        .rpc('calculate_next_multi_time_run', {
          p_current_time: new Date().toISOString(),
          time_slots: times.map(t => t + ':00'),
          timezone_name: timeZone
        });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to calculate multi-time run:', error);
      // フォールバック: 最初の時間で明日の実行時刻
      return computeNextRun(times[0]);
    }
  };

  const handleSave = async () => {
    try {
      // バリデーション
      if (multiTimeEnabled) {
        if (multiTimes.length === 0) {
          throw new Error('複数時間設定を有効にする場合は、少なくとも1つの時間を設定してください');
        }
        const parsed = schema.parse({ 
          personaId, 
          time: multiTimes[0] || time, // フォールバック
          contentPrefs, 
          prompt,
          multiTimeEnabled,
          multiTimes 
        });
      } else {
        const parsed = schema.parse({ personaId, time, contentPrefs, prompt });
      }
      
      if (!user) throw new Error('未ログイン');

      let nextRunAt: string;
      let postTime: string;
      let postTimes: string[] | null = null;
      
      if (multiTimeEnabled && multiTimes.length > 0) {
        // 複数時間設定
        nextRunAt = await computeNextMultiTimeRun(multiTimes);
        postTime = multiTimes[0] + ':00'; // フォールバック用
        postTimes = multiTimes.map(t => t + ':00');
      } else {
        // 単一時間設定（従来機能）
        nextRunAt = computeNextRun(time);
        postTime = time + ':00';
      }

      const { error } = await supabase
        .from('auto_post_configs')
        .insert({
          user_id: user.id,
          persona_id: personaId,
          post_time: postTime,
          post_times: postTimes,
          multi_time_enabled: multiTimeEnabled,
          next_run_at: nextRunAt,
          prompt_template: prompt,
          content_prefs: contentPrefs || null,
          timezone: timeZone,
          is_active: true,
        });

      if (error) throw error;

      const configType = multiTimeEnabled ? `複数時間（${multiTimes.length}個）` : '単一時間';
      toast({ 
        title: '保存しました', 
        description: `${configType}の自動投稿設定を作成しました。`
      });
      navigate('/auto-post-mode/schedules');
    } catch (e: any) {
      toast({ title: 'エラー', description: e.message || '保存に失敗しました', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6"><div className="max-w-3xl mx-auto">読み込み中...</div></div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">新規完全オートポストウィザード</h1>
            <p className="text-muted-foreground mt-1">ペルソナ・時間・プロンプトを設定</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/auto-post-mode')}>戻る</Button>
        </header>

        <main className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本設定</CardTitle>
              <CardDescription>投稿に使用するペルソナと時間を設定</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="persona">ペルソナ</Label>
                <select id="persona" className="w-full border rounded-md h-10 px-3 bg-background" value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
                  <option value="">選択してください</option>
                  {personas.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* ランダムポスト設定の警告 */}
              {personaId && randomPostPersonas.has(personaId) && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    このペルソナはランダムポスト機能が有効になっています。完全オートポスト設定を作成すると、ランダムポスト設定が自動的に無効化されます。
                  </AlertDescription>
                </Alert>
              )}

              {/* 時間設定切り替えスイッチ */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="multi-time-mode"
                  checked={multiTimeEnabled}
                  onCheckedChange={setMultiTimeEnabled}
                />
                <Label htmlFor="multi-time-mode" className="text-sm font-medium">
                  複数時間設定を有効にする
                </Label>
              </div>

              {multiTimeEnabled ? (
                // 複数時間設定UI
                <MultiTimeSelector
                  times={multiTimes}
                  onChange={setMultiTimes}
                />
              ) : (
                // 従来の単一時間設定UI
                <div>
                  <Label htmlFor="time">投稿時間</Label>
                  <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">タイムゾーン: {timeZone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>生成設定</CardTitle>
              <CardDescription>投稿方針・カスタムプロンプト</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="prefs">投稿方針（任意）</Label>
                <Textarea id="prefs" placeholder="例：短く、実用的なTipsを中心に。1つだけハッシュタグ。" value={contentPrefs} onChange={(e) => setContentPrefs(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="prompt">カスタムプロンプト</Label>
                <Textarea id="prompt" placeholder="Geminiに渡す追加指示を入力" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>確認</CardTitle>
              <CardDescription>内容を確認して保存</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p>ペルソナ: {personas.find(p=>p.id===personaId)?.name || '未選択'}</p>
                {multiTimeEnabled ? (
                  <p>投稿時間: 複数時間（{multiTimes.length}個） - {multiTimes.join(', ')}（{timeZone}）</p>
                ) : (
                  <p>投稿時間: {time}（{timeZone}）</p>
                )}
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSave}>保存</Button>
                <Button variant="outline" onClick={() => navigate('/auto-post-mode')}>キャンセル</Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
