import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Calendar, Clock, Send, Trash2, Edit, Loader2, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast } from "date-fns";
import { ja } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'] & {
  personas?: Pick<Database['public']['Tables']['personas']['Row'], 'name' | 'avatar_url' | 'threads_access_token'>;
};

const ScheduledPosts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingPost, setPublishingPost] = useState<string | null>(null);
  const [deletingPost, setDeletingPost] = useState<string | null>(null);

  useEffect(() => {
    loadScheduledPosts();
  }, [user]);

  const loadScheduledPosts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          personas!inner(name, avatar_url, threads_access_token)
        `)
        .eq('user_id', user.id)
        .in('status', ['scheduled', 'draft'])
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading scheduled posts:', error);
      toast({
        title: "エラー",
        description: "予約投稿の読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const publishPost = async (postId: string) => {
    setPublishingPost(postId);
    try {
      const { error } = await supabase.functions.invoke('threads-post', {
        body: {
          postId,
          userId: user!.id
        }
      });

      if (error) throw error;

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user!.id,
          persona_id: posts.find(p => p.id === postId)?.persona_id,
          action_type: 'post_published',
          description: '投稿をThreadsに公開しました'
        });

      toast({
        title: "成功",
        description: "投稿をThreadsに公開しました。",
      });
      
      loadScheduledPosts();
    } catch (error) {
      console.error('Error publishing post:', error);
      toast({
        title: "エラー",
        description: "投稿の公開に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setPublishingPost(null);
    }
  };

  const deletePost = async (postId: string) => {
    setDeletingPost(postId);
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user!.id);

      if (error) throw error;

      setPosts(prev => prev.filter(p => p.id !== postId));
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
    } finally {
      setDeletingPost(null);
    }
  };

  const getStatusBadge = (post: Post) => {
    if (post.status === 'published') {
      return <Badge variant="default">公開済み</Badge>;
    }
    if (post.status === 'scheduled') {
      if (post.scheduled_for && isPast(new Date(post.scheduled_for))) {
        return <Badge variant="destructive">期限切れ</Badge>;
      }
      return <Badge variant="secondary">予約済み</Badge>;
    }
    return <Badge variant="outline">下書き</Badge>;
  };

  const canPublish = (post: Post) => {
    return post.personas?.threads_access_token && post.status !== 'published';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
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
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">予約投稿管理</h1>
            <p className="text-muted-foreground">
              スケジュール確認・編集・公開
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              投稿一覧
            </CardTitle>
            <CardDescription>
              {posts.length > 0 
                ? `${posts.length}件の投稿があります`
                : "投稿がありません"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {posts.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">予約投稿はありません</p>
                <Button onClick={() => navigate("/create-posts")} variant="outline">
                  新規投稿を作成
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ペルソナ</TableHead>
                    <TableHead>内容</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>予約日時</TableHead>
                    <TableHead>作成日</TableHead>
                    <TableHead>アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={post.personas?.avatar_url || ""} />
                            <AvatarFallback>
                              {post.personas?.name?.[0] || "P"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {post.personas?.name || "不明"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="text-sm line-clamp-2">
                            {post.content.substring(0, 100)}
                            {post.content.length > 100 && "..."}
                          </p>
                          {post.hashtags && post.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {post.hashtags.slice(0, 3).map((hashtag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  #{hashtag}
                                </Badge>
                              ))}
                              {post.hashtags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{post.hashtags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(post)}
                      </TableCell>
                      <TableCell>
                        {post.scheduled_for ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-4 w-4" />
                            {format(new Date(post.scheduled_for), 'MM/dd HH:mm', { locale: ja })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">未設定</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(post.created_at), 'MM/dd', { locale: ja })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {canPublish(post) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => publishPost(post.id)}
                              disabled={publishingPost === post.id}
                            >
                              {publishingPost === post.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deletePost(post.id)}
                            disabled={deletingPost === post.id}
                          >
                            {deletingPost === post.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ScheduledPosts;
