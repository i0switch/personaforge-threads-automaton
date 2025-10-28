import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Calendar as CalendarIcon, Upload, X, Send } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Persona {
  id: string;
  name: string;
  threads_access_token: string | null;
}

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
  const href = window.location.origin + "/manual-post";
  if (existing) existing.href = href;
  else {
    const link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", href);
    document.head.appendChild(link);
  }
};

export default function ManualPost() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");

  useEffect(() => {
    document.title = "手動投稿登録 | Threads-Genius AI";
    setMeta("description", "日時を指定して手動で予約投稿を作成します");
    ensureCanonical();
  }, []);

  useEffect(() => {
    loadPersonas();
  }, [user]);

  const loadPersonas = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("personas")
        .select("id, name, threads_access_token")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setPersonas(data || []);
    } catch (error: any) {
      console.error("ペルソナ読み込みエラー:", error);
      toast.error("ペルソナの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!user) return;
    if (images.length >= 2) {
      toast.error("画像は2つまでアップロードできます");
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/manual-posts/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName);

      setImages(prev => [...prev, publicUrl]);
      toast.success("画像をアップロードしました");
    } catch (error: any) {
      console.error("画像アップロードエラー:", error);
      toast.error("画像のアップロードに失敗しました");
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user || !selectedPersona || !content.trim() || !date || !time) {
      toast.error("すべての必須項目を入力してください");
      return;
    }

    const persona = personas.find(p => p.id === selectedPersona);
    if (!persona?.threads_access_token) {
      toast.error("選択されたペルソナにThreadsトークンが設定されていません");
      return;
    }

    setSubmitting(true);
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledDateTime = new Date(date);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      if (scheduledDateTime <= new Date()) {
        toast.error("過去の日時は指定できません");
        setSubmitting(false);
        return;
      }

      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          persona_id: selectedPersona,
          content: content.trim(),
          images: images.length > 0 ? images : null,
          status: "scheduled",
          scheduled_for: scheduledDateTime.toISOString(),
          auto_schedule: false,
          platform: "threads"
        })
        .select()
        .single();

      if (postError) throw postError;

      const { error: queueError } = await supabase
        .from("post_queue")
        .insert({
          user_id: user.id,
          post_id: post.id,
          scheduled_for: scheduledDateTime.toISOString(),
          status: "queued",
          queue_position: 0
        });

      if (queueError) throw queueError;

      toast.success("予約投稿を作成しました");
      
      setContent("");
      setImages([]);
      setDate(undefined);
      setTime("");
      setSelectedPersona("");
      
      setTimeout(() => {
        navigate("/scheduled-posts");
      }, 1500);
    } catch (error: any) {
      console.error("投稿作成エラー:", error);
      toast.error("投稿の作成に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            ダッシュボードに戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">手動投稿登録</h1>
            <p className="text-muted-foreground mt-1">
              日時を指定して予約投稿を作成
            </p>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>投稿情報</CardTitle>
            <CardDescription>
              すべての項目を入力して予約投稿を作成してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                {/* ペルソナ選択 */}
                <div className="space-y-2">
                  <Label htmlFor="persona">ペルソナ <span className="text-destructive">*</span></Label>
                  <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                    <SelectTrigger id="persona">
                      <SelectValue placeholder="投稿するペルソナを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {personas.map(persona => (
                        <SelectItem key={persona.id} value={persona.id}>
                          {persona.name}
                          {!persona.threads_access_token && " (トークン未設定)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {personas.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      アクティブなペルソナがありません
                    </p>
                  )}
                </div>

                {/* 投稿内容 */}
                <div className="space-y-2">
                  <Label htmlFor="content">投稿内容 <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="content"
                    placeholder="投稿する内容を入力してください"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {content.length}/500文字
                  </p>
                </div>

                {/* 画像アップロード */}
                <div className="space-y-2">
                  <Label>画像 (最大2枚)</Label>
                  {images.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {images.map((url, index) => (
                        <div key={index} className="relative group">
                          <img 
                            src={url} 
                            alt={`画像${index + 1}`}
                            className="w-32 h-32 object-cover rounded border"
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onClick={() => removeImage(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      };
                      input.click();
                    }}
                    disabled={images.length >= 2}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    画像を追加 ({images.length}/2)
                  </Button>
                </div>

                {/* 日付選択 */}
                <div className="space-y-2">
                  <Label>投稿日 <span className="text-destructive">*</span></Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP", { locale: ja }) : <span>日付を選択</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* 時間選択 */}
                <div className="space-y-2">
                  <Label htmlFor="time">投稿時刻 <span className="text-destructive">*</span></Label>
                  <input
                    type="time"
                    id="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                {/* 送信ボタン */}
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedPersona || !content.trim() || !date || !time}
                  className="w-full"
                  size="lg"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {submitting ? "作成中..." : "予約投稿を作成"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
