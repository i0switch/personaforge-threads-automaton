import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

const ensureCanonical = () => {
  const existing = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  const href = window.location.origin + "/auto-post-mode";
  if (existing) existing.href = href;
  else {
    const link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", href);
    document.head.appendChild(link);
  }
};

export default function AutoPostMode() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "完全オートポストモード | Threads-Genius AI";
    setMeta("description", "完全オートポストモードでAIが投稿生成から予約・投稿まで自動化。設定不要で運用を省力化。");
    ensureCanonical();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">完全オートポストモード</h1>
            <p className="text-muted-foreground mt-1">AIが生成→予約→投稿まで自動運用（ベータ）</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>ホームに戻る</Button>
        </header>

        <main className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>概要</CardTitle>
              <CardDescription>このモードでは、キーワードや頻度を指定するだけで、AIが最適な投稿を作成し自動でキューに投入・投稿します。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc pl-6 text-sm text-muted-foreground">
                <li>完全自動：生成→スケジュール→投稿まで</li>
                <li>安全設計：制限回数・稼働時間帯を設定可能</li>
                <li>中断はいつでも可能</li>
              </ul>
            </CardContent>
          </Card>

          <section className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>クイックスタート</CardTitle>
                <CardDescription>まずは基本設定から始めましょう</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-3 flex-wrap">
                <Button onClick={() => navigate("/scheduled-posts")}>スケジュール設定を開く</Button>
                <Button variant="secondary" onClick={() => navigate("/create-posts")}>投稿テンプレートを作成</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>注意事項</CardTitle>
                <CardDescription>運用前にご確認ください</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
                  <li>本機能はベータ版です。想定外の出力が行われる可能性があります。</li>
                  <li>各SNSのポリシーに反する内容の投稿は行われません。</li>
                  <li>運用停止はいつでも可能です。</li>
                </ul>
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
