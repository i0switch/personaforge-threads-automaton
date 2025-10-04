import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, Clock } from "lucide-react";
import { TemplateConfigComponent } from "@/components/TemplateRandomPost/TemplateConfig";

// SEO Meta管理
function setMeta(name: string, content: string) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function ensureCanonical() {
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', window.location.href);
}

export default function TemplateRandomPost() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "テンプレート文章ランダムポスト | Threads-Genius AI";
    setMeta('description', '設定した複数のテンプレート文章から、指定した時間にランダムにポストする機能です。');
    ensureCanonical();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">テンプレート文章ランダムポスト</h1>
            <p className="text-muted-foreground mt-1">
              設定したテンプレート文章から、指定時間にランダムに投稿
            </p>
          </div>
        </header>

        <main className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                概要
              </CardTitle>
              <CardDescription>
                設定した複数のテンプレート文章から、指定した時間にランダムにポストします。
                完全自動オートポストやランダムポスト機能が有効でも併用できます。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-2">
                  <h3 className="font-semibold">機能の特徴</h3>
                  <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
                    <li>複数のテンプレート文章を設定</li>
                    <li>複数の投稿時間を指定可能</li>
                    <li>指定時間にランダムにテンプレートを選択して投稿</li>
                    <li>他の自動投稿機能と併用可能</li>
                    <li>タイムゾーン対応</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <TemplateConfigComponent />
        </main>
      </div>
    </div>
  );
}
