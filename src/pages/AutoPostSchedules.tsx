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

  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

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
        .select('*')
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
    const { error } = await supabase.from('auto_post_configs').update(fields).eq('id', id);
    if (error) {
      toast({ title: 'エラー', description: '保存に失敗しました', variant: 'destructive' });
    } else {
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c));
      toast({ title: '保存しました', description: '設定を更新しました' });
    }
  };

  const computeNextRun = (hhmm: string, currentNext: string) => {
    const [hh, mm] = hhmm.split(':').map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(hh, mm, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
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
                  <div key={c.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">次回: {new Date(c.next_run_at).toLocaleString()}</div>
                      <div className="text-sm">ペルソナ: {personaMap[c.persona_id as string] || '未設定'}</div>
                      <div className="text-sm">有効: {c.is_active ? 'ON' : 'OFF'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`time-${c.id}`} className="text-sm">時間</Label>
                        <Input id={`time-${c.id}`} type="time" defaultValue={String(c.post_time).slice(0,5)} onBlur={(e) => updateConfig(c.id, { post_time: `${e.target.value}:00`, next_run_at: computeNextRun(e.target.value, c.next_run_at) })} className="h-9 w-[120px]" />
                      </div>
                      <Button variant={c.is_active ? 'outline' : 'default'} onClick={() => toggleActive(c.id, c.is_active)}>{c.is_active ? '無効化' : '有効化'}</Button>
                      <Button variant="destructive" onClick={() => deleteConfig(c.id)}>削除</Button>
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
