import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Calendar as CalendarIcon, Sparkles, Loader2 } from "lucide-react";
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
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [topics, setTopics] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // 30分間隔の時間選択肢を生成
  const timeOptions = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeOptions.push(timeString);
    }
  }

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

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    const isSelected = selectedDates.some(d => d.toDateString() === date.toDateString());
    if (isSelected) {
      setSelectedDates(selectedDates.filter(d => d.toDateString() !== date.toDateString()));
    } else {
      setSelectedDates([...selectedDates, date]);
    }
  };

  const handleTimeToggle = (time: string) => {
    if (selectedTimes.includes(time)) {
      setSelectedTimes(selectedTimes.filter(t => t !== time));
    } else {
      setSelectedTimes([...selectedTimes, time]);
    }
  };

  const generatePosts = async () => {
    if (!selectedPersona || !topics.trim() || selectedDates.length === 0 || selectedTimes.length === 0) {
      toast({
        title: "エラー",
        description: "すべての項目を入力してください。",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      console.log('Starting post generation with:', {
        personaId: selectedPersona,
        topics: topics.split('\n').filter(t => t.trim()),
        selectedDates: selectedDates.map(d => d.toISOString()),
        selectedTimes,
        customPrompt
      });

      const { data, error } = await supabase.functions.invoke('generate-posts', {
        body: {
          personaId: selectedPersona,
          topics: topics.split('\n').filter(t => t.trim()),
          selectedDates: selectedDates.map(d => d.toISOString()),
          selectedTimes,
          customPrompt
        }
      });

      console.log('Generate posts response:', data);

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data.success && data.posts && data.posts.length > 0) {
        const selectedPersonaData = personas.find(p => p.id === selectedPersona);
        
        console.log('Navigating to review posts with:', {
          posts: data.posts,
          persona: selectedPersonaData
        });

        toast({
          title: "成功",
          description: `${data.posts.length}件の投稿を生成しました。`,
        });

        // Navigate to review page
        navigate("/review-posts", {
          state: {
            posts: data.posts,
            persona: selectedPersonaData
          }
        });
      } else {
        throw new Error('投稿の生成に失敗しました');
      }
    } catch (error) {
      console.error('Error generating posts:', error);
      toast({
        title: "エラー",
        description: "投稿の生成に失敗しました。詳細はコンソールを確認してください。",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
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

        <div className="space-y-6">
          {/* ペルソナ選択 */}
          <Card>
            <CardHeader>
              <CardTitle>ペルソナ選択</CardTitle>
            </CardHeader>
            <CardContent>
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
                <div className="p-3 bg-muted rounded-lg mt-3">
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
            </CardContent>
          </Card>

          {/* 日付選択 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                投稿日選択
              </CardTitle>
              <CardDescription>
                投稿したい日付を選択してください（複数選択可能）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => setSelectedDates(dates || [])}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
              {selectedDates.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium mb-2">選択された日付:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedDates.map((date, index) => (
                      <span key={index} className="bg-primary/10 text-primary px-2 py-1 rounded text-sm">
                        {format(date, 'MM/dd', { locale: ja })}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 時間選択 */}
          <Card>
            <CardHeader>
              <CardTitle>投稿時間選択</CardTitle>
              <CardDescription>
                投稿したい時間を選択してください（30分間隔）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {timeOptions.map((time) => (
                  <div key={time} className="flex items-center space-x-2">
                    <Checkbox
                      id={time}
                      checked={selectedTimes.includes(time)}
                      onCheckedChange={() => handleTimeToggle(time)}
                    />
                    <label htmlFor={time} className="text-sm font-medium">
                      {time}
                    </label>
                  </div>
                ))}
              </div>
              {selectedTimes.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium mb-2">選択された時間: {selectedTimes.length}件</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 投稿内容入力 */}
          <Card>
            <CardHeader>
              <CardTitle>投稿内容</CardTitle>
              <CardDescription>
                投稿したいトピックを入力してください（1行1トピック）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>投稿トピック</Label>
                <Textarea
                  placeholder="例：&#10;今日の朝活について&#10;おすすめのカフェ紹介&#10;仕事の効率化ツール"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  rows={4}
                />
              </div>
              <div>
                <Label>カスタムプロンプト（オプション）</Label>
                <Textarea
                  placeholder="特別な指示があれば入力してください"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* 生成ボタン */}
          <Button 
            onClick={generatePosts} 
            disabled={isGenerating || !topics.trim() || !selectedPersona || selectedDates.length === 0 || selectedTimes.length === 0}
            className="w-full"
            size="lg"
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
        </div>
      </div>
    </div>
  );
};

export default CreatePosts;
