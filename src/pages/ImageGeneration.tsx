
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
import { ArrowLeft, Image as ImageIcon, Sparkles, Loader2, Upload, RefreshCw } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];
type Post = Database['public']['Tables']['posts']['Row'];

interface ImageGenerationState {
  posts: Post[];
  persona: Persona;
}

const ImageGeneration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [generatingPrompts, setGeneratingPrompts] = useState<Set<number>>(new Set());
  const [generatedPrompts, setGeneratedPrompts] = useState<{[key: number]: string}>({});
  const [generatingImages, setGeneratingImages] = useState<Set<number>>(new Set());
  const [generatedImages, setGeneratedImages] = useState<{[key: number]: string}>({});
  const [promptError, setPromptError] = useState<{[key: number]: string}>({});
  
  // 画像生成設定
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [additionalNegative, setAdditionalNegative] = useState("");
  const [cfg, setCfg] = useState([6]);
  const [ipAdapterScale, setIpAdapterScale] = useState([0.65]);
  const [steps, setSteps] = useState([20]);
  const [width, setWidth] = useState([512]);
  const [height, setHeight] = useState([768]);
  const [upscale, setUpscale] = useState(true);
  const [upscaleFactor, setUpscaleFactor] = useState([2]);

  useEffect(() => {
    const state = location.state as ImageGenerationState;
    if (state) {
      console.log('ImageGeneration: Received state with posts:', state.posts);
      console.log('ImageGeneration: Received persona:', state.persona);
      setPosts(state.posts);
      setPersona(state.persona);
      // 自動でプロンプト生成を開始
      state.posts.forEach((_, index) => {
        console.log(`ImageGeneration: Starting prompt generation for post ${index}`);
        generateImagePrompt(index);
      });
    } else {
      console.log('ImageGeneration: No state found, redirecting to create-posts');
      navigate("/create-posts");
    }
  }, [location.state, navigate]);

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
    const post = posts[postIndex];
    if (!post) {
      console.error(`ImageGeneration: No post found at index ${postIndex}`);
      return;
    }

    console.log(`ImageGeneration: Starting prompt generation for post ${postIndex}:`, post.content);
    setGeneratingPrompts(prev => new Set(prev).add(postIndex));
    setPromptError(prev => ({ ...prev, [postIndex]: "" }));

    try {
      console.log('ImageGeneration: Calling generate-image-prompt function');
      const { data, error } = await supabase.functions.invoke('generate-image-prompt', {
        body: {
          postContent: post.content,
          persona: persona
        }
      });

      console.log('ImageGeneration: Function response:', { data, error });

      if (error) {
        console.error('ImageGeneration: Function error:', error);
        throw new Error(`Function error: ${error.message}`);
      }

      if (data?.success && data?.imagePrompt) {
        console.log(`ImageGeneration: Successfully generated prompt for post ${postIndex}:`, data.imagePrompt);
        setGeneratedPrompts(prev => ({
          ...prev,
          [postIndex]: data.imagePrompt
        }));
        
        toast({
          title: "成功",
          description: "画像生成プロンプトを生成しました。",
        });
      } else {
        console.error('ImageGeneration: Invalid response:', data);
        throw new Error('プロンプト生成に失敗しました: 無効なレスポンス');
      }
    } catch (error) {
      console.error(`ImageGeneration: Error generating prompt for post ${postIndex}:`, error);
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

  const retryPromptGeneration = (postIndex: number) => {
    console.log(`ImageGeneration: Retrying prompt generation for post ${postIndex}`);
    generateImagePrompt(postIndex);
  };

  const generateImage = async (postIndex: number) => {
    const prompt = generatedPrompts[postIndex];
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
          subject: subject || "portrait",
          add_prompt: `${prompt}, ${additionalPrompt}`.trim(),
          add_neg: additionalNegative || "blurry, low quality, distorted",
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

  if (!persona) {
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
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">AI画像生成</h1>
            <p className="text-muted-foreground">投稿内容に合わせた画像を生成します</p>
          </div>
        </div>

        {/* 画像生成設定 */}
        <Card>
          <CardHeader>
            <CardTitle>画像生成設定</CardTitle>
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

            {/* 被写体説明と追加プロンプト */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>被写体説明</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="例: portrait, business person"
                />
              </div>
              <div className="space-y-2">
                <Label>追加プロンプト</Label>
                <Input
                  value={additionalPrompt}
                  onChange={(e) => setAdditionalPrompt(e.target.value)}
                  placeholder="追加の説明を入力"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>ネガティブプロンプト</Label>
              <Textarea
                value={additionalNegative}
                onChange={(e) => setAdditionalNegative(e.target.value)}
                placeholder="避けたい要素を入力"
                rows={2}
              />
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
                onCheckedChange={setUpscale}
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
          {posts.map((post, index) => (
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
                      プロンプトを生成中...
                    </div>
                  )}
                </div>

                {generatedImages[index] && (
                  <div>
                    <p className="text-sm font-medium mb-2">生成された画像:</p>
                    <img
                      src={generatedImages[index]}
                      alt="Generated"
                      className="w-full max-w-md h-auto rounded-lg shadow-lg"
                    />
                  </div>
                )}

                <Button
                  onClick={() => generateImage(index)}
                  disabled={generatingImages.has(index) || generatingPrompts.has(index) || !referenceImage}
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
      </div>
    </div>
  );
};

export default ImageGeneration;
