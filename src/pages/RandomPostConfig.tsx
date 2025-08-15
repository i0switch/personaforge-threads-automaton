import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { RandomPostConfig as RandomPostConfigComponent } from "@/components/AutoPost/RandomPostConfig";

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
  const href = window.location.origin + "/auto-post-mode/random";
  if (existing) existing.href = href;
  else {
    const link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", href);
    document.head.appendChild(link);
  }
};

export default function RandomPostConfigPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "ランダムポスト設定 | Threads-Genius AI";
    setMeta("description", "ペルソナごとにランダムな時間での自動投稿を設定します");
    ensureCanonical();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/auto-post-mode")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            オートポストモードに戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">ランダムポスト設定</h1>
            <p className="text-muted-foreground mt-1">
              ペルソナごとにランダムな時間での自動投稿を設定
            </p>
          </div>
        </header>

        <main>
          <RandomPostConfigComponent />
        </main>
      </div>
    </div>
  );
}