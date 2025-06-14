import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, ArrowLeft, Clock, Edit, Trash2, Play, Pause, Image, Hash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const ScheduledPosts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [scheduledPosts] = useState([
    {
      id: 1,
      date: "2024-06-15",
      time: "09:00",
      content: "おはよう！今日も素敵な一日を始めましょう✨ 朝のコーヒーを飲みながら、新しいテクノロジーのニュースをチェック中です。",
      hashtags: ["#朝活", "#テクノロジー", "#AI"],
      status: "scheduled",
      image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300"
    },
    {
      id: 2,
      date: "2024-06-15",
      time: "12:00",
      content: "ランチタイム🍽️ 今日はヘルシーなサラダボウルを作ってみました。バランスの良い食事は心と体の健康に大切ですよね。",
      hashtags: ["#ランチ", "#ヘルシー", "#ライフスタイル"],
      status: "scheduled",
      image: "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=300"
    },
    {
      id: 3,
      date: "2024-06-15",
      time: "18:00",
      content: "夕方の振り返りタイム📝 今日学んだことや感じたことを整理しています。継続的な学習って本当に大切ですね！",
      hashtags: ["#振り返り", "#学習", "#成長"],
      status: "paused",
      image: "https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?w=300"
    }
  ]);

  const [completedPosts] = useState([
    {
      id: 4,
      date: "2024-06-14",
      time: "15:00",
      content: "午後のひと時、新しいガジェットについて調べています🔍 テクノロジーの進歩って本当に早いですね！",
      hashtags: ["#ガジェット", "#テクノロジー"],
      status: "completed",
      likes: 42,
      comments: 8,
      shares: 3
    }
  ]);

  const handleEditPost = (postId: number) => {
    toast({
      title: "編集画面に移動",
      description: "投稿の編集を開始します。",
    });
  };

  const handleDeletePost = (postId: number) => {
    toast({
      title: "投稿を削除しました",
      description: "スケジュールから投稿を削除しました。",
      variant: "destructive",
    });
  };

  const handlePausePost = (postId: number) => {
    toast({
      title: "投稿を一時停止しました",
      description: "投稿のスケジュールを一時停止しました。",
    });
  };

  const handleResumePost = (postId: number) => {
    toast({
      title: "投稿を再開しました",
      description: "投稿のスケジュールを再開しました。",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge className="bg-blue-100 text-blue-800">予約済み</Badge>;
      case "paused":
        return <Badge className="bg-yellow-100 text-yellow-800">一時停止</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800">投稿済み</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

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
              <div className="text-2xl font-bold">24</div>
              <p className="text-xs text-muted-foreground">今後7日間</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日の投稿</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">6</div>
              <p className="text-xs text-muted-foreground">残り3件</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">一時停止中</CardTitle>
              <Pause className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2</div>
              <p className="text-xs text-muted-foreground">確認が必要</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="scheduled" className="space-y-6">
          <TabsList>
            <TabsTrigger value="scheduled">予約済み</TabsTrigger>
            <TabsTrigger value="completed">投稿済み</TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled" className="space-y-4">
            {scheduledPosts.map((post) => (
              <Card key={post.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{post.date}</span>
                        <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                        <span className="text-sm font-medium">{post.time}</span>
                      </div>
                      {getStatusBadge(post.status)}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleEditPost(post.id)} variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      {post.status === "scheduled" ? (
                        <Button onClick={() => handlePausePost(post.id)} variant="outline" size="sm">
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button onClick={() => handleResumePost(post.id)} variant="outline" size="sm">
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button onClick={() => handleDeletePost(post.id)} variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    {post.image && (
                      <div className="flex-shrink-0">
                        <img 
                          src={post.image} 
                          alt="投稿画像" 
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <p className="text-sm">{post.content}</p>
                      <div className="flex flex-wrap gap-2">
                        {post.hashtags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-blue-600">
                            <Hash className="h-3 w-3 mr-1" />
                            {tag.replace('#', '')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedPosts.map((post) => (
              <Card key={post.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{post.date}</span>
                        <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                        <span className="text-sm font-medium">{post.time}</span>
                      </div>
                      {getStatusBadge(post.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>❤️ {post.likes}</span>
                      <span>💬 {post.comments}</span>
                      <span>🔄 {post.shares}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm">{post.content}</p>
                    <div className="flex flex-wrap gap-2">
                      {post.hashtags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-blue-600">
                          <Hash className="h-3 w-3 mr-1" />
                          {tag.replace('#', '')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ScheduledPosts;