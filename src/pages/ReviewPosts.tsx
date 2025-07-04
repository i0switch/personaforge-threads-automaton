
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('=== ReviewPosts useEffect START ===');
    console.log('Location:', location);
    console.log('Location pathname:', location.pathname);
    console.log('Location state:', location.state);
    console.log('User:', user);
    
    try {
      const state = location.state as ReviewPostsState;
      console.log('Parsed state:', state);
      
      if (state && state.posts && state.persona) {
        console.log('Valid state received');
        console.log('Posts count:', state.posts.length);
        console.log('Posts data:', state.posts);
        console.log('Persona name:', state.persona.name);
        console.log('Persona data:', state.persona);
        
        setPosts(state.posts);
        setPersona(state.persona);
        setError(null);
        console.log('State set successfully');
      } else {
        console.error('Invalid state received');
        console.error('State exists:', !!state);
        console.error('Posts exists:', !!state?.posts);
        console.error('Persona exists:', !!state?.persona);
        
        const errorMsg = '投稿データの読み込みに失敗しました。';
        setError(errorMsg);
        toast({
          title: "エラー",
          description: errorMsg,
          variant: "destructive",
        });
        
        setTimeout(() => {
          console.log('Navigating back to create-posts');
          navigate("/create-posts");
        }, 2000);
      }
    } catch (err) {
      console.error('Error in useEffect:', err);
      setError('データの処理中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
      console.log('=== ReviewPosts useEffect END ===');
    }
  }, [location.state, navigate, toast, user]);

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
      console.log('Starting to schedule posts...');
      
      const postsToUpdate = posts.map(post => ({
        id: post.id,
        content: post.content,
        status: 'scheduled' as const
      }));

      // 投稿をスケジュール状態に更新
      for (const post of postsToUpdate) {
        console.log(`Updating post ${post.id} to scheduled status`);
        
        const { error } = await supabase
          .from('posts')
          .update({ 
            content: post.content,
            status: post.status 
          })
          .eq('id', post.id);

        if (error) {
          console.error(`Error updating post ${post.id}:`, error);
          throw error;
        }

        // キューに追加（重複チェック付き）
        console.log(`Adding post ${post.id} to queue`);
        
        // 既存のキューアイテムをチェック
        const { data: existingQueue, error: queueCheckError } = await supabase
          .from('post_queue')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', user!.id);

        if (queueCheckError) {
          console.error('Error checking existing queue:', queueCheckError);
        }

        // 既存のキューアイテムがない場合のみ追加
        if (!existingQueue || existingQueue.length === 0) {
          const originalPost = posts.find(p => p.id === post.id);
          const scheduledFor = originalPost?.scheduled_for || new Date().toISOString();
          
          const { error: queueError } = await supabase
            .from('post_queue')
            .insert({
              user_id: user!.id,
              post_id: post.id,
              scheduled_for: scheduledFor,
              queue_position: postsToUpdate.indexOf(post),
              status: 'queued'
            });

          if (queueError) {
            console.error(`Error adding post ${post.id} to queue:`, queueError);
            throw queueError;
          }
          
          console.log(`Post ${post.id} added to queue successfully`);
        } else {
          console.log(`Post ${post.id} already in queue, skipping`);
        }
      }

      // アクティビティログを記録
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user!.id,
          persona_id: persona.id,
          action_type: 'posts_scheduled',
          description: `${posts.length}件の投稿を予約しました`
        });

      console.log('All posts scheduled successfully');
      
      toast({
        title: "成功",
        description: `${posts.length}件の投稿を予約しました。自動投稿が開始されます。`,
      });

      // ダッシュボードに移動
      navigate("/");
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

  console.log('=== ReviewPosts render ===');
  console.log('isLoading:', isLoading);
  console.log('error:', error);
  console.log('persona:', persona);
  console.log('posts length:', posts.length);

  if (isLoading) {
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

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={() => navigate("/create-posts")}>
                投稿作成に戻る
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!persona || posts.length === 0) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-gray-600 mb-4">投稿データがありません</p>
              <Button onClick={() => navigate("/create-posts")}>
                投稿作成に戻る
              </Button>
            </div>
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

        {/* アクションボタン */}
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
