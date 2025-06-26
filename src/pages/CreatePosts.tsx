
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, CheckCheck, Copy, CopyCheck, PlusCircle, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DayPicker } from "react-day-picker";
import { add, isSameDay } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];

const CreatePosts = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (user) {
      loadPersonas();
    }
  }, [user]);

  const loadPersonas = async () => {
    setLoadingPersonas(true);
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPersonas(data || []);
    } catch (error) {
      console.error('Error loading personas:', error);
      toast({
        title: "エラー",
        description: "ペルソナの読み込みに失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoadingPersonas(false);
    }
  };

  const handleTopicAdd = () => {
    if (newTopic.trim() !== "") {
      setSelectedTopics([...selectedTopics, newTopic.trim()]);
      setNewTopic("");
    }
  };

  const handleTopicRemove = (topicToRemove: string) => {
    setSelectedTopics(selectedTopics.filter((topic) => topic !== topicToRemove));
  };

  const handleDateSelect = (dates: Date[] | undefined) => {
    if (dates) {
      setSelectedDates(dates);
    }
  };

  const handleTimeSelect = (time: string) => {
    const isTimeSelected = selectedTimes.includes(time);
    if (isTimeSelected) {
      setSelectedTimes(selectedTimes.filter((t) => t !== time));
    } else {
      setSelectedTimes([...selectedTimes, time]);
    }
  };

  const generatePosts = async () => {
    if (!selectedPersona || selectedTopics.length === 0 || selectedDates.length === 0 || selectedTimes.length === 0) {
      toast({
        title: "エラー",
        description: "すべての必須項目を入力してください。",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('認証が必要です');
      }

      console.log('Starting post generation with data:', {
        personaId: selectedPersona.id,
        topics: selectedTopics,
        dates: selectedDates,
        times: selectedTimes
      });

      const response = await supabase.functions.invoke('generate-posts', {
        body: {
          personaId: selectedPersona.id,
          topics: selectedTopics,
          selectedDates: selectedDates.map(date => date.toISOString()),
          selectedTimes: selectedTimes,
          customPrompt: customPrompt.trim() || undefined
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('Generation response:', response);

      if (response.error) {
        console.error('Generation error:', response.error);
        throw new Error(response.error.message || '投稿の生成に失敗しました');
      }

      const result = response.data;
      
      if (result.success) {
        if (result.generated_count > 0) {
          toast({
            title: "成功",
            description: `${result.generated_count}件の投稿を生成しました。`,
          });
          
          if (result.failed_count > 0) {
            toast({
              title: "一部失敗",
              description: `${result.failed_count}件の投稿の生成に失敗しました。`,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "エラー",
            description: "投稿を生成できませんでした。APIキーが正しく設定されているか確認してください。",
            variant: "destructive",
          });
        }
        
        // Reset form
        setSelectedPersona(null);
        setSelectedTopics([]);
        setSelectedDates([]);
        setSelectedTimes([]);
        setCustomPrompt("");
      } else {
        throw new Error(result.error || '投稿の生成に失敗しました');
      }

    } catch (error: any) {
      console.error('Error generating posts:', error);
      toast({
        title: "エラー",
        description: error.message || "投稿生成中にエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify({
      persona: selectedPersona,
      topics: selectedTopics,
      dates: selectedDates.map(date => date.toISOString()),
      times: selectedTimes,
      customPrompt: customPrompt
    }, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">投稿を作成</h1>
          <p className="text-muted-foreground">
            AIを活用してThreadsの投稿を自動生成
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ペルソナを選択</CardTitle>
            <CardDescription>
              投稿に使用するAIペルソナを選択してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={(value) => setSelectedPersona(personas.find(p => p.id === value) || null)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="ペルソナを選択" defaultValue={selectedPersona?.id} />
              </SelectTrigger>
              <SelectContent>
                {loadingPersonas ? (
                  <SelectItem value="" disabled>
                    読み込み中...
                  </SelectItem>
                ) : (
                  personas.map((persona) => (
                    <SelectItem key={persona.id} value={persona.id}>
                      {persona.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>投稿テーマ</CardTitle>
            <CardDescription>
              投稿するトピックやキーワードを入力してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="新しいトピックを追加"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
              />
              <Button type="button" onClick={handleTopicAdd}>
                <PlusCircle className="h-4 w-4 mr-2" />
                追加
              </Button>
            </div>
            <ScrollArea className="h-[100px] w-full rounded-md border">
              <div className="flex flex-wrap gap-2 p-2">
                {selectedTopics.map((topic) => (
                  <Badge
                    key={topic}
                    variant="secondary"
                    className="cursor-pointer hover:opacity-80 transition"
                    onClick={() => handleTopicRemove(topic)}
                  >
                    {topic}
                    <Trash2 className="h-4 w-4 ml-2" />
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>投稿日時</CardTitle>
            <CardDescription>
              投稿する日時を選択してください
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label>日付を選択</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDates && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDates?.length > 0 ? (
                        format(selectedDates[0], "yyyy/MM/dd") + (selectedDates.length > 1 ? ' +' + (selectedDates.length - 1) : '')
                      ) : (
                        <span>日付を選択</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DayPicker
                      mode="multiple"
                      selected={selectedDates}
                      onSelect={handleDateSelect}
                      footer={selectedDates?.length > 0 ? (
                        <p className="p-4 text-center text-sm">
                          {selectedDates.length} 日選択
                        </p>
                      ) : (
                        <p className="p-4 text-center text-sm">
                          日付を選択してください
                        </p>
                      )}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>時間を選択</Label>
                <div className="grid grid-cols-3 gap-2">
                  {["09:00", "12:00", "15:00", "18:00", "21:00", "23:00"].map((time) => (
                    <Button
                      key={time}
                      variant={selectedTimes.includes(time) ? "default" : "outline"}
                      onClick={() => handleTimeSelect(time)}
                    >
                      {time}
                      {selectedTimes.includes(time) && <CheckCheck className="h-4 w-4 ml-2" />}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>カスタム指示</CardTitle>
            <CardDescription>
              AIに対する追加の指示や要望を入力してください (オプション)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="AIに対する追加の指示や要望を入力してください"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <Button
            type="button"
            onClick={generatePosts}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                生成中... {generationProgress}%
              </>
            ) : (
              "投稿を生成"
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleCopyToClipboard}
            disabled={isCopied}
          >
            {isCopied ? (
              <>
                <CopyCheck className="mr-2 h-4 w-4" />
                コピー済み!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                設定をコピー
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreatePosts;
