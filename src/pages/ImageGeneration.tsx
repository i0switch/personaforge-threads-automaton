
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Image as ImageIcon, Sparkles, Loader2, Upload } from "lucide-react";
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
  
  // InstantID設定
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string>("");
  const [ipAdapterScale, setIpAdapterScale] = useState([0.8]);
  const [controlWeight, setControlWeight] = useState([0.8]);

  useEffect(() => {
    const state = location.state as ImageGenerationState;
    if (state) {
      setPosts(state.posts);
      setPersona(state.persona);
      // 自動でプロンプト生成を開始
      state.posts.forEach((_, index) => {
        generateImagePrompt(index);
      });
    } else {
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
    if (!post) return;

    setGeneratingPrompts(prev => new Set(prev).add(postIndex));

    try {
      const { data, error } = await supabase.functions.invoke('generate-image-prompt', {
        body: {
          postContent: post.content,
          persona: persona
        }
      });

      if (error) throw error;

      if (data.success) {
        setGeneratedPrompts(prev => ({
          ...prev,
          [postIndex]: data.imagePrompt
        }));
        
        toast({
          title: "成功",
          description: "画像生成プロンプトを生成しました。",
        });
      } else {
        throw new Error('プロンプト生成に失敗しました');
      }
    } catch (error) {
      console.error('Error generating image prompt:', error);
      toast({
        title: "エラー",
        description: "画像生成プロンプトの生成に失敗しました。",
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
    if (!prompt) {
      toast({
        title: "エラー",
        description: "まずプロンプトを生成してください。",
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
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;

          const { data, error } = await supabase.functions.invoke('generate-image-huggingface', {
            body: {
              face_image_b64: base64,
              prompt: prompt,
              negative_prompt: "",
              guidance_scale: 6.0,
              ip_adapter_scale: ipAdapterScale[0],
              num_inference_steps: 20,
              width: 512,
              height: 768,
              upscale: true,
              upscale_factor: 2
            }
          });

          if (error) {
            console.error('Edge function error:', error);
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
          toast({
            title: "エラー",
            description: error.message || "画像生成に失敗しました。",
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
      reader.readAsDataURL(referenceImage);
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "エラー",
        description: "画像生成に失敗しました。",
        variant: "destructive",
      });
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
            <h1 className="text-3xl font-bold">InstantID 設定</h1>
            <p className="text-muted-foreground">特定の人物の顔で画像を生成するためのリファレンス画像をアップロードしてください。</p>
          </div>
        </div>

        {/* InstantID設定 */}
        <Card>
          <CardHeader>
            <CardTitle>リファレンス画像</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleReferenceImageChange}
                  className="flex-1"
                />
                <Upload className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">JPG, PNG形式の人物画像をアップロードしてください</p>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>IP Adapter Scale</Label>
                <div className="px-3">
                  <Slider
                    value={ipAdapterScale}
                    onValueChange={setIpAdapterScale}
                    min={0}
                    max={1.5}
                    step={0.05}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground mt-1">デフォルト: {ipAdapterScale[0]}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Control Weight</Label>
                <div className="px-3">
                  <Slider
                    value={controlWeight}
                    onValueChange={setControlWeight}
                    min={0}
                    max={1.5}
                    step={0.05}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground mt-1">デフォルト: {controlWeight[0]}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <div className="text-blue-500 mt-0.5">ℹ️</div>
                <div className="text-sm text-blue-700">
                  <strong>HuggingFace Spaces + Gemini APIを使用しています</strong><br />
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
                  <p className="text-sm font-medium mb-2">画像プロンプト</p>
                  {generatingPrompts.has(index) ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>プロンプト生成中...</span>
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
                  disabled={generatingImages.has(index) || !generatedPrompts[index] || !referenceImage}
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
