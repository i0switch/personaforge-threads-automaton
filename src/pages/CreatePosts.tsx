import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Bot, Calendar, Hash, Image, Settings, Wand2, Loader2, Save, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];
type GeneratedPost = {
  id: string;
  content: string;
  hashtags: string[];
  scheduled_for: string;
  edited: boolean;
};

const CreatePosts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  
  const [settings, setSettings] = useState({
    postCount: 5,
    startTime: "09:00",
    endTime: "21:00",
    interval: 2,
    topics: ["テクノロジー", "ライフスタイル"],
    customPrompt: ""
  });

  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [newTopic, setNewTopic] = useState("");

  useEffect(() => {
    loadPersonas();
  }, [user]);

  const loadPersonas = async () => {
    if (!user) return;
    
    setLoadingPersonas(true);
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPersonas(data || []);
      
      // Auto-select first persona if available
      if (data && data.length > 0) {
        setSelectedPersona(data[0].id);
      }
    } catch (error) {
      console.error('Error loading personas:', error);
      toast({
        title: "エラー",
        description: "ペルソナの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoadingPersonas(false);
    }
  };

  const handleGeneratePosts = async () => {
    if (!selectedPersona) {
      toast({
        title: "エラー",
        description: "ペルソナを選択してください。",
        variant: "destructive",
      });
      return;
    }

    if (settings.topics.length === 0) {
      toast({
        title: "エラー",
        description: "投稿トピックを少なくとも1つ追加してください。",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-posts', {
        body: {
          personaId: selectedPersona,
          topics: settings.topics,
          postCount: settings.postCount,
          startTime: settings.startTime,
          endTime: settings.endTime,
          interval: settings.interval,
          customPrompt: settings.customPrompt,
          user_id: user?.id
        }
      });

      if (error) throw error;

      const postsWithIds = data.posts.map((post: any, index: number) => ({
        ...post,
        id: `generated-${index}`,
        edited: false
      }));

      setGeneratedPosts(postsWithIds);
      setCurrentStep(2);
      
      toast({
        title: "投稿生成完了！",
        description: `${settings.postCount}件の投稿を生成しました。`,
      });
    } catch (error) {
      console.error('Error generating posts:', error);
      toast({
        title: "エラー",
        description: "投稿の生成に失敗しました。OpenAI APIキーが設定されているか確認してください。",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const savePosts = async () => {
    setSaving(true);
    try {
      const postsToSave = generatedPosts.map(post => ({
        content: post.content,
        hashtags: [],
        scheduled_for: post.scheduled_for,
        persona_id: selectedPersona,
        user_id: user?.id,
        status: 'scheduled' as const,
        platform: 'threads'
      }));

      const { error } = await supabase
        .from('posts')
        .insert(postsToSave);

      if (error) throw error;

      toast({
        title: "投稿を保存しました",
        description: `${generatedPosts.length}件の投稿を予約投稿として保存しました。`,
      });
      
      navigate('/scheduled-posts');
    } catch (error) {
      console.error('Error saving posts:', error);
      toast({
        title: "エラー",
        description: "投稿の保存に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addTopic = () => {
    if (newTopic && !settings.topics.includes(newTopic)) {
      setSettings(prev => ({
        ...prev,
        topics: [...prev.topics, newTopic]
      }));
      setNewTopic("");
    }
  };

  const removeTopic = (topic: string) => {
    setSettings(prev => ({
      ...prev,
      topics: prev.topics.filter(t => t !== topic)
    }));
  };

  const updatePost = (id: string, content: string) => {
    setGeneratedPosts(prev => 
      prev.map(post => 
        post.id === id 
          ? { ...post, content, edited: true }
          : post
      )
    );
  };

  const formatScheduledTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
            <h1 className="text-3xl font-bold text-foreground">投稿作成</h1>
            <p className="text-muted-foreground">AIで投稿を一括生成・編集します</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground text-background'}`}>
              1
            </div>
            <span className="text-sm font-medium">設定</span>
          </div>
          <div className="flex-1 h-px bg-muted-foreground"></div>
          <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground text-background'}`}>
              2
            </div>
            <span className="text-sm font-medium">生成・編集</span>
          </div>
          <div className="flex-1 h-px bg-muted-foreground"></div>
          <div className={`flex items-center gap-2 ${currentStep >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground text-background'}`}>
              3
            </div>
            <span className="text-sm font-medium">画像生成</span>
          </div>
        </div>

        <Tabs value={currentStep === 1 ? "settings" : "posts"} className="space-y-6">
          <TabsContent value="settings" className="space-y-6">
            {/* Persona Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  ペルソナ選択
                </CardTitle>
                <CardDescription>
                  投稿を生成するペルソナを選択してください
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPersonas ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>ペルソナを読み込み中...</span>
                  </div>
                ) : personas.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">ペルソナが見つかりません</p>
                    <Button onClick={() => navigate("/persona-setup")} variant="outline">
                      ペルソナを作成する
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Label>使用するペルソナ</Label>
                    <Select value={selectedPersona} onValueChange={setSelectedPersona}>
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
                    
                    {selectedPersona && (
                      <div className="p-4 bg-muted rounded-lg">
                        {(() => {
                          const persona = personas.find(p => p.id === selectedPersona);
                          return persona ? (
                            <div className="flex items-center gap-4">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={persona.avatar_url || ""} />
                                <AvatarFallback>{persona.name[0]?.toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <h3 className="font-semibold">{persona.name}</h3>
                                {persona.age && <p className="text-sm text-muted-foreground">{persona.age}</p>}
                                {persona.personality && (
                                  <p className="text-sm mt-1 line-clamp-2">{persona.personality}</p>
                                )}
                                {persona.expertise && persona.expertise.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {persona.expertise.slice(0, 3).map((skill, index) => (
                                      <Badge key={index} variant="secondary" className="text-xs">
                                        {skill}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  投稿設定
                </CardTitle>
                <CardDescription>
                  生成する投稿の詳細設定を行います
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postCount">投稿数</Label>
                    <Input
                      id="postCount"
                      type="number"
                      value={settings.postCount}
                      onChange={(e) => setSettings(prev => ({ ...prev, postCount: parseInt(e.target.value) }))}
                      min="1"
                      max="20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">開始時刻</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={settings.startTime}
                      onChange={(e) => setSettings(prev => ({ ...prev, startTime: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">終了時刻</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={settings.endTime}
                      onChange={(e) => setSettings(prev => ({ ...prev, endTime: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interval">間隔（時間）</Label>
                    <Input
                      id="interval"
                      type="number"
                      value={settings.interval}
                      onChange={(e) => setSettings(prev => ({ ...prev, interval: parseInt(e.target.value) }))}
                      min="1"
                      max="24"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customPrompt">カスタムプロンプト</Label>
                    <Textarea
                      id="customPrompt"
                      value={settings.customPrompt}
                      onChange={(e) => setSettings(prev => ({ ...prev, customPrompt: e.target.value }))}
                      placeholder="例：AI美女アカウント運用の場合、日常系の200文字程度のポストを生成してください"
                      rows={3}
                      className="resize-none"
                    />
                    <p className="text-sm text-muted-foreground">
                      具体的な指示を入力することで、より適切な投稿を生成できます
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>投稿トピック</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={newTopic}
                        onChange={(e) => setNewTopic(e.target.value)}
                        placeholder="新しいトピックを追加"
                        onKeyPress={(e) => e.key === 'Enter' && addTopic()}
                      />
                      <Button onClick={addTopic} variant="outline" size="sm">
                        追加
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {settings.topics.map((topic, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary"
                          className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => removeTopic(topic)}
                        >
                          {topic} ×
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={handleGeneratePosts} 
                    size="lg"
                    disabled={generating || !selectedPersona}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        投稿を生成
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="posts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  生成された投稿
                </CardTitle>
                <CardDescription>
                  投稿内容を確認・編集できます
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {generatedPosts.map((post) => (
                    <Card key={post.id} className={post.edited ? "border-orange-200" : ""}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span className="text-sm font-medium">{formatScheduledTime(post.scheduled_for)}</span>
                          </div>
                          {post.edited && (
                            <Badge variant="outline" className="text-orange-600 border-orange-200">
                              編集済み
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Textarea
                          value={post.content}
                          onChange={(e) => updatePost(post.id, e.target.value)}
                          rows={3}
                          className="resize-none"
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-between mt-6">
                  <Button onClick={() => setCurrentStep(1)} variant="outline">
                    設定に戻る
                  </Button>
                  <Button onClick={savePosts} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        投稿を保存
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CreatePosts;