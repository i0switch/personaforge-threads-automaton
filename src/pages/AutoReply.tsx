import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Zap, Plus, Trash2, Edit, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];
type AutoReply = Database['public']['Tables']['auto_replies']['Row'] & {
  personas?: Pick<Database['public']['Tables']['personas']['Row'], 'name' | 'avatar_url'>;
};

const AutoReply = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [autoReplies, setAutoReplies] = useState<AutoReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form states
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [triggerKeywords, setTriggerKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [responseTemplate, setResponseTemplate] = useState("");
  const [isActive, setIsActive] = useState(true);

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

      // Load auto replies
      const { data: repliesData, error: repliesError } = await supabase
        .from('auto_replies')
        .select(`
          *,
          personas!inner(name, avatar_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (repliesError) throw repliesError;
      setAutoReplies(repliesData || []);
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

  const addKeyword = () => {
    if (keywordInput.trim() && !triggerKeywords.includes(keywordInput.trim())) {
      setTriggerKeywords([...triggerKeywords, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setTriggerKeywords(triggerKeywords.filter(k => k !== keyword));
  };

  const resetForm = () => {
    setSelectedPersona("");
    setTriggerKeywords([]);
    setKeywordInput("");
    setResponseTemplate("");
    setIsActive(true);
    setEditingId(null);
  };

  const saveAutoReply = async () => {
    if (!selectedPersona || triggerKeywords.length === 0 || !responseTemplate.trim()) {
      toast({
        title: "エラー",
        description: "すべての項目を入力してください。",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const data = {
        user_id: user!.id,
        persona_id: selectedPersona,
        trigger_keywords: triggerKeywords,
        response_template: responseTemplate,
        is_active: isActive
      };

      let error;
      if (editingId) {
        ({ error } = await supabase
          .from('auto_replies')
          .update(data)
          .eq('id', editingId)
          .eq('user_id', user!.id));
      } else {
        ({ error } = await supabase
          .from('auto_replies')
          .insert([data]));
      }

      if (error) throw error;

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user!.id,
          persona_id: selectedPersona,
          action_type: editingId ? 'auto_reply_updated' : 'auto_reply_created',
          description: `自動返信ルールを${editingId ? '更新' : '作成'}しました`
        });

      toast({
        title: "成功",
        description: `自動返信ルールを${editingId ? '更新' : '作成'}しました。`,
      });

      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving auto reply:', error);
      toast({
        title: "エラー",
        description: "自動返信ルールの保存に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const editAutoReply = (reply: AutoReply) => {
    setEditingId(reply.id);
    setSelectedPersona(reply.persona_id || "");
    setTriggerKeywords(reply.trigger_keywords || []);
    setResponseTemplate(reply.response_template);
    setIsActive(reply.is_active);
  };

  const deleteAutoReply = async (id: string) => {
    try {
      const { error } = await supabase
        .from('auto_replies')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);

      if (error) throw error;

      setAutoReplies(prev => prev.filter(r => r.id !== id));
      toast({
        title: "成功",
        description: "自動返信ルールを削除しました。",
      });
    } catch (error) {
      console.error('Error deleting auto reply:', error);
      toast({
        title: "エラー",
        description: "自動返信ルールの削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const toggleAutoReply = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('auto_replies')
        .update({ is_active: !currentStatus })
        .eq('id', id)
        .eq('user_id', user!.id);

      if (error) throw error;

      setAutoReplies(prev => 
        prev.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r)
      );

      toast({
        title: "成功",
        description: `自動返信を${!currentStatus ? '有効' : '無効'}にしました。`,
      });
    } catch (error) {
      console.error('Error toggling auto reply:', error);
      toast({
        title: "エラー",
        description: "設定の変更に失敗しました。",
        variant: "destructive",
      });
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
              返信ルールを設定して自動応答を管理
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 設定フォーム */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                {editingId ? '自動返信ルール編集' : '新規自動返信ルール'}
              </CardTitle>
              <CardDescription>
                トリガーキーワードと返信テンプレートを設定
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* ペルソナ選択 */}
              <div className="space-y-2">
                <Label>ペルソナ選択</Label>
                <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                  <SelectTrigger>
                    <SelectValue placeholder="ペルソナを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {personas.map((persona) => (
                      <SelectItem key={persona.id} value={persona.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={persona.avatar_url || ""} />
                            <AvatarFallback>{persona.name[0]}</AvatarFallback>
                          </Avatar>
                          {persona.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* トリガーキーワード */}
              <div className="space-y-2">
                <Label>トリガーキーワード</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="キーワードを入力"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                  />
                  <Button size="sm" onClick={addKeyword}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {triggerKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {triggerKeywords.map((keyword, index) => (
                      <Badge key={index} variant="secondary">
                        {keyword}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0 ml-1"
                          onClick={() => removeKeyword(keyword)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* 返信テンプレート */}
              <div className="space-y-2">
                <Label>返信テンプレート</Label>
                <Textarea
                  placeholder="自動返信のテンプレートを入力してください"
                  value={responseTemplate}
                  onChange={(e) => setResponseTemplate(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  {'{user}'}でユーザー名、{'{content}'}で元投稿内容を参照できます
                </p>
              </div>

              {/* 有効/無効切り替え */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="is-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="is-active">自動返信を有効にする</Label>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={saveAutoReply} 
                  disabled={isCreating}
                  className="flex-1"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      {editingId ? '更新' : '作成'}
                    </>
                  )}
                </Button>
                {editingId && (
                  <Button onClick={resetForm} variant="outline">
                    キャンセル
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 既存ルール一覧 */}
          <Card>
            <CardHeader>
              <CardTitle>自動返信ルール一覧</CardTitle>
              <CardDescription>
                {autoReplies.length > 0 
                  ? `${autoReplies.length}個のルールが設定されています`
                  : "自動返信ルールはありません"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {autoReplies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>自動返信ルールを作成してください</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {autoReplies.map((reply) => (
                    <div key={reply.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={reply.personas?.avatar_url || ""} />
                            <AvatarFallback>
                              {reply.personas?.name?.[0] || "P"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {reply.personas?.name || "不明"}
                          </span>
                          <Switch
                            checked={reply.is_active}
                            onCheckedChange={() => toggleAutoReply(reply.id, reply.is_active)}
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => editAutoReply(reply)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteAutoReply(reply.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-medium mb-1">トリガーキーワード:</p>
                          <div className="flex flex-wrap gap-1">
                            {reply.trigger_keywords?.map((keyword, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium mb-1">返信テンプレート:</p>
                          <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                            {reply.response_template}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AutoReply;
