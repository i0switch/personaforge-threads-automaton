import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Hash, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Play, 
  Pause,
  Search,
  Filter,
  Loader2,
  TrendingUp,
  Send
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'];
type Persona = Database['public']['Tables']['personas']['Row'];

const ScheduledPosts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [personaFilter, setPersonaFilter] = useState<string>("all");
  
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load posts and personas in parallel
      const [postsResult, personasResult] = await Promise.all([
        supabase
          .from('posts')
          .select('*')
          .eq('user_id', user?.id)
          .order('scheduled_for', { ascending: true }),
        supabase
          .from('personas')
          .select('*')
          .eq('user_id', user?.id)
      ]);

      if (postsResult.error) throw postsResult.error;
      if (personasResult.error) throw personasResult.error;

      setPosts(postsResult.data || []);
      setPersonas(personasResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "エラー",
        description: "データの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setPosts(prev => prev.filter(p => p.id !== postId));
      toast({
        title: "投稿を削除しました",
        description: "選択した投稿をスケジュールから削除しました。",
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

  const updatePostStatus = async (postId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ status: newStatus })
        .eq('id', postId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, status: newStatus } : p
      ));
      
      const statusText = newStatus === 'paused' ? '一時停止' : '再開';
      toast({
        title: `投稿を${statusText}しました`,
        description: `投稿のスケジュールを${statusText}しました。`,
      });
    } catch (error) {
      console.error('Error updating post status:', error);
      toast({
        title: "エラー",
        description: "投稿の状態更新に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const [publishing, setPublishing] = useState<string | null>(null);

  const publishPost = async (postId: string) => {
    setPublishing(postId);
    try {
      const { data, error } = await supabase.functions.invoke('threads-post', {
        body: {
          postId,
          userId: user?.id
        }
      });

      if (error) throw error;

      toast({
        title: "投稿完了",
        description: "Threadsに投稿しました。",
      });
      
      await loadData();
    } catch (error) {
      console.error('Error publishing post:', error);
      toast({
        title: "エラー",
        description: "投稿の公開に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setPublishing(null);
    }
  };

  const getPersonaName = (personaId: string | null) => {
    if (!personaId) return "不明";
    const persona = personas.find(p => p.id === personaId);
    return persona?.name || "不明";
  };

  const getPersonaAvatar = (personaId: string | null) => {
    if (!personaId) return null;
    const persona = personas.find(p => p.id === personaId);
    return persona?.avatar_url || null;
  };

  const formatScheduledTime = (isoString: string | null) => {
    if (!isoString) return "未設定";
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge className="bg-blue-100 text-blue-800">予約済み</Badge>;
      case "paused":
        return <Badge className="bg-yellow-100 text-yellow-800">一時停止</Badge>;
      case "published":
        return <Badge className="bg-green-100 text-green-800">投稿済み</Badge>;
      case "draft":
        return <Badge className="bg-gray-100 text-gray-800">下書き</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Filter posts based on search and filters
  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (post.hashtags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || post.status === statusFilter;
    const matchesPersona = personaFilter === "all" || post.persona_id === personaFilter;
    
    return matchesSearch && matchesStatus && matchesPersona;
  });

  // Split posts by status for tabs
  const scheduledPosts = filteredPosts.filter(p => p.status === 'scheduled' || p.status === 'paused');
  const publishedPosts = filteredPosts.filter(p => p.status === 'published');
  const draftPosts = filteredPosts.filter(p => p.status === 'draft');

  // Stats calculations
  const totalScheduled = posts.filter(p => p.status === 'scheduled').length;
  const todayPosts = posts.filter(p => {
    if (!p.scheduled_for) return false;
    const postDate = new Date(p.scheduled_for);
    const today = new Date();
    return postDate.toDateString() === today.toDateString();
  }).length;
  const pausedPosts = posts.filter(p => p.status === 'paused').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate("/")} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">予約投稿管理</h1>
            <p className="text-muted-foreground">スケジュールされた投稿の確認・管理</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">予約済み投稿</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalScheduled}</div>
              <p className="text-xs text-muted-foreground">スケジュール済み</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日の投稿</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayPosts}</div>
              <p className="text-xs text-muted-foreground">本日予定</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">一時停止中</CardTitle>
              <Pause className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pausedPosts}</div>
              <p className="text-xs text-muted-foreground">確認が必要</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="投稿内容やハッシュタグで検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="ステータス" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべてのステータス</SelectItem>
                  <SelectItem value="scheduled">予約済み</SelectItem>
                  <SelectItem value="paused">一時停止</SelectItem>
                  <SelectItem value="published">投稿済み</SelectItem>
                  <SelectItem value="draft">下書き</SelectItem>
                </SelectContent>
              </Select>
              <Select value={personaFilter} onValueChange={setPersonaFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="ペルソナ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべてのペルソナ</SelectItem>
                  {personas.map((persona) => (
                    <SelectItem key={persona.id} value={persona.id}>
                      {persona.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="scheduled" className="space-y-6">
          <TabsList>
            <TabsTrigger value="scheduled">予約済み ({scheduledPosts.length})</TabsTrigger>
            <TabsTrigger value="published">投稿済み ({publishedPosts.length})</TabsTrigger>
            <TabsTrigger value="draft">下書き ({draftPosts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled" className="space-y-4">
            {scheduledPosts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">予約投稿がありません</h3>
                  <p className="text-muted-foreground mb-4">
                    新しい投稿を作成して、スケジュールを設定しましょう。
                  </p>
                  <Button onClick={() => navigate("/create-posts")}>
                    投稿を作成する
                  </Button>
                </CardContent>
              </Card>
            ) : (
              scheduledPosts.map((post) => (
                <Card key={post.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={getPersonaAvatar(post.persona_id) || ""} />
                            <AvatarFallback>
                              {getPersonaName(post.persona_id)[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="text-sm font-medium">{getPersonaName(post.persona_id)}</span>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatScheduledTime(post.scheduled_for)}</span>
                            </div>
                          </div>
                        </div>
                        {getStatusBadge(post.status)}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/create-posts?edit=${post.id}`)}>
                            <Edit className="h-4 w-4 mr-2" />
                            編集
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => updatePostStatus(
                              post.id, 
                              post.status === 'scheduled' ? 'paused' : 'scheduled'
                            )}
                          >
                            {post.status === 'scheduled' ? (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                一時停止
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                再開
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => publishPost(post.id)}
                            disabled={publishing === post.id}
                          >
                            {publishing === post.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                投稿中...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                今すぐ投稿
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => deletePost(post.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm">{post.content}</p>
                      {post.hashtags && post.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {post.hashtags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-blue-600">
                              <Hash className="h-3 w-3 mr-1" />
                              {tag.replace('#', '')}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {post.platform && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{post.platform}</Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="published" className="space-y-4">
            {publishedPosts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">投稿済みの投稿がありません</h3>
                  <p className="text-muted-foreground">
                    投稿が完了すると、ここに表示されます。
                  </p>
                </CardContent>
              </Card>
            ) : (
              publishedPosts.map((post) => (
                <Card key={post.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={getPersonaAvatar(post.persona_id) || ""} />
                            <AvatarFallback>
                              {getPersonaName(post.persona_id)[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="text-sm font-medium">{getPersonaName(post.persona_id)}</span>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatScheduledTime(post.published_at || post.scheduled_for)}</span>
                            </div>
                          </div>
                        </div>
                        {getStatusBadge(post.status)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm">{post.content}</p>
                      {post.hashtags && post.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {post.hashtags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-blue-600">
                              <Hash className="h-3 w-3 mr-1" />
                              {tag.replace('#', '')}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="draft" className="space-y-4">
            {draftPosts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Edit className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">下書きがありません</h3>
                  <p className="text-muted-foreground">
                    下書きの投稿がここに表示されます。
                  </p>
                </CardContent>
              </Card>
            ) : (
              draftPosts.map((post) => (
                <Card key={post.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={getPersonaAvatar(post.persona_id) || ""} />
                            <AvatarFallback>
                              {getPersonaName(post.persona_id)[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="text-sm font-medium">{getPersonaName(post.persona_id)}</span>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>下書き</span>
                            </div>
                          </div>
                        </div>
                        {getStatusBadge(post.status)}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => navigate(`/create-posts?edit=${post.id}`)}
                          variant="outline" 
                          size="sm"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          編集
                        </Button>
                        <Button 
                          onClick={() => deletePost(post.id)}
                          variant="outline" 
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm">{post.content}</p>
                      {post.hashtags && post.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {post.hashtags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-blue-600">
                              <Hash className="h-3 w-3 mr-1" />
                              {tag.replace('#', '')}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ScheduledPosts;