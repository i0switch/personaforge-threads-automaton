import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PostsTable } from "@/components/ScheduledPosts/PostsTable";
import { BulkActions } from "@/components/ScheduledPosts/BulkActions";
import { PostsToolbar, type PostFilters, type PostSort } from "@/components/ScheduledPosts/PostsToolbar";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'] & {
  personas?: {
    name: string;
    avatar_url: string | null;
    threads_access_token: string | null;
  };
};

const ScheduledPosts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingPost, setPublishingPost] = useState<string | null>(null);
  const [deletingPost, setDeletingPost] = useState<string | null>(null);
  const [savingPost, setSavingPost] = useState<string | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [testingScheduler, setTestingScheduler] = useState(false);
  
  // フィルタリングとソートの状態
  const [filters, setFilters] = useState<PostFilters>({
    search: '',
    personas: [],
    dateRange: {}
  });
  const [sort, setSort] = useState<PostSort>({
    field: 'created_at',
    direction: 'desc'
  });

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
          personas(name, avatar_url, threads_access_token)
        `)
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .or('auto_schedule.is.null,auto_schedule.eq.false') // 手動予約投稿のみ表示
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      setPosts(data || []);
      setSelectedPosts([]);
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

  // フィルタリングとソートを適用した投稿リスト
  const filteredAndSortedPosts = useMemo(() => {
    let filtered = posts;

    // 検索フィルター
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(post => 
        post.content.toLowerCase().includes(searchLower) ||
        post.hashtags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // ペルソナフィルター
    if (filters.personas.length > 0) {
      filtered = filtered.filter(post => 
        post.personas?.name && filters.personas.includes(post.personas.name)
      );
    }

    // ソート
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sort.field) {
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case 'scheduled_for':
          aValue = a.scheduled_for ? new Date(a.scheduled_for) : new Date(0);
          bValue = b.scheduled_for ? new Date(b.scheduled_for) : new Date(0);
          break;
        case 'content':
          aValue = a.content.toLowerCase();
          bValue = b.content.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [posts, filters, sort]);

  const editPost = async (postId: string, updates: Partial<Post>) => {
    setSavingPost(postId);
    try {
      const { error } = await supabase
        .from('posts')
        .update(updates)
        .eq('id', postId)
        .eq('user_id', user!.id);

      if (error) throw error;

      // ローカル状態を更新
      setPosts(prev => prev.map(post => 
        post.id === postId ? { ...post, ...updates } : post
      ));

      toast({
        title: "成功",
        description: "投稿を更新しました。",
      });
    } catch (error) {
      console.error('Error updating post:', error);
      toast({
        title: "エラー",
        description: "投稿の更新に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setSavingPost(null);
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

  const bulkDeletePosts = async () => {
    if (selectedPosts.length === 0) return;
    
    setBulkDeleting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('user_id', user!.id)
        .in('id', selectedPosts);

      if (error) throw error;

      setPosts(prev => prev.filter(p => !selectedPosts.includes(p.id)));
      setSelectedPosts([]);
      
      toast({
        title: "成功",
        description: `${selectedPosts.length}件の投稿を削除しました。`,
      });
    } catch (error) {
      console.error('Error bulk deleting posts:', error);
      toast({
        title: "エラー",
        description: "一括削除に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPosts(filteredAndSortedPosts.map(post => post.id));
    } else {
      setSelectedPosts([]);
    }
  };

  const handleSelectPost = (postId: string, checked: boolean) => {
    if (checked) {
      setSelectedPosts(prev => [...prev, postId]);
    } else {
      setSelectedPosts(prev => prev.filter(id => id !== postId));
    }
  };

  const testAutoScheduler = async () => {
    setTestingScheduler(true);
    try {
      console.log('Testing auto-scheduler...');
      
      // タイムアウト処理を追加
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('タイムアウト: 30秒以内にレスポンスがありませんでした')), 30000)
      );
      
      const schedulerPromise = supabase.functions.invoke('auto-scheduler');
      
      const result = await Promise.race([schedulerPromise, timeoutPromise]);
      const { data, error } = result as any;
      
      console.log('Auto-scheduler raw result:', { data, error });
      
      if (error) {
        console.error('Auto-scheduler error:', error);
        throw new Error(`エラー: ${error.message || JSON.stringify(error)}`);
      }
      
      console.log('Auto-scheduler success data:', data);
      
      const message = data?.message || `処理完了: ${data?.processed || 0}件処理`;
      
      toast({
        title: "テスト完了",
        description: message,
      });
      
      // 投稿リストを再読み込み
      await loadScheduledPosts();
    } catch (error: any) {
      console.error('Error testing auto-scheduler:', error);
      toast({
        title: "エラー",
        description: error.message || "自動スケジューラーのテストに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setTestingScheduler(false);
    }
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
          <div className="flex-1">
            <h1 className="text-3xl font-bold">予約投稿管理</h1>
            <p className="text-muted-foreground">
              スケジュール確認・編集・公開
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={testAutoScheduler}
            disabled={testingScheduler}
          >
            {testingScheduler ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                テスト中...
              </>
            ) : (
              "自動スケジューラーテスト"
            )}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  投稿一覧
                </CardTitle>
                <CardDescription>
                  {posts.length > 0 
                    ? `${posts.length}件中${filteredAndSortedPosts.length}件を表示`
                    : "投稿がありません"
                  }
                </CardDescription>
              </div>
              <BulkActions
                selectedPosts={selectedPosts}
                bulkDeleting={bulkDeleting}
                onBulkDelete={bulkDeletePosts}
              />
            </div>
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
              <div className="space-y-4">
                <PostsToolbar
                  posts={posts}
                  filters={filters}
                  sort={sort}
                  onFiltersChange={setFilters}
                  onSortChange={setSort}
                />
                <PostsTable
                  posts={filteredAndSortedPosts}
                  selectedPosts={selectedPosts}
                  publishingPost={publishingPost}
                  deletingPost={deletingPost}
                  savingPost={savingPost}
                  onSelectAll={handleSelectAll}
                  onSelectPost={handleSelectPost}
                  onPublishPost={publishPost}
                  onDeletePost={deletePost}
                  onEditPost={editPost}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ScheduledPosts;
