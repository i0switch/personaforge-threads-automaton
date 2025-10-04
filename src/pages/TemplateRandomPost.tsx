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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>
        </div>

        <Card className="border-0 bg-gradient-to-r from-purple-500 to-pink-600 shadow-xl">
          <div className="bg-white/95 backdrop-blur-sm m-1 rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                テンプレート文章ランダムポスト
              </CardTitle>
              <CardDescription className="text-base">
                設定した複数のテンプレート文章から、指定した時間にランダムにポストします。
                <br />
                <strong>既存の機能と共存可能：</strong>完全自動オートポストやランダムポスト機能が有効でも使用できます。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-purple-50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold text-purple-900 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  機能の特徴
                </h3>
                <ul className="space-y-2 text-sm text-purple-800">
                  <li>✅ 複数のテンプレート文章を設定</li>
                  <li>✅ 複数の投稿時間を指定可能</li>
                  <li>✅ 指定時間にランダムにテンプレートを選択して投稿</li>
                  <li>✅ 他の自動投稿機能と併用可能</li>
                  <li>✅ タイムゾーン対応</li>
                </ul>
              </div>
            </CardContent>
          </div>
        </Card>

        <TemplateConfigComponent />
      </div>
    </div>
  );
}
