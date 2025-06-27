import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Trash2, Calendar, Clock, Image as ImageIcon, Loader2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];
type Post = Database['public']['Tables']['posts']['Row'];

interface ReviewPostsState {
  posts: Post[];
  persona: Persona;
}

const ReviewPosts = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  useEffect(() => {
    const state = location.state as ReviewPostsState;
    if (state) {
      setPosts(state.posts);
      setPersona(state.persona);
    } else {
      navigate("/create-posts");
    }
  }, [location.state, navigate]);

  const updatePost = (index: number, content: string) => {
    const updatedPosts = [...posts];
    updatedPosts[index] = { ...updatedPosts[index], content };
    setPosts(updatedPosts);
  };

  const deletePost = (index: number) => {
    setPosts(posts.filter((_, i) => i !== index));
  };

  const scheduleAllPosts = async () => {
    if (posts.length === 0 || !persona) return;

    setIsScheduling(true);
    try {
      const postsToUpdate = posts.map(post => ({
        id: post.id,
        content: post.content,
        status: 'scheduled' as const
      }));

      for (const post of postsToUpdate) {
        const { error } = await supabase
          .from('posts')
          .update({ 
            content: post.content,
            status: post.status 
          })
          .eq('id', post.id);

        if (error) throw error;
      }

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user!.id,
          persona_id: persona.id,
          action_type: 'posts_scheduled',
          description: `${posts.length}件の投稿を予約しました`
        });

      toast({
        title: "成功",
        description: `${posts.length}件の投稿を予約しました。`,
      });

      navigate("/scheduled-posts");
    } catch (error) {
      console.error('Error scheduling posts:', error);
      toast({
        title: "エラー",
        description: "投稿の予約に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsScheduling(false);
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/create-posts")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">生成投稿確認</h1>
            <p className="text-muted-foreground">生成された投稿を確認・修正してください</p>
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
              生成された投稿: {posts.length}件
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 投稿一覧 */}
        <div className="space-y-4">
          {posts.map((post, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">投稿 {index + 1}</CardTitle>
                  <div className="flex items-center gap-2">
                    {post.scheduled_for && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(post.scheduled_for), 'MM/dd', { locale: ja })}
                        <Clock className="h-3 w-3 ml-1" />
                        {format(new Date(post.scheduled_for), 'HH:mm', { locale: ja })}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deletePost(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={post.content}
                  onChange={(e) => updatePost(index, e.target.value)}
                  rows={4}
                  placeholder="投稿内容を編集..."
                />
                
                {/* 画像プレビュー */}
                {post.images && post.images.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">添付画像:</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {post.images.map((imageUrl, imageIndex) => (
                        <div key={imageIndex} className="relative">
                          <img
                            src={imageUrl}
                            alt={`投稿画像 ${imageIndex + 1}`}
                            className="w-full max-w-md mx-auto rounded-lg border object-cover"
                            style={{ maxHeight: '300px' }}
                            onError={(e) => {
                              console.error('Failed to load image:', imageUrl);
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* アクションボタン - 画像生成ボタンを削除 */}
        <div className="flex gap-4">
          <Button 
            onClick={scheduleAllPosts} 
            disabled={isScheduling || posts.length === 0}
            className="flex-1"
            size="lg"
          >
            {isScheduling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                予約中...
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4 mr-2" />
                投稿を予約する
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReviewPosts;
