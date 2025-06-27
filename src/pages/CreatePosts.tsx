import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];

interface Post {
  content: string;
  scheduledTime: Date | null;
}

const CreatePosts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [posts, setPosts] = useState<Post[]>([{ content: '', scheduledTime: null }]);
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchPersonas = async () => {
      if (!user) {
        console.log('CreatePosts: Not authenticated, skipping persona fetch');
        return;
      }

      try {
        console.log('CreatePosts: Fetching personas for user:', user.id);
        const { data: personasData, error } = await supabase
          .from('personas')
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          console.error('CreatePosts: Error fetching personas:', error);
          toast({
            title: "エラー",
            description: "ペルソナの取得に失敗しました。",
            variant: "destructive",
          });
          return;
        }

        console.log('CreatePosts: Fetched personas:', personasData?.length);
        setPersonas(personasData || []);
      } catch (error) {
        console.error('CreatePosts: Unexpected error fetching personas:', error);
        toast({
          title: "エラー",
          description: "ペルソナの取得中に予期せぬエラーが発生しました。",
          variant: "destructive",
        });
      }
    };

    fetchPersonas();
  }, [user, toast]);

  const addPost = () => {
    console.log('CreatePosts: Adding a new post');
    setPosts([...posts, { content: '', scheduledTime: null }]);
  };

  const updatePost = (index: number, content: string) => {
    console.log('CreatePosts: Updating post at index:', index, 'with content length:', content.length);
    const updatedPosts = [...posts];
    updatedPosts[index] = { ...updatedPosts[index], content };
    setPosts(updatedPosts);
  };

  const deletePost = (index: number) => {
    console.log('CreatePosts: Deleting post at index:', index);
    const newPosts = posts.filter((_, i) => i !== index);
    setPosts(newPosts);
  };

  const updateScheduledTime = (index: number, time: Date | null) => {
    console.log('CreatePosts: Updating scheduled time for post at index:', index, 'to:', time);
    const updatedPosts = [...posts];
    updatedPosts[index] = { ...updatedPosts[index], scheduledTime: time };
    setPosts(updatedPosts);
  };

  const generatePosts = async () => {
    if (!selectedPersona || posts.length === 0) {
      toast({
        title: "エラー",
        description: "ペルソナを選択し、投稿を作成してください。",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "エラー",
        description: "ログインが必要です。",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      console.log('CreatePosts: Starting post generation for persona:', selectedPersona.name);
      console.log('CreatePosts: Posts to generate:', posts.length);

      const { data, error } = await supabase.functions.invoke('generate-posts', {
        body: {
          persona_id: selectedPersona.id,
          posts: posts,
          user_id: user.id
        },
      });

      if (error) {
        console.error('CreatePosts: Function error:', error);
        throw error;
      }

      if (!data || !data.posts) {
        console.error('CreatePosts: No posts returned from function');
        throw new Error('投稿の生成に失敗しました');
      }

      console.log('CreatePosts: Generated posts:', data.posts.length);

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user.id,
          persona_id: selectedPersona.id,
          action_type: 'posts_generated',
          description: `${data.posts.length}件の投稿を生成しました`
        });

      toast({
        title: "成功",
        description: `${data.posts.length}件の投稿を生成し、保存しました。`,
      });

      // Clear the form
      setPosts([{ content: '', scheduledTime: null }]);
      setSelectedPersona(null);

      // Navigate to dashboard instead of review-posts
      navigate("/");

    } catch (error) {
      console.error('CreatePosts: Error generating posts:', error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "投稿の生成に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">投稿作成</h1>
          <p className="text-muted-foreground">
            ペルソナを選択して、投稿を作成してください。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ペルソナを選択</CardTitle>
            <CardDescription>
              投稿に使用するペルソナを選択してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={(value) => {
              const persona = personas.find((p) => p.id === value);
              setSelectedPersona(persona || null);
            }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="ペルソナを選択" defaultValue={selectedPersona?.id} />
              </SelectTrigger>
              <SelectContent>
                {personas.map((persona) => (
                  <SelectItem key={persona.id} value={persona.id}>
                    {persona.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedPersona && (
          <Card>
            <CardHeader>
              <CardTitle>投稿内容</CardTitle>
              <CardDescription>
                {selectedPersona.name}として投稿する内容を入力してください。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {posts.map((post, index) => (
                <div key={index} className="grid gap-2">
                  <Label htmlFor={`post-${index}`}>投稿 {index + 1}</Label>
                  <Textarea
                    id={`post-${index}`}
                    placeholder="投稿内容を入力してください"
                    value={post.content}
                    onChange={(e) => updatePost(index, e.target.value)}
                    rows={4}
                  />

                  <div className="flex items-center space-x-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={
                            "justify-start text-left font-normal w-32" +
                            (post.scheduledTime ? "text-foreground" : "text-muted-foreground")
                          }
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {post.scheduledTime ? (
                            format(post.scheduledTime, "yyyy-MM-dd")
                          ) : (
                            <span>日付を選択</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          // selected={date}
                          onSelect={(date) => {
                            updateScheduledTime(index, date);
                          }}
                          disabled={(date) =>
                            date < new Date()
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      defaultValue={post.scheduledTime ? format(post.scheduledTime, "HH:mm") : null}
                      onChange={(e) => {
                        const selectedTime = e.target.value;
                        if (selectedTime) {
                          const [hours, minutes] = selectedTime.split(':');
                          const newDate = post.scheduledTime ? new Date(post.scheduledTime) : new Date();
                          newDate.setHours(parseInt(hours, 10));
                          newDate.setMinutes(parseInt(minutes, 10));
                          updateScheduledTime(index, newDate);
                        }
                      }}
                      className="w-24"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePost(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="secondary" onClick={addPost}>
                <Plus className="h-4 w-4 mr-2" />
                投稿を追加
              </Button>
            </CardContent>
          </Card>
        )}

        {selectedPersona && (
          <Button
            className="w-full"
            onClick={generatePosts}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              "投稿を生成"
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CreatePosts;
