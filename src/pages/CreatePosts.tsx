import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Bot, Calendar, Hash, Image, Settings, Wand2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const CreatePosts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  
  const [settings, setSettings] = useState({
    postCount: 10,
    startTime: "09:00",
    endTime: "21:00",
    interval: 2,
    topics: ["テクノロジー", "ライフスタイル"]
  });

  const [generatedPosts, setGeneratedPosts] = useState([
    {
      id: 1,
      time: "09:00",
      content: "おはよう！今日も素敵な一日を始めましょう✨ 朝のコーヒーを飲みながら、新しいテクノロジーのニュースをチェック中です。AIの進歩って本当にすごいですね！",
      hashtags: ["#朝活", "#テクノロジー", "#AI"],
      edited: false
    },
    {
      id: 2,
      time: "12:00",
      content: "ランチタイム🍽️ 今日はヘルシーなサラダボウルを作ってみました。バランスの良い食事は心と体の健康に大切ですよね。皆さんはどんなランチを楽しんでいますか？",
      hashtags: ["#ランチ", "#ヘルシー", "#ライフスタイル"],
      edited: false
    }
  ]);

  const [newTopic, setNewTopic] = useState("");

  const handleGeneratePosts = () => {
    toast({
      title: "投稿を生成しています...",
      description: "GeminiAPIを使用して投稿を生成中です。",
    });
    
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "投稿生成完了！",
        description: `${settings.postCount}件の投稿を生成しました。`,
      });
      setCurrentStep(2);
    }, 2000);
  };

  const addTopic = () => {
    if (newTopic && !settings.topics.includes(newTopic)) {
      setSettings(prev => ({
        ...prev,
        topics: [...prev.topics, newTopic]
      }));
      setNewTopic("");
    }
  };

  const removeTopic = (topic: string) => {
    setSettings(prev => ({
      ...prev,
      topics: prev.topics.filter(t => t !== topic)
    }));
  };

  const updatePost = (id: number, content: string) => {
    setGeneratedPosts(prev => 
      prev.map(post => 
        post.id === id 
          ? { ...post, content, edited: true }
          : post
      )
    );
  };

  const proceedToImageGeneration = () => {
    navigate("/image-generation", { 
      state: { posts: generatedPosts } 
    });
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
            <h1 className="text-3xl font-bold text-foreground">投稿作成</h1>
            <p className="text-muted-foreground">AIで投稿を一括生成・編集します</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground text-background'}`}>
              1
            </div>
            <span className="text-sm font-medium">設定</span>
          </div>
          <div className="flex-1 h-px bg-muted-foreground"></div>
          <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground text-background'}`}>
              2
            </div>
            <span className="text-sm font-medium">生成・編集</span>
          </div>
          <div className="flex-1 h-px bg-muted-foreground"></div>
          <div className={`flex items-center gap-2 ${currentStep >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground text-background'}`}>
              3
            </div>
            <span className="text-sm font-medium">画像生成</span>
          </div>
        </div>

        <Tabs value={currentStep === 1 ? "settings" : "posts"} className="space-y-6">
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  投稿設定
                </CardTitle>
                <CardDescription>
                  生成する投稿の詳細設定を行います
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postCount">投稿数</Label>
                    <Input
                      id="postCount"
                      type="number"
                      value={settings.postCount}
                      onChange={(e) => setSettings(prev => ({ ...prev, postCount: parseInt(e.target.value) }))}
                      min="1"
                      max="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">開始時刻</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={settings.startTime}
                      onChange={(e) => setSettings(prev => ({ ...prev, startTime: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">終了時刻</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={settings.endTime}
                      onChange={(e) => setSettings(prev => ({ ...prev, endTime: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interval">間隔（時間）</Label>
                    <Input
                      id="interval"
                      type="number"
                      value={settings.interval}
                      onChange={(e) => setSettings(prev => ({ ...prev, interval: parseInt(e.target.value) }))}
                      min="1"
                      max="24"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>投稿トピック</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      placeholder="新しいトピックを追加"
                      onKeyPress={(e) => e.key === 'Enter' && addTopic()}
                    />
                    <Button onClick={addTopic} variant="outline" size="sm">
                      追加
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {settings.topics.map((topic, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => removeTopic(topic)}
                      >
                        {topic} ×
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleGeneratePosts} size="lg">
                    <Wand2 className="h-4 w-4 mr-2" />
                    投稿を生成
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="posts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  生成された投稿
                </CardTitle>
                <CardDescription>
                  投稿内容を確認・編集できます
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {generatedPosts.map((post) => (
                    <Card key={post.id} className={post.edited ? "border-orange-200" : ""}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span className="text-sm font-medium">{post.time}</span>
                          </div>
                          {post.edited && (
                            <Badge variant="outline" className="text-orange-600 border-orange-200">
                              編集済み
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Textarea
                          value={post.content}
                          onChange={(e) => updatePost(post.id, e.target.value)}
                          rows={3}
                          className="resize-none"
                        />
                        <div className="flex flex-wrap gap-2">
                          {post.hashtags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-blue-600">
                              <Hash className="h-3 w-3 mr-1" />
                              {tag.replace('#', '')}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-between mt-6">
                  <Button onClick={() => setCurrentStep(1)} variant="outline">
                    設定に戻る
                  </Button>
                  <Button onClick={proceedToImageGeneration}>
                    <Image className="h-4 w-4 mr-2" />
                    画像生成へ進む
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CreatePosts;