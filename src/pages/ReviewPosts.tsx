
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calendar as CalendarIcon, Clock, Send, Trash2, Edit, Loader2, Plus, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];

interface ReviewPostsState {
  posts: string[];
  persona: Persona;
  topic: string;
  customHashtags: string[];
}

const ReviewPosts = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [posts, setPosts] = useState<string[]>([]);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [topic, setTopic] = useState("");
  const [customHashtags, setCustomHashtags] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState("12:00");
  const [hashtagInput, setHashtagInput] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    const state = location.state as ReviewPostsState;
    if (state) {
      setPosts(state.posts);
      setPersona(state.persona);
      setTopic(state.topic);
      setCustomHashtags(state.customHashtags);
    } else {
      navigate("/create-posts");
    }
  }, [location.state, navigate]);

  const updatePost = (index: number, content: string) => {
    const updatedPosts = [...posts];
    updatedPosts[index] = content;
    setPosts(updatedPosts);
  };

  const deletePost = (index: number) => {
    setPosts(posts.filter((_, i) => i !== index));
  };

  const addHashtag = () => {
    if (hashtagInput.trim() && !customHashtags.includes(hashtagInput.trim())) {
      setCustomHashtags([...customHashtags, hashtagInput.trim()]);
      setHashtagInput("");
    }
  };

  const removeHashtag = (hashtag: string) => {
    setCustomHashtags(customHashtags.filter(h => h !== hashtag));
  };

  const savePosts = async (status: 'draft' | 'scheduled' = 'draft') => {
    if (posts.length === 0 || !persona) return;

    setIsPublishing(true);
    try {
      const scheduledFor = scheduledDate && status === 'scheduled' 
        ? new Date(`${format(scheduledDate, 'yyyy-MM-dd')} ${scheduledTime}:00`)
        : null;

      const postsToSave = posts.map(content => ({
        user_id: user!.id,
        persona_id: persona.id,
        content,
        hashtags: customHashtags,
        platform: 'threads',
        status,
        scheduled_for: scheduledFor?.toISOString()
      }));

      const { error } = await supabase
        .from('posts')
        .insert(postsToSave);

      if (error) throw error;

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user!.id,
          persona_id: persona.id,
          action_type: status === 'scheduled' ? 'posts_scheduled' : 'posts_created',
          description: `${posts.length}件の投稿を${status === 'scheduled' ? '予約' : '作成'}しました`,
          metadata: { postCount: posts.length, topic }
        });

      toast({
        title: "成功",
        description: `投稿を${status === 'scheduled' ? '予約' : '保存'}しました。`,
      });

      navigate("/scheduled-posts");
    } catch (error) {
      console.error('Error saving posts:', error);
      toast({
        title: "エラー",
        description: "投稿の保存に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
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
          <div>
            <h1 className="text-3xl font-bold">投稿確認・編集</h1>
            <p className="text-muted-foreground">生成された投稿を確認・編集してください</p>
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
              トピック: {topic}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 投稿編集 */}
        <Card>
          <CardHeader>
            <CardTitle>生成された投稿 ({posts.length}件)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {posts.map((post, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">投稿 {index + 1}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deletePost(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  value={post}
                  onChange={(e) => updatePost(index, e.target.value)}
                  rows={4}
                  placeholder="投稿内容を編集..."
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ハッシュタグ・スケジュール設定 */}
        <Card>
          <CardHeader>
            <CardTitle>投稿設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ハッシュタグ */}
            <div className="space-y-2">
              <Label>カスタムハッシュタグ</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="#ハッシュタグ"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addHashtag()}
                />
                <Button size="sm" onClick={addHashtag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {customHashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {customHashtags.map((hashtag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      #{hashtag}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-4 w-4 p-0 ml-1"
                        onClick={() => removeHashtag(hashtag)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* スケジュール設定 */}
            <div className="space-y-3">
              <Label>投稿スケジュール（オプション）</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {scheduledDate ? format(scheduledDate, 'MM/dd', { locale: ja }) : '日付選択'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-32"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => savePosts('draft')} 
                  disabled={isPublishing || posts.length === 0}
                  variant="outline"
                  className="flex-1"
                >
                  {isPublishing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  下書き保存
                </Button>
                <Button 
                  onClick={() => savePosts('scheduled')} 
                  disabled={isPublishing || !scheduledDate || posts.length === 0}
                  className="flex-1"
                >
                  {isPublishing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4 mr-2" />
                  )}
                  予約投稿
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReviewPosts;
