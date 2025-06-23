
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MessageSquare, Plus, Trash2, Save, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AutoReplyRule = Database['public']['Tables']['auto_replies']['Row'];
type Persona = Database['public']['Tables']['personas']['Row'];

const AutoReply = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [aiAutoReplyEnabled, setAiAutoReplyEnabled] = useState(false);
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
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
      // Load profile settings with proper error handling
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('auto_reply_enabled, ai_auto_reply_enabled')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Profile error:', profileError);
        throw profileError;
      }
      
      if (profile) {
        setAutoReplyEnabled(profile.auto_reply_enabled || false);
        setAiAutoReplyEnabled(profile.ai_auto_reply_enabled || false);
      }

      // Load auto-reply rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('auto_replies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (rulesError) throw rulesError;
      setRules(rulesData || []);

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

  const saveSettings = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          auto_reply_enabled: autoReplyEnabled,
          ai_auto_reply_enabled: aiAutoReplyEnabled
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "成功",
        description: "設定を保存しました。",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "エラー",
        description: "設定の保存に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addRule = () => {
    const newRule: Partial<AutoReplyRule> = {
      user_id: user!.id,
      trigger_keywords: [],
      response_template: "",
      is_active: true,
      persona_id: selectedPersona?.id || null
    };

    setRules([...rules, newRule as AutoReplyRule]);
  };

  const removeRule = async (index: number) => {
    const rule = rules[index];
    if (rule.id) {
      try {
        const { error } = await supabase
          .from('auto_replies')
          .delete()
          .eq('id', rule.id);

        if (error) throw error;
      } catch (error) {
        console.error('Error deleting rule:', error);
        toast({
          title: "エラー",
          description: "ルールの削除に失敗しました。",
          variant: "destructive",
        });
        return;
      }
    }

    const newRules = rules.filter((_, i) => i !== index);
    setRules(newRules);
  };

  const updateRule = (index: number, field: keyof AutoReplyRule, value: any) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [field]: value };
    setRules(newRules);
  };

  const saveRules = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      for (const rule of rules) {
        if (rule.id) {
          // Update existing rule
          const { error } = await supabase
            .from('auto_replies')
            .update({
              trigger_keywords: rule.trigger_keywords,
              response_template: rule.response_template,
              is_active: rule.is_active,
              persona_id: rule.persona_id
            })
            .eq('id', rule.id);

          if (error) throw error;
        } else {
          // Insert new rule
          const { error } = await supabase
            .from('auto_replies')
            .insert([{
              user_id: user.id,
              trigger_keywords: rule.trigger_keywords,
              response_template: rule.response_template,
              is_active: rule.is_active,
              persona_id: rule.persona_id
            }]);

          if (error) throw error;
        }
      }

      // Reload data to get updated IDs
      loadData();

      toast({
        title: "成功",
        description: "自動返信ルールを保存しました。",
      });
    } catch (error) {
      console.error('Error saving rules:', error);
      toast({
        title: "エラー",
        description: "ルールの保存に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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

  // Toggle behavior handler
  const handleAiAutoReplyToggle = (checked: boolean) => {
    setAiAutoReplyEnabled(checked);
    if (checked) {
      setAutoReplyEnabled(false); // Turn off keyword auto-reply when AI is enabled
    }
  };

  const handleKeywordAutoReplyToggle = (checked: boolean) => {
    setAutoReplyEnabled(checked);
    if (checked) {
      setAiAutoReplyEnabled(false); // Turn off AI auto-reply when keyword is enabled
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
              キーワードに基づく自動返信とAI自動返信を設定できます
            </p>
          </div>
        </div>

        {/* 基本設定 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              基本設定
            </CardTitle>
            <CardDescription>
              自動返信機能の有効/無効を設定します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-reply"
                checked={autoReplyEnabled}
                onCheckedChange={handleKeywordAutoReplyToggle}
              />
              <Label htmlFor="auto-reply">キーワード自動返信を有効にする</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="ai-auto-reply"
                checked={aiAutoReplyEnabled}
                onCheckedChange={handleAiAutoReplyToggle}
              />
              <Label htmlFor="ai-auto-reply">AI自動返信を有効にする</Label>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <div className="text-yellow-500 mt-0.5">⚠️</div>
                <div className="text-sm text-yellow-700">
                  <strong>注意:</strong> AI自動返信が有効な場合、キーワード自動返信は無効化されます。重複返信を防ぐためです。
                </div>
              </div>
            </div>

            <Button onClick={saveSettings} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  設定を保存
                </>
              )}
            </Button>
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

        {/* キーワード自動返信ルール */}
        <Card>
          <CardHeader>
            <CardTitle>キーワード自動返信ルール</CardTitle>
            <CardDescription>
              特定のキーワードに反応する自動返信を設定します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {rules.map((rule, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => updateRule(index, 'is_active', checked)}
                    />
                    <Label>ルール {index + 1}</Label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeRule(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>ペルソナ選択</Label>
                    <select 
                      className="w-full p-2 border rounded-md"
                      value={rule.persona_id || ""}
                      onChange={(e) => updateRule(index, 'persona_id', e.target.value || null)}
                    >
                      <option value="">ペルソナを選択してください</option>
                      {personas.map((persona) => (
                        <option key={persona.id} value={persona.id}>
                          {persona.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>トリガーキーワード（カンマ区切り）</Label>
                      <Input
                        value={Array.isArray(rule.trigger_keywords) ? rule.trigger_keywords.join(', ') : ''}
                        onChange={(e) => updateRule(index, 'trigger_keywords', e.target.value.split(',').map(k => k.trim()))}
                        placeholder="例: こんにちは, おはよう, ありがとう"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>返信文</Label>
                      <Textarea
                        value={rule.response_template}
                        onChange={(e) => updateRule(index, 'response_template', e.target.value)}
                        placeholder="自動返信する文章を入力"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <Button onClick={addRule} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                ルールを追加
              </Button>
              
              <Button onClick={saveRules} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    ルールを保存
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AutoReply;
