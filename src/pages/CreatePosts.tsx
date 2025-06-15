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
import { ArrowLeft, Bot, Calendar, Hash, Image, Settings, Wand2, Loader2, Save, Users, Download, RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const editPostId = searchParams.get('edit');
  
  const [currentStep, setCurrentStep] = useState(editPostId ? 2 : 1);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  
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
  
  // Image generation states
  const [generatedImages, setGeneratedImages] = useState<{[key: string]: string}>({});
  const [imagePrompts, setImagePrompts] = useState<{[key: string]: string}>({});
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [ngrokUrl, setNgrokUrl] = useState<string>("");
  const [referenceImage, setReferenceImage] = useState<string>("");
  const [ipAdapterScale, setIpAdapterScale] = useState<number>(0.8);
  const [controlWeight, setControlWeight] = useState<number>(0.8);

  useEffect(() => {
    loadPersonas();
    if (editPostId) {
      loadPostForEdit(editPostId);
    }
  }, [user, editPostId]);

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
      
      // Auto-select first persona if available (only if not editing)
      if (data && data.length > 0 && !editPostId) {
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

  const loadPostForEdit = async (postId: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        // Set up the form for editing
        setSelectedPersona(data.persona_id || "");
        setGeneratedPosts([{
          id: data.id,
          content: data.content,
          hashtags: data.hashtags || [],
          scheduled_for: data.scheduled_for || new Date().toISOString(),
          edited: false
        }]);
      }
    } catch (error) {
      console.error('Error loading post for edit:', error);
      toast({
        title: "エラー",
        description: "投稿の読み込みに失敗しました。",
        variant: "destructive",
      });
      navigate('/scheduled-posts');
    } finally {
      setLoading(false);
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
      if (editPostId && generatedPosts.length === 1) {
        // Update existing post
        const post = generatedPosts[0];
        const { error } = await supabase
          .from('posts')
          .update({
            content: post.content,
            hashtags: [],
            scheduled_for: post.scheduled_for,
            persona_id: selectedPersona,
          })
          .eq('id', editPostId)
          .eq('user_id', user?.id);

        if (error) throw error;

        toast({
          title: "投稿を更新しました",
          description: "投稿の変更が保存されました。",
        });
        
        navigate('/scheduled-posts');
      } else {
        // Create new posts
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
        
        setCurrentStep(3);
      }
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

  const updatePostSchedule = (id: string, scheduled_for: string) => {
    setGeneratedPosts(prev => 
      prev.map(post => 
        post.id === id 
          ? { ...post, scheduled_for, edited: true }
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

  // Image generation functions
  const generateImagePrompt = (postContent: string) => {
    // Extract key themes from post content to generate image prompt
    const words = postContent.toLowerCase();
    let prompt = "";
    
    if (words.includes('コーヒー') || words.includes('カフェ')) {
      prompt = "a beautiful coffee cup, warm lighting, aesthetic cafe scene";
    } else if (words.includes('本') || words.includes('読書')) {
      prompt = "beautiful books, cozy reading scene, warm lighting";
    } else if (words.includes('仕事') || words.includes('オフィス')) {
      prompt = "modern workspace, laptop, clean desk, professional setting";
    } else if (words.includes('旅行') || words.includes('旅')) {
      prompt = "beautiful travel scene, scenic view, wanderlust";
    } else if (words.includes('料理') || words.includes('食事')) {
      prompt = "beautiful food photography, delicious meal, aesthetic presentation";
    } else if (words.includes('夕日') || words.includes('夕焼け')) {
      prompt = "beautiful sunset, golden hour, peaceful scenery";
    } else if (words.includes('海') || words.includes('ビーチ')) {
      prompt = "beautiful ocean view, peaceful beach scene, blue water";
    } else {
      prompt = "aesthetic minimalist scene, soft lighting, peaceful atmosphere";
    }
    
    return prompt + ", high quality, professional photography, beautiful composition";
  };

  const generateImage = async (postId: string, prompt?: string) => {
    const post = generatedPosts.find(p => p.id === postId);
    if (!post) return;

    if (!ngrokUrl.trim()) {
      toast({
        title: "エラー",
        description: "ngrokのURLを入力してください。",
        variant: "destructive",
      });
      return;
    }

    const imagePrompt = prompt || imagePrompts[postId] || generateImagePrompt(post.content);
    
    setGeneratingImage(postId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image-stable-diffusion', {
        body: {
          prompt: imagePrompt,
          negative_prompt: "cartoon, painting, illustration, (worst quality, low quality, normal quality:1.8), ugly, deformed",
          steps: 30,
          guidance_scale: 5,
          api_url: ngrokUrl.trim(),
          ...(referenceImage && { reference_image: referenceImage }),
          ip_adapter_scale: ipAdapterScale,
          control_weight: controlWeight
        }
      });

      if (error) throw error;

      if (data.success && data.image) {
        setGeneratedImages(prev => ({ ...prev, [postId]: data.image }));
        setImagePrompts(prev => ({ ...prev, [postId]: imagePrompt }));
        
        toast({
          title: "画像生成完了！",
          description: "投稿用の画像を生成しました。",
        });
      } else {
        throw new Error(data.details || 'Image generation failed');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "エラー",
        description: `画像の生成に失敗しました。${error.message}`,
        variant: "destructive",
      });
    } finally {
      setGeneratingImage(null);
    }
  };

  const downloadImage = (imageDataUrl: string, postId: string) => {
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = `post-image-${postId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReferenceImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        // Remove data:image/...;base64, prefix to get just the base64 string
        const base64Data = base64.split(',')[1];
        setReferenceImage(base64Data);
      };
      reader.readAsDataURL(file);
    }
  };

  // Initialize image prompts when posts are generated
  useEffect(() => {
    if (generatedPosts.length > 0 && currentStep === 3) {
      const newPrompts: {[key: string]: string} = {};
      generatedPosts.forEach(post => {
        if (!imagePrompts[post.id]) {
          newPrompts[post.id] = generateImagePrompt(post.content);
        }
      });
      if (Object.keys(newPrompts).length > 0) {
        setImagePrompts(prev => ({ ...prev, ...newPrompts }));
      }
    }
  }, [generatedPosts, currentStep]);

  if (loading && editPostId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">投稿データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate(editPostId ? "/scheduled-posts" : "/")} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {editPostId ? "投稿編集" : "投稿作成"}
            </h1>
            <p className="text-muted-foreground">
              {editPostId ? "投稿内容を編集・更新します" : "AIで投稿を一括生成・編集します"}
            </p>
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

        <Tabs value={currentStep === 1 ? "settings" : currentStep === 2 ? "posts" : "images"} className="space-y-6">
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
                  {editPostId ? "投稿編集" : "生成された投稿"}
                </CardTitle>
                <CardDescription>
                  {editPostId ? "投稿内容とスケジュールを編集できます" : "投稿内容を確認・編集できます"}
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
                            <Input
                              type="datetime-local"
                              value={new Date(post.scheduled_for).toISOString().slice(0, 16)}
                              onChange={(e) => updatePostSchedule(post.id, new Date(e.target.value).toISOString())}
                              className="w-auto text-sm"
                            />
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
                  {!editPostId && (
                    <Button onClick={() => setCurrentStep(1)} variant="outline">
                      設定に戻る
                    </Button>
                  )}
                  <Button onClick={savePosts} disabled={saving} className={editPostId ? "ml-auto" : ""}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {editPostId ? "更新中..." : "保存中..."}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {editPostId ? "投稿を更新" : "投稿を保存"}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="images" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  画像生成
                </CardTitle>
                <CardDescription>
                  投稿内容に基づいて、AIが画像を自動生成します
                </CardDescription>
              </CardHeader>
              <CardContent>
                {generatedPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <Image className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">投稿を先に生成してください</h3>
                    <p className="text-muted-foreground mb-6">
                      画像を生成するには、まず投稿内容を作成する必要があります。
                    </p>
                    <Button onClick={() => setCurrentStep(1)} variant="outline">
                      投稿作成に戻る
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Google Colab ngrok URL Input */}
                    <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                          <Image className="h-5 w-5" />
                          Google Colab セットアップ
                        </CardTitle>
                        <CardDescription className="text-green-700 dark:text-green-300">
                          Google ColabのStable Diffusion notebookを実行し、生成されたngrok URLを入力してください
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="ngrokUrl">ngrok URL</Label>
                          <Input
                            id="ngrokUrl"
                            value={ngrokUrl}
                            onChange={(e) => setNgrokUrl(e.target.value)}
                            placeholder="例: https://a9b0-34-16-133-110.ngrok-free.app"
                            className="bg-white dark:bg-gray-900"
                          />
                          <p className="text-sm text-green-700 dark:text-green-300">
                            「NgrokTunnel: "https://..." -&gt; "http://localhost:5000"」の部分をコピーして貼り付けてください
                          </p>
                        </div>
                        
                        <div className="text-sm text-green-700 dark:text-green-300 space-y-2">
                          <p className="font-medium">Google Colab実行手順:</p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>提供されたGoogle Colab notebookを開く</li>
                            <li>ngrok Auth Tokenを設定する</li>
                            <li>セルを実行してAPIサーバーを起動</li>
                            <li>表示されたngrok URLをこちらに入力</li>
                          </ol>
                        </div>
                      </CardContent>
                    </Card>

                    {/* InstantID Settings */}
                    <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-purple-800 dark:text-purple-200">
                          <Users className="h-5 w-5" />
                          InstantID 設定
                        </CardTitle>
                        <CardDescription className="text-purple-700 dark:text-purple-300">
                          特定の人物の顔で画像を生成するためのリファレンス画像をアップロードしてください
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="referenceImage">リファレンス画像</Label>
                          <Input
                            id="referenceImage"
                            type="file"
                            accept="image/*"
                            onChange={handleReferenceImageUpload}
                            className="bg-white dark:bg-gray-900"
                          />
                          <p className="text-sm text-purple-700 dark:text-purple-300">
                            JPG、PNG形式の人物画像をアップロードしてください
                          </p>
                          {referenceImage && (
                            <div className="mt-2 p-2 bg-purple-100 dark:bg-purple-900 rounded">
                              <p className="text-sm text-purple-800 dark:text-purple-200">
                                ✓ リファレンス画像がアップロードされました
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="ipAdapterScale">IP Adapter Scale</Label>
                            <Input
                              id="ipAdapterScale"
                              type="number"
                              step="0.1"
                              min="0"
                              max="1"
                              value={ipAdapterScale}
                              onChange={(e) => setIpAdapterScale(parseFloat(e.target.value))}
                              className="bg-white dark:bg-gray-900"
                            />
                            <p className="text-xs text-purple-700 dark:text-purple-300">
                              デフォルト: 0.8
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="controlWeight">Control Weight</Label>
                            <Input
                              id="controlWeight"
                              type="number"
                              step="0.1"
                              min="0"
                              max="1"
                              value={controlWeight}
                              onChange={(e) => setControlWeight(parseFloat(e.target.value))}
                              className="bg-white dark:bg-gray-900"
                            />
                            <p className="text-xs text-purple-700 dark:text-purple-300">
                              デフォルト: 0.8
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <div className="text-blue-600 dark:text-blue-400">
                        <Image className="h-5 w-5" />
                      </div>
                      <div className="text-sm">
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          InstantID対応 Stable Diffusion APIを使用しています
                        </p>
                        <p className="text-blue-700 dark:text-blue-300">
                          投稿内容に基づいて自動的にプロンプトが生成されます。リファレンス画像をアップロードすると、その人物の顔で画像が生成されます。
                        </p>
                      </div>
                    </div>

                    {generatedPosts.map((post) => (
                      <Card key={post.id} className="overflow-hidden">
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {formatScheduledTime(post.scheduled_for)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {post.content}
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor={`prompt-${post.id}`}>画像プロンプト</Label>
                            <Textarea
                              id={`prompt-${post.id}`}
                              value={imagePrompts[post.id] || ""}
                              onChange={(e) => setImagePrompts(prev => ({ ...prev, [post.id]: e.target.value }))}
                              placeholder="画像生成のためのプロンプトを入力..."
                              rows={2}
                              className="resize-none"
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                              {generatedImages[post.id] ? (
                                <div className="space-y-3">
                                  <div className="relative group">
                                    <img 
                                      src={generatedImages[post.id]} 
                                      alt="Generated image"
                                      className="w-full h-64 object-cover rounded-lg border"
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                                      <Button
                                        onClick={() => downloadImage(generatedImages[post.id], post.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        size="sm"
                                        variant="secondary"
                                      >
                                        <Download className="h-4 w-4 mr-2" />
                                        ダウンロード
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => generateImage(post.id, imagePrompts[post.id])}
                                      disabled={generatingImage === post.id}
                                      variant="outline"
                                      size="sm"
                                    >
                                      {generatingImage === post.id ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          再生成中...
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="h-4 w-4 mr-2" />
                                          再生成
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      onClick={() => downloadImage(generatedImages[post.id], post.id)}
                                      size="sm"
                                      variant="outline"
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      ダウンロード
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="w-full h-64 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center">
                                    <div className="text-center">
                                      <Image className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                                      <p className="text-sm text-muted-foreground">
                                        画像を生成してください
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    onClick={() => generateImage(post.id, imagePrompts[post.id])}
                                    disabled={generatingImage === post.id}
                                    className="w-full"
                                  >
                                    {generatingImage === post.id ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        画像生成中...
                                      </>
                                    ) : (
                                      <>
                                        <Wand2 className="h-4 w-4 mr-2" />
                                        画像を生成
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    <div className="flex justify-center gap-4 pt-6">
                      <Button onClick={() => setCurrentStep(2)} variant="outline">
                        投稿編集に戻る
                      </Button>
                      <Button onClick={() => navigate('/scheduled-posts')} className="bg-primary text-primary-foreground">
                        予約投稿を確認
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CreatePosts;