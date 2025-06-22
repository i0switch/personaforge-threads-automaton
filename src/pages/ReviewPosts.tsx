
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Save, Send, Edit, Calendar, Clock, Trash2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'] & {
  personas?: Pick<Database['public']['Tables']['personas']['Row'], 'name' | 'avatar_url'>;
};

const ReviewPosts = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    loadGeneratedPosts();
  }, [user]);

  const loadGeneratedPosts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // 最新の下書き投稿を取得
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          personas!inner(name, avatar_url)
        `)
        .eq('user_id', user.id)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading generated posts:', error);
      toast({
        title: "エラー",
        description: "生成された投稿の読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (post: Post) => {
    setEditingPost(post.id);
    setEditContent(post.content);
  };

  const saveEdit = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: editContent })
        .eq('id', postId)
        .eq('user_id', user!.id);

      if (error) throw error;

      setPosts(posts.map(p => 
        p.id === postId ? { ...p, content: editContent } : p
      ));
      setEditingPost(null);
      setEditContent("");

      toast({
        title: "成功",
        description: "投稿内容を更新しました。",
      });
    } catch (error) {
      console.error('Error updating post:', error);
      toast({
        title: "エラー",
        description: "投稿の更新に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const deletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user!.id);

      if (error) throw error;

      setPosts(posts.filter(p => p.id !== postId));
      toast({
        title: "成功",
        description: "投稿を削除しました。",
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "エラー",
        description: "投稿の削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const scheduleAllPosts = async () => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ status: 'scheduled' })
        .eq('user_id', user!.id)
        .eq('status', 'draft')
        .in('id', posts.map(p => p.id));

      if (error) throw error;

      toast({
        title: "成功",
        description: `${posts.length}件の投稿をスケジュールしました。`,
      });

      navigate("/scheduled-posts");
    } catch (error) {
      console.error('Error scheduling posts:', error);
      toast({
        title: "エラー",
        description: "投稿のスケジュールに失敗しました。",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
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
          <div>
            <h1 className="text-3xl font-bold">投稿内容確認</h1>
            <p className="text-muted-foreground">
              生成された投稿を確認・編集してください
            </p>
          </div>
        </div>

        {posts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground mb-4">確認する投稿がありません</p>
              <Button onClick={() => navigate("/create-posts")} variant="outline">
                新規投稿を作成
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {posts.length}件の投稿が生成されました
              </p>
              <Button onClick={scheduleAllPosts} size="lg">
                <Send className="h-4 w-4 mr-2" />
                全ての投稿をスケジュール
              </Button>
            </div>

            <div className="space-y-4">
              {posts.map((post) => (
                <Card key={post.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={post.personas?.avatar_url || ""} />
                          <AvatarFallback>
                            {post.personas?.name?.[0] || "P"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{post.personas?.name || "不明"}</p>
                          {post.scheduled_for && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(post.scheduled_for), 'MM/dd', { locale: ja })}
                              <Clock className="h-3 w-3 ml-1" />
                              {format(new Date(post.scheduled_for), 'HH:mm', { locale: ja })}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(post)}
                          disabled={editingPost === post.id}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deletePost(post.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {editingPost === post.id ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={6}
                          className="resize-none"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(post.id)}>
                            <Save className="h-3 w-3 mr-1" />
                            保存
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingPost(null);
                              setEditContent("");
                            }}
                          >
                            キャンセル
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="whitespace-pre-wrap">{post.content}</p>
                        {post.hashtags && post.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {post.hashtags.map((hashtag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                #{hashtag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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

export default ReviewPosts;
