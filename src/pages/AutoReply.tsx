import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Bot, MessageCircle, Save, Plus, Trash2, Loader2, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AutoReply = Database['public']['Tables']['auto_replies']['Row'];
type Persona = Database['public']['Tables']['personas']['Row'];

const AutoReply = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [autoReplies, setAutoReplies] = useState<AutoReply[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [newRule, setNewRule] = useState({
    trigger_keywords: "",
    response_template: "",
    persona_id: ""
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load auto replies and personas in parallel
      const [repliesResult, personasResult] = await Promise.all([
        supabase
          .from('auto_replies')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('personas')
          .select('*')
          .eq('user_id', user?.id)
      ]);

      if (repliesResult.error) throw repliesResult.error;
      if (personasResult.error) throw personasResult.error;

      setAutoReplies(repliesResult.data || []);
      setPersonas(personasResult.data || []);
      
      // Auto-select first persona if available
      if (personasResult.data && personasResult.data.length > 0 && !newRule.persona_id) {
        setNewRule(prev => ({ ...prev, persona_id: personasResult.data[0].id }));
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

  const addReplyRule = async () => {
    if (!newRule.trigger_keywords.trim() || !newRule.response_template.trim() || !newRule.persona_id) {
      toast({
        title: "エラー",
        description: "すべての項目を入力してください。",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const keywordsArray = newRule.trigger_keywords.split(',').map(k => k.trim()).filter(k => k);
      
      const { data, error } = await supabase
        .from('auto_replies')
        .insert([{
          trigger_keywords: keywordsArray,
          response_template: newRule.response_template,
          persona_id: newRule.persona_id,
          user_id: user?.id,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      setAutoReplies(prev => [data, ...prev]);
      setNewRule({
        trigger_keywords: "",
        response_template: "",
        persona_id: newRule.persona_id // Keep the selected persona
      });
      
      toast({
        title: "返信ルールを追加しました",
        description: "新しい自動返信ルールが作成されました。",
      });
    } catch (error) {
      console.error('Error adding reply rule:', error);
      toast({
        title: "エラー",
        description: "返信ルールの追加に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteReplyRule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('auto_replies')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;

      setAutoReplies(prev => prev.filter(rule => rule.id !== id));
      toast({
        title: "返信ルールを削除しました",
        description: "選択した返信ルールを削除しました。",
      });
    } catch (error) {
      console.error('Error deleting reply rule:', error);
      toast({
        title: "エラー",
        description: "返信ルールの削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const toggleRule = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('auto_replies')
        .update({ is_active: !currentStatus })
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;

      setAutoReplies(prev => prev.map(rule => 
        rule.id === id ? { ...rule, is_active: !currentStatus } : rule
      ));
      
      const statusText = !currentStatus ? '有効' : '無効';
      toast({
        title: `返信ルールを${statusText}にしました`,
        description: `返信ルールの状態を更新しました。`,
      });
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast({
        title: "エラー",
        description: "返信ルールの状態更新に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const getPersonaName = (personaId: string | null) => {
    if (!personaId) return "不明";
    const persona = personas.find(p => p.id === personaId);
    return persona?.name || "不明";
  };

  const getPersonaAvatar = (personaId: string | null) => {
    if (!personaId) return null;
    const persona = personas.find(p => p.id === personaId);
    return persona?.avatar_url || null;
  };

  // Stats calculations
  const activeRules = autoReplies.filter(r => r.is_active).length;
  const totalRules = autoReplies.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate("/")} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">自動返信設定</h1>
            <p className="text-muted-foreground">AIによる自動返信の設定と管理</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">アクティブルール</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeRules}</div>
              <p className="text-xs text-muted-foreground">有効な返信ルール</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総ルール数</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRules}</div>
              <p className="text-xs text-muted-foreground">設定済みルール</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ペルソナ数</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{personas.length}</div>
              <p className="text-xs text-muted-foreground">利用可能ペルソナ</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="rules" className="space-y-6">
          <TabsList>
            <TabsTrigger value="rules">返信ルール ({totalRules})</TabsTrigger>
            <TabsTrigger value="add">新規作成</TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>新しい返信ルールを追加</CardTitle>
                <CardDescription>
                  特定のキーワードに対する自動返信を設定します
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {personas.length === 0 ? (
                  <div className="text-center py-8">
                    <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">ペルソナが必要です</h3>
                    <p className="text-muted-foreground mb-4">
                      自動返信を設定する前に、ペルソナを作成してください。
                    </p>
                    <Button onClick={() => navigate("/persona-setup")}>
                      ペルソナを作成
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="persona">使用するペルソナ</Label>
                      <Select value={newRule.persona_id} onValueChange={(value) => setNewRule(prev => ({ ...prev, persona_id: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="ペルソナを選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {personas.map((persona) => (
                            <SelectItem key={persona.id} value={persona.id}>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={persona.avatar_url || ""} />
                                  <AvatarFallback>{persona.name[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span>{persona.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="trigger">トリガーキーワード</Label>
                      <Input
                        id="trigger"
                        value={newRule.trigger_keywords}
                        onChange={(e) => setNewRule(prev => ({ ...prev, trigger_keywords: e.target.value }))}
                        placeholder="例: ありがとう, 質問, こんにちは (カンマ区切り)"
                        disabled={saving}
                      />
                      <p className="text-sm text-muted-foreground">
                        複数のキーワードはカンマで区切って入力してください
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="response">自動返信テンプレート</Label>
                      <Textarea
                        id="response"
                        value={newRule.response_template}
                        onChange={(e) => setNewRule(prev => ({ ...prev, response_template: e.target.value }))}
                        placeholder="自動返信で送信するメッセージのテンプレートを入力"
                        rows={4}
                        disabled={saving}
                      />
                      <p className="text-sm text-muted-foreground">
                        選択したペルソナの特徴を活かした返信が生成されます
                      </p>
                    </div>

                    <Button onClick={addReplyRule} disabled={saving} className="w-full">
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          作成中...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          返信ルールを追加
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules" className="space-y-6">
            {autoReplies.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">返信ルールがありません</h3>
                  <p className="text-muted-foreground mb-4">
                    新しい自動返信ルールを作成して、効率的な対応を始めましょう。
                  </p>
                  <Button onClick={() => navigate("/auto-reply?tab=add")}>
                    返信ルールを作成
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {autoReplies.map((rule) => (
                  <Card key={rule.id} className={!rule.is_active ? "opacity-50" : ""}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={getPersonaAvatar(rule.persona_id) || ""} />
                            <AvatarFallback>
                              {getPersonaName(rule.persona_id)[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold">{getPersonaName(rule.persona_id)}</h3>
                            <div className="flex items-center gap-2">
                              <Badge variant={rule.is_active ? "default" : "secondary"}>
                                {rule.is_active ? "有効" : "無効"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={() => toggleRule(rule.id, rule.is_active)}
                          />
                          <Button
                            onClick={() => deleteReplyRule(rule.id)}
                            variant="outline"
                            size="sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">トリガーキーワード</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {rule.trigger_keywords?.map((keyword, index) => (
                            <Badge key={index} variant="outline">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">返信テンプレート</Label>
                        <p className="text-sm text-muted-foreground mt-1 p-3 bg-muted rounded-md">
                          {rule.response_template}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AutoReply;