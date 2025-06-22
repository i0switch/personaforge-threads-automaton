
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
  const [customHashtags, setCustomHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");

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
      
      const posts = data.posts || [];
      setGeneratedPosts(posts);
      
      toast({
        title: "成功",
        description: `${posts.length}件の投稿を生成しました。`,
      });

      // Navigate to review page
      navigate("/review-posts", {
        state: {
          posts,
          persona: selectedPersonaData,
          topic,
          customHashtags
        }
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

  const selectedPersonaData = personas.find(p => p.id === selectedPersona);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
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
      </div>
    </div>
  );
};

export default CreatePosts;
