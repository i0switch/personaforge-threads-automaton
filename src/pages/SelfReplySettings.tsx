import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, MessageSquareQuote, RefreshCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PersonaRow {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface SettingsRow {
  enabled: boolean;
  messages: string[];
}

const SelfReplySettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [personas, setPersonas] = useState<PersonaRow[]>([]);
  const [settings, setSettings] = useState<Record<string, SettingsRow>>({});

  useEffect(() => {
    // SEO
    document.title = "セルフリプライ設定 | Threads-Genius AI";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "セルフリプライモード設定: ペルソナごとにON/OFFと返信メッセージを管理");
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const { data: personaList, error } = await supabase
          .from("personas")
          .select("id,name,avatar_url")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        if (error) throw error;
        setPersonas(personaList || []);

        // Load settings per persona
        const ids = (personaList || []).map(p => p.id);
        if (ids.length > 0) {
          const { data: settingRows, error: sErr } = await supabase
            .from("self_reply_settings")
            .select("persona_id, enabled, messages")
            .in("persona_id", ids)
            .eq("user_id", user.id);
          if (sErr) throw sErr;
          const map: Record<string, SettingsRow> = {};
          (settingRows || []).forEach((r: any) => {
            map[r.persona_id] = { enabled: !!r.enabled, messages: r.messages || [] };
          });
          // initialize missing
          (personaList || []).forEach(p => {
            if (!map[p.id]) map[p.id] = { enabled: false, messages: [] };
          });
          setSettings(map);
        }
      } catch (e: any) {
        console.error(e);
        toast({ title: "読み込みエラー", description: e.message || String(e), variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleToggle = (personaId: string, val: boolean) => {
    setSettings(prev => ({ ...prev, [personaId]: { ...(prev[personaId] || { enabled: false, messages: [] }), enabled: val } }));
  };

  const handleMessagesChange = (personaId: string, text: string) => {
    const list = text
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);
    setSettings(prev => ({ ...prev, [personaId]: { ...(prev[personaId] || { enabled: false, messages: [] }), messages: list } }));
  };

  const currentMessagesText = (personaId: string) => (settings[personaId]?.messages || []).join("\n");

  const onSave = async (personaId: string) => {
    if (!user) return;
    try {
      setLoading(true);
      const payload = {
        user_id: user.id,
        persona_id: personaId,
        enabled: settings[personaId]?.enabled || false,
        messages: settings[personaId]?.messages || [],
      };
      const { error } = await supabase
        .from("self_reply_settings")
        .upsert(payload, { onConflict: "user_id,persona_id" });
      if (error) throw error;
      toast({ title: "保存しました", description: "セルフリプライ設定を更新しました。" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "保存に失敗", description: e.message || String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const runNow = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("self-reply-processor", { body: { limit: 10 } });
      if (error) throw error;
      toast({ title: "処理実行", description: `処理件数: ${data?.processed ?? 0}` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "実行エラー", description: e.message || String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-stone-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ChevronLeft className="mr-2 h-4 w-4" /> 戻る
          </Button>
          <Button onClick={runNow} disabled={loading} className="inline-flex items-center">
            <RefreshCcw className="mr-2 h-4 w-4" /> 今すぐ処理
          </Button>
        </div>

        <header>
          <h1 className="text-3xl font-bold tracking-tight text-gray-800">セルフリプライモード</h1>
          <p className="text-gray-600">予約投稿・完全オートポスト直後に、自分の投稿へ自動リプライを送信します（遅延なし／ペルソナ単位）。</p>
        </header>

        <section className="space-y-4">
          {personas.map((p) => (
            <Card key={p.id} className="border border-slate-200 bg-white/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-indigo-600 to-purple-700 rounded-md">
                    <MessageSquareQuote className="h-5 w-5 text-white" />
                  </div>
                  {p.name}
                  <Badge variant={settings[p.id]?.enabled ? "default" : "secondary"}>
                    {settings[p.id]?.enabled ? "有効" : "無効"}
                  </Badge>
                </CardTitle>
                <CardDescription>ONで有効化。メッセージは1行＝1パターン。複数ある場合はランダムで1件送信します。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch id={`sw-${p.id}`} checked={!!settings[p.id]?.enabled} onCheckedChange={(v) => handleToggle(p.id, v)} />
                  <Label htmlFor={`sw-${p.id}`}>このペルソナでセルフリプライを有効にする</Label>
                </div>

                <div className="space-y-2">
                  <Label>リプライ内容（1行1メッセージ）</Label>
                  <Textarea
                    placeholder={"例) 詳細はこちらをご覧ください\n例) プロフィールのリンクからチェックしてね"}
                    value={currentMessagesText(p.id)}
                    onChange={(e) => handleMessagesChange(p.id, e.target.value)}
                    rows={6}
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => onSave(p.id)} disabled={loading}>保存</Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {personas.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>ペルソナが見つかりません</CardTitle>
                <CardDescription>まずは「ペルソナ設定」から作成してください。</CardDescription>
              </CardHeader>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
};

export default SelfReplySettings;
