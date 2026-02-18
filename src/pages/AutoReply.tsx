
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MessageSquare, Save, Loader2, Sparkles, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ThreadsRateLimitBanner } from "@/components/ThreadsRateLimitBanner";

type Persona = Database['public']['Tables']['personas']['Row'];
type AutoReply = Database['public']['Tables']['auto_replies']['Row'];

const AutoReply = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [autoReplies, setAutoReplies] = useState<AutoReply[]>([]);
  const [generatingReply, setGeneratingReply] = useState(false);
  const [testPostContent, setTestPostContent] = useState("");
  const [testReplyContent, setTestReplyContent] = useState("");
  const [generatedReply, setGeneratedReply] = useState("");
  
  // キーワード返信フォーム用の状態
  const [keywords, setKeywords] = useState("");
  const [responseTemplate, setResponseTemplate] = useState("");
  
  // フィルター用の状態
  const [filterPersonaId, setFilterPersonaId] = useState<string>("all");

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

      // Load auto replies
      const { data: autoRepliesData, error: autoRepliesError } = await supabase
        .from('auto_replies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (autoRepliesError) throw autoRepliesError;
      setAutoReplies(autoRepliesData || []);

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

  const saveKeywordReply = async () => {
    if (!selectedPersona || !keywords.trim() || !responseTemplate.trim()) {
      toast({
        title: "エラー",
        description: "ペルソナ、キーワード、返信テンプレートをすべて入力してください。",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const keywordArray = keywords.split(',').map(k => k.trim()).filter(Boolean);
      
      const { error } = await supabase
        .from('auto_replies')
        .insert({
          user_id: user!.id,
          persona_id: selectedPersona.id,
          trigger_keywords: keywordArray,
          response_template: responseTemplate,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "成功",
        description: "キーワード返信が保存されました。",
      });

      setKeywords("");
      setResponseTemplate("");
      loadData();
    } catch (error) {
      console.error('Error saving keyword reply:', error);
      toast({
        title: "エラー",
        description: "キーワード返信の保存に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteAutoReply = async (id: string) => {
    try {
      const { error } = await supabase
        .from('auto_replies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "成功",
        description: "キーワード返信を削除しました。",
      });

      loadData();
    } catch (error) {
      console.error('Error deleting auto reply:', error);
      toast({
        title: "エラー",
        description: "キーワード返信の削除に失敗しました。",
        variant: "destructive",
      });
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

    console.log('generateAutoReply: Starting auto-reply generation');
    setGeneratingReply(true);
    
    try {
      console.log('generateAutoReply: Calling generate-auto-reply with:', {
        postContent: testPostContent,
        replyContent: testReplyContent,
        persona: selectedPersona
      });

      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      console.log('generateAutoReply: Session obtained:', !!session);
      
      const { data, error } = await supabase.functions.invoke('generate-auto-reply', {
        body: {
          postContent: testPostContent,
          replyContent: testReplyContent,
          persona: selectedPersona
        },
        headers: session ? {
          Authorization: `Bearer ${session.access_token}`,
        } : {}
      });

      console.log('generateAutoReply: Auto-reply response received:', { data, error });

      if (error) {
        console.error('generateAutoReply: Auto-reply generation error:', error);
        throw new Error(`自動返信生成に失敗しました: ${error.message}`);
      }

      if (!data || !data.reply) {
        console.error('generateAutoReply: No reply data returned:', data);
        throw new Error('返信データが返されませんでした');
      }

      console.log('generateAutoReply: Setting generated reply:', data.reply);
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
        {/* Threads API error 613 レート制限通知バナー */}
        <ThreadsRateLimitBanner />

        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">自動返信設定</h1>
            <p className="text-muted-foreground">
              キーワード自動返信の設定とAI返信のテストができます
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

        {/* キーワード返信設定 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              キーワード返信を追加
            </CardTitle>
            <CardDescription>
              特定のキーワードに反応する自動返信を設定できます
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
              <Label>トリガーキーワード（カンマ区切り）</Label>
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="例: ありがとう, 感謝, お疲れ様"
              />
            </div>

            <div className="space-y-2">
              <Label>返信テンプレート</Label>
              <Textarea
                value={responseTemplate}
                onChange={(e) => setResponseTemplate(e.target.value)}
                placeholder="キーワードが検出された時の返信内容を入力してください"
                rows={3}
              />
            </div>

            <Button 
              onClick={saveKeywordReply} 
              disabled={saving || !selectedPersona || !keywords || !responseTemplate}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  キーワード返信を保存
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 登録済みキーワード返信一覧 */}
        {autoReplies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>登録済みキーワード返信</CardTitle>
              <CardDescription>
                現在設定されているキーワード返信の一覧
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <Label className="min-w-fit">ペルソナで絞り込み:</Label>
                  <select 
                    className="w-full max-w-xs p-2 border rounded-md"
                    value={filterPersonaId}
                    onChange={(e) => setFilterPersonaId(e.target.value)}
                  >
                    <option value="all">すべて</option>
                    {personas.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {autoReplies
                  .filter(reply => filterPersonaId === "all" || reply.persona_id === filterPersonaId)
                  .map((reply) => {
                  const persona = personas.find(p => p.id === reply.persona_id);
                  return (
                    <div key={reply.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{persona?.name || '不明なペルソナ'}</p>
                          <p className="text-sm text-muted-foreground">
                            キーワード: {reply.trigger_keywords?.join(', ')}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteAutoReply(reply.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm bg-muted p-2 rounded">{reply.response_template}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

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
