
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calendar as CalendarIcon, Clock, Send, Sparkles, Loader2, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];

const CreatePosts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [postCount, setPostCount] = useState(3);
  const [generatedPosts, setGeneratedPosts] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState("12:00");
  const [customHashtags, setCustomHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    loadPersonas();
  }, [user]);

  const loadPersonas = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPersonas(data || []);
      if (data && data.length > 0) {
        setSelectedPersona(data[0].id);
      }
    } catch (error) {
      console.error('Error loading personas:', error);
      toast({
        title: "エラー",
        description: "ペルソナの読み込みに失敗しました。",
        variant: "destructive",
      });
    }
  };

  const generatePosts = async () => {
    if (!selectedPersona || !topic.trim()) {
      toast({
        title: "エラー",
        description: "ペルソナとトピックを選択してください。",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const selectedPersonaData = personas.find(p => p.id === selectedPersona);
      
      const { data, error } = await supabase.functions.invoke('generate-posts', {
        body: {
          personaId: selectedPersona,
          topic: topic,
          postCount: postCount,
          persona: selectedPersonaData
        }
      });

      if (error) throw error;
      
      setGeneratedPosts(data.posts || []);
      toast({
        title: "成功",
        description: `${data.posts?.length || 0}件の投稿を生成しました。`,
      });
    } catch (error) {
      console.error('Error generating posts:', error);
      toast({
        title: "エラー",
        description: "投稿の生成に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
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
    if (generatedPosts.length === 0) return;

    setIsPublishing(true);
    try {
      const scheduledFor = scheduledDate && status === 'scheduled' 
        ? new Date(`${format(scheduledDate, 'yyyy-MM-dd')} ${scheduledTime}:00`)
        : null;

      const postsToSave = generatedPosts.map(content => ({
        user_id: user!.id,
        persona_id: selectedPersona,
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
          persona_id: selectedPersona,
          action_type: status === 'scheduled' ? 'posts_scheduled' : 'posts_created',
          description: `${generatedPosts.length}件の投稿を${status === 'scheduled' ? '予約' : '作成'}しました`,
          metadata: { postCount: generatedPosts.length, topic }
        });

      toast({
        title: "成功",
        description: `投稿を${status === 'scheduled' ? '予約' : '保存'}しました。`,
      });

      setGeneratedPosts([]);
      setTopic("");
      setScheduledDate(undefined);
      setCustomHashtags([]);
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

  const selectedPersonaData = personas.find(p => p.id === selectedPersona);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">新規投稿作成</h1>
            <p className="text-muted-foreground">AIでThreads投稿を一括生成</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 設定パネル */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                投稿生成設定
              </CardTitle>
              <CardDescription>
                ペルソナとトピックを選択して投稿を生成します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* ペルソナ選択 */}
              <div className="space-y-2">
                <Label>ペルソナ選択</Label>
                <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                  <SelectTrigger>
                    <SelectValue placeholder="ペルソナを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {personas.map((persona) => (
                      <SelectItem key={persona.id} value={persona.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={persona.avatar_url || ""} />
                            <AvatarFallback>{persona.name[0]}</AvatarFallback>
                          </Avatar>
                          {persona.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPersonaData && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={selectedPersonaData.avatar_url || ""} />
                        <AvatarFallback>{selectedPersonaData.name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{selectedPersonaData.name}</span>
                    </div>
                    {selectedPersonaData.personality && (
                      <p className="text-sm text-muted-foreground">{selectedPersonaData.personality}</p>
                    )}
                  </div>
                )}
              </div>

              {/* トピック入力 */}
              <div className="space-y-2">
                <Label>投稿トピック</Label>
                <Textarea
                  placeholder="どのようなトピックについて投稿しますか？"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                />
              </div>

              {/* 投稿数設定 */}
              <div className="space-y-2">
                <Label>生成する投稿数</Label>
                <Select value={postCount.toString()} onValueChange={(value) => setPostCount(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1件</SelectItem>
                    <SelectItem value="3">3件</SelectItem>
                    <SelectItem value="5">5件</SelectItem>
                    <SelectItem value="10">10件</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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

              <Button 
                onClick={generatePosts} 
                disabled={isGenerating || !topic.trim() || !selectedPersona}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    投稿を生成
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 生成結果・スケジュール設定 */}
          <Card>
            <CardHeader>
              <CardTitle>生成された投稿</CardTitle>
              <CardDescription>
                {generatedPosts.length > 0 
                  ? `${generatedPosts.length}件の投稿が生成されました`
                  : "投稿を生成してください"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {generatedPosts.length > 0 ? (
                <>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {generatedPosts.map((post, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">投稿 {index + 1}</Badge>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{post}</p>
                      </div>
                    ))}
                  </div>

                  {/* スケジュール設定 */}
                  <div className="space-y-3 border-t pt-4">
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
                        disabled={isPublishing}
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
                        disabled={isPublishing || !scheduledDate}
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
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>トピックを入力して投稿を生成してください</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreatePosts;
