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
import { useToast } from "@/hooks/use-toast";

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
});

export default function AutoPostWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [personas, setPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [personaId, setPersonaId] = useState("");
  const [time, setTime] = useState("09:00");
  const [contentPrefs, setContentPrefs] = useState("");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    document.title = "新規完全オートポストウィザード | Threads-Genius AI";
    setMeta("description", "ペルソナ・時間・プロンプトを設定して自動投稿を作成");
    ensureCanonical("/auto-post-mode/wizard");
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('personas')
        .select('id, name, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) {
        console.error(error);
      } else {
        setPersonas(data || []);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const computeNextRun = (hhmm: string) => {
    const [hh, mm] = hhmm.split(':').map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(hh, mm, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  };

  const handleSave = async () => {
    try {
      const parsed = schema.parse({ personaId, time, contentPrefs, prompt });
      if (!user) throw new Error('未ログイン');

      const nextRunAt = computeNextRun(parsed.time);

      const { error } = await supabase
        .from('auto_post_configs')
        .insert({
          user_id: user.id,
          persona_id: parsed.personaId,
          post_time: `${parsed.time}:00`,
          next_run_at: nextRunAt,
          prompt_template: parsed.prompt,
          content_prefs: parsed.contentPrefs || null,
          timezone: timeZone,
          is_active: true,
        });

      if (error) throw error;

      toast({ title: '保存しました', description: '自動投稿設定を作成しました。' });
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
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="persona">ペルソナ</Label>
                  <select id="persona" className="w-full border rounded-md h-10 px-3 bg-background" value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
                    <option value="">選択してください</option>
                    {personas.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="time">投稿時間</Label>
                  <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">タイムゾーン: {timeZone}</p>
                </div>
              </div>
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
                <p>投稿時間: {time}（{timeZone}）</p>
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
