import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // 30分単位の時間スロット
  const timeSlots = [
    "00:00", "00:30", "01:00", "01:30", "02:00", "02:30", "03:00", "03:30",
    "04:00", "04:30", "05:00", "05:30", "06:00", "06:30", "07:00", "07:30",
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
    "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30"
  ];

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

  const addTopic = () => {
    const trimmedTopic = newTopic.trim();
    if (trimmedTopic && !topics.includes(trimmedTopic)) {
      setTopics([...topics, trimmedTopic]);
      setNewTopic("");
    }
  };

  const removeTopic = (topicToRemove: string) => {
    setTopics(topics.filter(topic => topic !== topicToRemove));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    const isSelected = selectedDates.some(selectedDate => 
      selectedDate.toDateString() === date.toDateString()
    );
    
    if (isSelected) {
      setSelectedDates(selectedDates.filter(selectedDate => 
        selectedDate.toDateString() !== date.toDateString()
      ));
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
    if (!selectedPersona || topics.length === 0 || selectedDates.length === 0 || selectedTimes.length === 0) {
      toast({
        title: "エラー",
        description: "ペルソナ、トピック、日付、時間を選択してください。",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-posts', {
        body: {
          personaId: selectedPersona,
          topics,
          selectedDates: selectedDates.map(date => date.toISOString()),
          selectedTimes,
          customPrompt
        }
      });

      if (error) throw error;
      
      toast({
        title: "成功",
        description: `${data.generated_count}件の投稿を生成しました。`,
      });

      // リセット
      setTopics([]);
      setSelectedDates([]);
      setSelectedTimes([]);
      setCustomPrompt("");

      // 投稿確認ページに遷移
      navigate("/review-posts");
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

  const selectedPersonaData = personas.find(p => p.id === selectedPersona);
  const totalPosts = selectedDates.length * selectedTimes.length;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
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
            <CardDescription>投稿するキャラクターを選択</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        {/* トピック設定 */}
        <Card>
          <CardHeader>
            <CardTitle>投稿トピック</CardTitle>
            <CardDescription>投稿内容のテーマを設定</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="トピックを入力"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTopic()}
              />
              <Button size="sm" onClick={addTopic}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {topics.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {topics.map((topic, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {topic}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => removeTopic(topic)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 日付と時間選択 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 日付選択 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                日付選択
              </CardTitle>
              <CardDescription>
                投稿する日付を複数選択できます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={handleDateSelect}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
              {selectedDates.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">選択された日付:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedDates.map((date, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {format(date, 'MM/dd', { locale: ja })}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0 ml-1"
                          onClick={() => {
                            setSelectedDates(selectedDates.filter((_, i) => i !== index));
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 時間選択 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                時間選択
              </CardTitle>
              <CardDescription>
                投稿する時間を複数選択できます（30分刻み）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {timeSlots.map((time) => (
                  <div key={time} className="flex items-center space-x-2">
                    <Checkbox
                      id={time}
                      checked={selectedTimes.includes(time)}
                      onCheckedChange={() => handleTimeToggle(time)}
                    />
                    <Label htmlFor={time} className="text-sm">
                      {time}
                    </Label>
                  </div>
                ))}
              </div>
              {selectedTimes.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">選択された時間: {selectedTimes.length}件</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* カスタムプロンプト */}
        <Card>
          <CardHeader>
            <CardTitle>カスタムプロンプト（オプション）</CardTitle>
            <CardDescription>特別な指示があれば入力してください</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="例: もっとカジュアルに、絵文字を多用して、など"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* 生成サマリー */}
        {(selectedDates.length > 0 || selectedTimes.length > 0 || topics.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>生成サマリー</CardTitle>
              <CardDescription>
                以下の設定で投稿を生成します
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center mb-6">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{topics.length}</div>
                  <p className="text-sm text-muted-foreground">トピック</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{selectedDates.length}</div>
                  <p className="text-sm text-muted-foreground">日付</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{selectedTimes.length}</div>
                  <p className="text-sm text-muted-foreground">時間</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{totalPosts}</div>
                  <p className="text-sm text-muted-foreground">合計投稿数</p>
                </div>
              </div>
              
              <Button 
                onClick={generatePosts} 
                disabled={isGenerating || !selectedPersona || topics.length === 0 || selectedDates.length === 0 || selectedTimes.length === 0}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    生成中... ({totalPosts}件の投稿を作成中)
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {totalPosts}件の投稿を生成
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CreatePosts;
