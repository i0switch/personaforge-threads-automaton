
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Image as ImageIcon, Sparkles, Loader2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";
import { ImageGenerator } from "@/components/ImageGenerator";

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
            <p className="text-muted-foreground">投稿に適した自撮り画像生成プロンプトを作成・画像生成</p>
          </div>
        </div>

        {/* ペルソナ情報 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={persona.avatar_url || ""} />
                <AvatarFallback>{persona.name[0]}</AvatarFallback>
              </Avatar>
              {persona.name}
            </CardTitle>
            <CardDescription>
              {posts.length}件の投稿用画像プロンプトを生成・画像生成
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側：投稿別画像プロンプト生成 */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">投稿プロンプト</h2>
            {posts.map((post, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">投稿 {index + 1}</CardTitle>
                    <div className="flex items-center gap-2">
                      {post.scheduled_for && (
                        <Badge variant="outline">
                          {format(new Date(post.scheduled_for), 'MM/dd HH:mm', { locale: ja })}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">投稿内容:</h4>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                      {post.content}
                    </p>
                  </div>
                  
                  {generatedPrompts[index] && (
                    <div>
                      <h4 className="font-medium mb-2">生成された画像プロンプト:</h4>
                      <p className="text-sm bg-primary/5 p-3 rounded border-l-4 border-primary">
                        {generatedPrompts[index]}
                      </p>
                    </div>
                  )}

                  {generatingPrompts.has(index) && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>プロンプト生成中...</span>
                    </div>
                  )}

                  <Button
                    onClick={() => generateImagePrompt(index)}
                    disabled={generatingPrompts.has(index)}
                    variant={generatedPrompts[index] ? "outline" : "default"}
                    className="w-full"
                  >
                    {generatingPrompts.has(index) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        プロンプト生成中...
                      </>
                    ) : generatedPrompts[index] ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        プロンプトを再生成
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        画像プロンプト生成
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 右側：画像生成 */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">画像生成</h2>
            <ImageGenerator />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGeneration;
