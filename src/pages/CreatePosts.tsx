
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Sparkles, Loader2, Plus, Users, Bot, Image as ImageIcon, Upload, Download, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, addHours } from "date-fns";
import { ja } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];
type Post = Database['public']['Tables']['posts']['Row'];

const CreatePosts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [postCount, setPostCount] = useState(2);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<Post[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  
  // 画像生成関連の状態
  const [showImageGeneration, setShowImageGeneration] = useState(false);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string>("");
  const [generatingPrompts, setGeneratingPrompts] = useState<Set<number>>(new Set());
  const [generatedPrompts, setGeneratedPrompts] = useState<{[key: number]: string}>({});
  const [negativePrompts, setNegativePrompts] = useState<{[key: number]: string}>({});
  const [generatingImages, setGeneratingImages] = useState<Set<number>>(new Set());
  const [generatedImages, setGeneratedImages] = useState<{[key: number]: string}>({});
  const [promptError, setPromptError] = useState<{[key: number]: string}>({});
  
  // 画像生成設定
  const [cfg, setCfg] = useState([6]);
  const [ipAdapterScale, setIpAdapterScale] = useState([0.65]);
  const [steps, setSteps] = useState([20]);
  const [width, setWidth] = useState([512]);
  const [height, setHeight] = useState([768]);
  const [upscale, setUpscale] = useState(true);
  const [upscaleFactor, setUpscaleFactor] = useState([2]);

  useEffect(() => {
    if (user) {
      loadPersonas();
    }
  }, [user]);

  // ペルソナの画像をリファレンス画像として設定
  useEffect(() => {
    if (selectedPersona?.avatar_url && !referenceImage) {
      loadPersonaImage(selectedPersona.avatar_url);
    }
  }, [selectedPersona]);

  const loadPersonaImage = async (avatarUrl: string) => {
    try {
      const response = await fetch(avatarUrl);
      const blob = await response.blob();
      const file = new File([blob], 'persona-avatar.jpg', { type: blob.type });
      setReferenceImage(file);
      setReferenceImagePreview(avatarUrl);
    } catch (error) {
      console.error('Failed to load persona image:', error);
    }
  };

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
      
      // 最初のペルソナを自動選択
      if (data && data.length > 0) {
        setSelectedPersona(data[0]);
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

  const generatePosts = async () => {
    if (!selectedPersona) {
      toast({
        title: "エラー",
        description: "ペルソナを選択してください。",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-posts', {
        body: {
          personaId: selectedPersona.id,
          postCount: postCount
        }
      });

      if (error) {
        console.error('Function error:', error);
        throw new Error(`投稿生成に失敗しました: ${error.message}`);
      }

      if (data?.success && data?.posts) {
        console.log('Generated posts:', data.posts);
        setGeneratedPosts(data.posts);
        
        toast({
          title: "成功",
          description: `${data.posts.length}件の投稿を生成しました。`,
        });
      } else {
        throw new Error('投稿生成に失敗しました: 無効なレスポンス');
      }
    } catch (error) {
      console.error('Error generating posts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "エラー",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const scheduleAllPosts = () => {
    if (generatedPosts.length === 0) {
      toast({
        title: "エラー",
        description: "投稿が生成されていません。",
        variant: "destructive",
      });
      return;
    }

    navigate("/review-posts", { 
      state: { 
        posts: generatedPosts, 
        persona: selectedPersona 
      } 
    });
  };

  const handleReferenceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReferenceImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setReferenceImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateImagePrompt = async (postIndex: number) => {
    const post = generatedPosts[postIndex];
    if (!post) {
      console.error(`No post found at index ${postIndex}`);
      return;
    }

    console.log(`Starting prompt generation for post ${postIndex}:`, post.content);
    setGeneratingPrompts(prev => new Set(prev).add(postIndex));
    setPromptError(prev => ({ ...prev, [postIndex]: "" }));

    try {
      console.log('Calling generate-image-prompt function');
      const { data, error } = await supabase.functions.invoke('generate-image-prompt', {
        body: {
          postContent: post.content,
          persona: selectedPersona
        }
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Function error:', error);
        throw new Error(`Function error: ${error.message}`);
      }

      if (data?.success && data?.imagePrompt) {
        console.log(`Successfully generated prompt for post ${postIndex}:`, data.imagePrompt);
        setGeneratedPrompts(prev => ({
          ...prev,
          [postIndex]: data.imagePrompt
        }));
        
        toast({
          title: "成功",
          description: "画像生成プロンプトを生成しました。",
        });
      } else {
        console.error('Invalid response:', data);
        throw new Error('プロンプト生成に失敗しました: 無効なレスポンス');
      }
    } catch (error) {
      console.error(`Error generating prompt for post ${postIndex}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setPromptError(prev => ({ ...prev, [postIndex]: errorMessage }));
      
      toast({
        title: "エラー",
        description: `画像生成プロンプトの生成に失敗しました: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setGeneratingPrompts(prev => {
        const newSet = new Set(prev);
        newSet.delete(postIndex);
        return newSet;
      });
    }
  };

  const generateImage = async (postIndex: number) => {
    const prompt = generatedPrompts[postIndex];
    const negativePrompt = negativePrompts[postIndex] || "";
    
    if (!prompt) {
      toast({
        title: "エラー",
        description: "プロンプト生成が完了していません。",
        variant: "destructive",
      });
      return;
    }

    if (!referenceImage) {
      toast({
        title: "エラー",
        description: "リファレンス画像をアップロードしてください。",
        variant: "destructive",
      });
      return;
    }

    setGeneratingImages(prev => new Set(prev).add(postIndex));

    try {
      // HuggingFace Space URLの取得
      const { data: spaceUrlData, error: spaceUrlError } = await supabase.functions.invoke('retrieve-secret', {
        body: { secret_name: 'HUGGINGFACE_SPACE_URL' }
      });

      if (spaceUrlError || !spaceUrlData?.secret_value) {
        throw new Error('HuggingFace Space URLが設定されていません。設定画面で設定してください。');
      }

      const spaceUrl = spaceUrlData.secret_value;

      const { data, error } = await supabase.functions.invoke('generate-image-gradio', {
        body: {
          space_url: spaceUrl,
          face_image: referenceImage,
          subject: "portrait",
          add_prompt: prompt,
          add_neg: negativePrompt || "blurry, low quality, distorted",
          cfg: cfg[0],
          ip_scale: ipAdapterScale[0],
          steps: steps[0],
          w: width[0],
          h: height[0],
          upscale: upscale,
          up_factor: upscaleFactor[0]
        }
      });

      if (error) {
        console.error('Image generation error:', error);
        throw new Error(`画像生成に失敗しました: ${error.message}`);
      }

      if (!data || !data.image) {
        throw new Error('画像データが返されませんでした');
      }

      setGeneratedImages(prev => ({
        ...prev,
        [postIndex]: data.image
      }));

      toast({
        title: "生成完了",
        description: "画像が正常に生成されました。",
      });
    } catch (error) {
      console.error('Error generating image:', error);
      const errorMessage = error instanceof Error ? error.message : "画像生成に失敗しました。";
      toast({
        title: "エラー",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setGeneratingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(postIndex);
        return newSet;
      });
    }
  };

  const retryPromptGeneration = (postIndex: number) => {
    console.log(`Retrying prompt generation for post ${postIndex}`);
    generateImagePrompt(postIndex);
  };

  const downloadImage = (imageUrl: string, postIndex: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-image-${postIndex}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loadingPersonas) {
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

  if (personas.length === 0) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              戻る
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">投稿作成</h1>
              <p className="text-muted-foreground">AIで投稿を一括生成します</p>
            </div>
          </div>

          <Card>
            <CardContent className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">ペルソナが必要です</h2>
              <p className="text-muted-foreground mb-4">
                投稿を生成するには、まずペルソナを作成してください。
              </p>
              <Button onClick={() => navigate("/persona-setup")}>
                <Plus className="h-4 w-4 mr-2" />
                ペルソナを作成
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">投稿作成</h1>
            <p className="text-muted-foreground">AIで投稿を一括生成します</p>
          </div>
        </div>

        {!showImageGeneration ? (
          <>
            {/* ペルソナ選択 */}
            <Card>
              <CardHeader>
                <CardTitle>ペルソナ選択</CardTitle>
                <CardDescription>投稿を生成するペルソナを選択してください</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {personas.map((persona) => (
                    <Card 
                      key={persona.id} 
                      className={`cursor-pointer transition-all ${
                        selectedPersona?.id === persona.id 
                          ? 'ring-2 ring-primary shadow-md' 
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => setSelectedPersona(persona)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={persona.avatar_url || "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=150"} />
                            <AvatarFallback>{persona.name[0]?.toUpperCase() || "P"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-1">
                            <h3 className="font-semibold">{persona.name}</h3>
                            {persona.age && (
                              <p className="text-sm text-muted-foreground">{persona.age}</p>
                            )}
                            {persona.expertise && persona.expertise.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {persona.expertise.slice(0, 2).map((skill, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 投稿生成設定 */}
            <Card>
              <CardHeader>
                <CardTitle>投稿生成設定</CardTitle>
                <CardDescription>生成する投稿の設定を行います</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>生成する投稿数: {postCount}件</Label>
                  <Slider
                    value={[postCount]}
                    onValueChange={(value) => setPostCount(value[0])}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="flex gap-4">
                  <Button 
                    onClick={generatePosts}
                    disabled={generating || !selectedPersona}
                    className="flex-1"
                    size="lg"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        投稿を生成
                      </>
                    )}
                  </Button>

                  {generatedPosts.length > 0 && (
                    <Button 
                      onClick={() => setShowImageGeneration(true)}
                      variant="outline"
                      size="lg"
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      画像を生成
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 生成された投稿一覧 */}
            {generatedPosts.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>生成された投稿</CardTitle>
                    <CardDescription>
                      {generatedPosts.length}件の投稿が生成されました
                    </CardDescription>
                  </div>
                  <Button onClick={scheduleAllPosts}>
                    投稿を予約する
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {generatedPosts.map((post, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">投稿 {index + 1}</Badge>
                              <span className="text-sm text-muted-foreground">
                                予定: {format(new Date(post.scheduled_for!), 'M月d日 HH:mm', { locale: ja })}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <>
            {/* 画像生成設定 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>画像生成設定</span>
                  <Button variant="outline" onClick={() => setShowImageGeneration(false)}>
                    投稿生成に戻る
                  </Button>
                </CardTitle>
                <CardDescription>リファレンス画像と生成パラメータを設定してください</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* リファレンス画像 */}
                <div className="space-y-2">
                  <Label>リファレンス画像（顔写真）</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleReferenceImageChange}
                      className="flex-1"
                    />
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {referenceImagePreview && (
                    <div className="mt-4">
                      <img
                        src={referenceImagePreview}
                        alt="Reference preview"
                        className="w-32 h-32 object-cover rounded-lg border"
                      />
                      <p className="text-sm text-green-600 mt-2">✓ リファレンス画像がアップロードされました</p>
                    </div>
                  )}
                </div>

                {/* 生成パラメータ */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>CFG Scale: {cfg[0]}</Label>
                    <Slider
                      value={cfg}
                      onValueChange={setCfg}
                      min={1}
                      max={20}
                      step={0.5}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>IP Adapter Scale: {ipAdapterScale[0]}</Label>
                    <Slider
                      value={ipAdapterScale}
                      onValueChange={setIpAdapterScale}
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Steps: {steps[0]}</Label>
                    <Slider
                      value={steps}
                      onValueChange={setSteps}
                      min={1}
                      max={50}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>幅: {width[0]}px</Label>
                    <Slider
                      value={width}
                      onValueChange={setWidth}
                      min={256}
                      max={1024}
                      step={64}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>高さ: {height[0]}px</Label>
                    <Slider
                      value={height}
                      onValueChange={setHeight}
                      min={256}
                      max={1024}
                      step={64}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>アップスケール倍率: {upscaleFactor[0]}x</Label>
                    <Slider
                      value={upscaleFactor}
                      onValueChange={setUpscaleFactor}
                      min={1}
                      max={4}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="upscale"
                    checked={upscale}
                    onCheckedChange={(checked) => setUpscale(checked === true)}
                  />
                  <Label htmlFor="upscale">アップスケールを有効にする</Label>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <div className="text-blue-500 mt-0.5">ℹ️</div>
                    <div className="text-sm text-blue-700">
                      <strong>HuggingFace Spaces + Gemini APIを使用</strong><br />
                      投稿内容をGemini APIが解析し、画像生成プロンプトを自動生成します。リファレンス画像をアップロードすると、その人物の顔で画像が生成されます。
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 投稿別画像生成 */}
            <div className="space-y-4">
              {generatedPosts.map((post, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">投稿予定: {format(new Date(post.scheduled_for!), 'M月d日 HH:mm', { locale: ja })}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">投稿内容:</p>
                      <p className="text-sm bg-muted p-3 rounded">
                        {post.content}
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">画像プロンプト</p>
                        {promptError[index] && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => retryPromptGeneration(index)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            再試行
                          </Button>
                        )}
                      </div>
                      {generatingPrompts.has(index) ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin mr-2" />
                          <span>プロンプト生成中...</span>
                        </div>
                      ) : promptError[index] ? (
                        <div className="text-sm text-red-600 p-3 bg-red-50 rounded border-l-4 border-red-400">
                          エラー: {promptError[index]}
                        </div>
                      ) : generatedPrompts[index] ? (
                        <p className="text-sm bg-primary/5 p-3 rounded border-l-4 border-primary">
                          {generatedPrompts[index]}
                        </p>
                      ) : (
                        <div className="text-sm text-muted-foreground p-3 bg-muted rounded">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateImagePrompt(index)}
                          >
                            プロンプトを生成
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>ネガティブプロンプト（任意）</Label>
                      <Textarea
                        value={negativePrompts[index] || ""}
                        onChange={(e) => setNegativePrompts(prev => ({
                          ...prev,
                          [index]: e.target.value
                        }))}
                        placeholder="例: blurry, low quality, distorted"
                        rows={2}
                      />
                    </div>

                    {generatedImages[index] && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium">生成された画像:</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadImage(generatedImages[index], index)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            ダウンロード
                          </Button>
                        </div>
                        <img
                          src={generatedImages[index]}
                          alt="Generated"
                          className="w-full max-w-md h-auto rounded-lg shadow-lg"
                        />
                      </div>
                    )}

                    <Button
                      onClick={() => generateImage(index)}
                      disabled={generatingImages.has(index) || generatingPrompts.has(index) || !referenceImage || !generatedPrompts[index]}
                      className="w-full"
                      size="lg"
                    >
                      {generatingImages.has(index) ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          画像生成中...
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-4 w-4 mr-2" />
                          画像を生成
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CreatePosts;
