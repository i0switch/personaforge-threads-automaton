
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MessageSquare, Save, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];

const AutoReply = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [generatingReply, setGeneratingReply] = useState(false);
  const [testPostContent, setTestPostContent] = useState("");
  const [testReplyContent, setTestReplyContent] = useState("");
  const [generatedReply, setGeneratedReply] = useState("");

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Load personas
      const { data: personasData, error: personasError } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (personasError) throw personasError;
      setPersonas(personasData || []);
      if (personasData && personasData.length > 0) {
        setSelectedPersona(personasData[0]);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "エラー",
        description: "データの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateAutoReply = async () => {
    if (!selectedPersona || !testPostContent || !testReplyContent) {
      toast({
        title: "エラー",
        description: "ペルソナ、投稿内容、リプライ内容をすべて入力してください。",
        variant: "destructive",
      });
      return;
    }

    setGeneratingReply(true);
    try {
      console.log('Calling generate-auto-reply with:', {
        postContent: testPostContent,
        replyContent: testReplyContent,
        persona: selectedPersona
      });

      const { data, error } = await supabase.functions.invoke('generate-auto-reply', {
        body: {
          postContent: testPostContent,
          replyContent: testReplyContent,
          persona: selectedPersona
        }
      });

      console.log('Auto-reply response:', { data, error });

      if (error) {
        console.error('Auto-reply generation error:', error);
        throw new Error(`自動返信生成に失敗しました: ${error.message}`);
      }

      if (!data || !data.reply) {
        throw new Error('返信データが返されませんでした');
      }

      setGeneratedReply(data.reply);

      toast({
        title: "生成完了",
        description: "自動返信文が生成されました。",
      });
    } catch (error) {
      console.error('Error generating auto-reply:', error);
      const errorMessage = error instanceof Error ? error.message : "自動返信生成に失敗しました。";
      toast({
        title: "エラー",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setGeneratingReply(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>読み込み中...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">自動返信設定</h1>
            <p className="text-muted-foreground">
              自動返信のテストと設定は<Button variant="link" className="p-0 h-auto text-primary" onClick={() => navigate("/persona-setup")}>ペルソナ設定ページ</Button>で行えます
            </p>
          </div>
        </div>

        {/* 設定案内 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              自動返信の設定について
            </CardTitle>
            <CardDescription>
              各ペルソナごとに自動返信モードを設定できます
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <div className="text-blue-500 mt-0.5">ℹ️</div>
                <div className="text-sm text-blue-700 space-y-2">
                  <p><strong>自動返信の設定は「ペルソナ設定ページ」で行います：</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>無効</strong>: 自動返信を行いません</li>
                    <li><strong>キーワード自動返信</strong>: 設定したキーワードに反応して定型文を返信</li>
                    <li><strong>AI自動返信</strong>: AIがコンテキストを理解して自動で返信を生成</li>
                  </ul>
                  <p className="mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate("/persona-setup")}
                    >
                      ペルソナ設定ページへ
                    </Button>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI自動返信テスト */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI自動返信テスト
            </CardTitle>
            <CardDescription>
              投稿とリプライを入力してAI返信を生成テストできます
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>ペルソナ選択</Label>
              <select 
                className="w-full p-2 border rounded-md"
                value={selectedPersona?.id || ""}
                onChange={(e) => {
                  const persona = personas.find(p => p.id === e.target.value);
                  setSelectedPersona(persona || null);
                }}
              >
                <option value="">ペルソナを選択してください</option>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>元の投稿内容</Label>
              <Textarea
                value={testPostContent}
                onChange={(e) => setTestPostContent(e.target.value)}
                placeholder="元の投稿内容を入力してください"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>受信したリプライ</Label>
              <Textarea
                value={testReplyContent}
                onChange={(e) => setTestReplyContent(e.target.value)}
                placeholder="受信したリプライ内容を入力してください"
                rows={3}
              />
            </div>

            <Button 
              onClick={generateAutoReply} 
              disabled={generatingReply || !selectedPersona || !testPostContent || !testReplyContent}
              className="w-full"
            >
              {generatingReply ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  AI返信生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI返信を生成
                </>
              )}
            </Button>

            {generatedReply && (
              <div className="space-y-2">
                <Label>生成された返信</Label>
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm">{generatedReply}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AutoReply;
