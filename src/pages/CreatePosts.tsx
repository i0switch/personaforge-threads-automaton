
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Calendar as CalendarIcon, Clock, User, Wand2, Loader2 } from "lucide-react";
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
  
  const [currentStep, setCurrentStep] = useState(1);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [topics, setTopics] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPersonas();
  }, [user]);

  const loadPersonas = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      setPersonas(data || []);
    } catch (error) {
      console.error('Error loading personas:', error);
      toast({
        title: "エラー",
        description: "ペルソナの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 時間帯オプション（30分間隔）
  const timeSlots = [
    "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
    "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30",
    "22:00", "22:30", "23:00", "23:30"
  ];

  const toggleDate = (date: Date) => {
    // 日本時間のローカル日付として処理
    const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    setSelectedDates(prev => {
      const isSelected = prev.some(d => 
        d.getFullYear() === localDate.getFullYear() &&
        d.getMonth() === localDate.getMonth() &&
        d.getDate() === localDate.getDate()
      );
      
      if (isSelected) {
        return prev.filter(d => 
          !(d.getFullYear() === localDate.getFullYear() &&
            d.getMonth() === localDate.getMonth() &&
            d.getDate() === localDate.getDate())
        );
      } else {
        return [...prev, localDate];
      }
    });
  };

  const toggleTime = (time: string) => {
    setSelectedTimes(prev => 
      prev.includes(time) 
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  const generatePosts = async () => {
    if (!selectedPersona || selectedDates.length === 0 || selectedTimes.length === 0 || !topics.trim()) {
      toast({
        title: "エラー",
        description: "ペルソナ、日付、時間、トピックを選択してください。",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      console.log('Generating posts with:', {
        personaId: selectedPersona.id,
        topics: topics.split(',').map(t => t.trim()).filter(Boolean),
        selectedDates: selectedDates.map(d => d.toISOString().split('T')[0]),
        selectedTimes,
        customPrompt
      });

      const { data, error } = await supabase.functions.invoke('generate-posts', {
        body: {
          personaId: selectedPersona.id,
          topics: topics.split(',').map(t => t.trim()).filter(Boolean),
          selectedDates: selectedDates.map(d => d.toISOString().split('T')[0]),
          selectedTimes,
          customPrompt: customPrompt.trim() || undefined
        }
      });

      if (error) throw error;

      if (data.posts && data.posts.length > 0) {
        console.log('Generated posts:', data.posts);
        navigate("/review-posts", { 
          state: { 
            posts: data.posts,
            persona: selectedPersona
          }
        });
      } else {
        throw new Error('投稿の生成に失敗しました');
      }
    } catch (error) {
      console.error('Error generating posts:', error);
      toast({
        title: "エラー",
        description: "投稿の生成に失敗しました。APIキーの設定を確認してください。",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
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
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            ダッシュボードに戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">新規投稿作成</h1>
            <p className="text-muted-foreground">AIが自動でソーシャルメディア投稿を生成します</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center space-x-4">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= step 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {step}
              </div>
              <span className={`ml-2 text-sm ${
                currentStep >= step ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {step === 1 && 'セットアップ'}
                {step === 2 && '生成・編集'}
                {step === 3 && '画像生成'}
              </span>
              {step < 3 && <ArrowRight className="h-4 w-4 mx-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step 1: Setup */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {/* Persona Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  ペルソナ選択
                </CardTitle>
                <CardDescription>投稿するペルソナを選択してください</CardDescription>
              </CardHeader>
              <CardContent>
                {personas.length === 0 ? (
                  <div className="text-center py-8">
                    <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">ペルソナが設定されていません</p>
                    <Button onClick={() => navigate("/persona-setup")} variant="outline">
                      ペルソナを作成
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {personas.map((persona) => (
                      <Card 
                        key={persona.id} 
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedPersona?.id === persona.id 
                            ? 'ring-2 ring-primary bg-primary/5' 
                            : ''
                        }`}
                        onClick={() => setSelectedPersona(persona)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={persona.avatar_url || ""} />
                              <AvatarFallback>{persona.name[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h3 className="font-semibold">{persona.name}</h3>
                              {persona.age && (
                                <p className="text-sm text-muted-foreground">{persona.age}歳</p>
                              )}
                              {persona.expertise && persona.expertise.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {persona.expertise.slice(0, 2).map((skill, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {skill}
                                    </Badge>
                                  ))}
                                  {persona.expertise.length > 2 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{persona.expertise.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Date and Time Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Date Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    日付選択
                  </CardTitle>
                  <CardDescription>投稿する日付を選択してください（複数選択可）</CardDescription>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="multiple"
                    selected={selectedDates}
                    onSelect={(dates) => setSelectedDates(dates || [])}
                    className="rounded-md border w-full"
                    locale={ja}
                  />
                  {selectedDates.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">選択された日付:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedDates.map((date, index) => (
                          <Badge key={index} variant="secondary">
                            {format(date, 'MM/dd', { locale: ja })}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Time Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    時間選択
                  </CardTitle>
                  <CardDescription>投稿する時間を選択してください（複数選択可）</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {timeSlots.map((time) => (
                      <Button
                        key={time}
                        variant={selectedTimes.includes(time) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleTime(time)}
                        className="justify-start"
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                  {selectedTimes.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">選択された時間:</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedTimes.sort().map((time, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {time}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Topics */}
            <Card>
              <CardHeader>
                <CardTitle>投稿トピック</CardTitle>
                <CardDescription>投稿のトピックをカンマ区切りで入力してください</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="topics">トピック（必須）</Label>
                  <Textarea
                    id="topics"
                    value={topics}
                    onChange={(e) => setTopics(e.target.value)}
                    placeholder="例: 健康, フィットネス, 栄養, トレーニング"
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="customPrompt">カスタムプロンプト（オプション）</Label>
                  <Textarea
                    id="customPrompt"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="AIに追加の指示がある場合は入力してください"
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Next Button */}
            <div className="flex justify-end">
              <Button 
                onClick={() => setCurrentStep(2)}
                disabled={!selectedPersona || selectedDates.length === 0 || selectedTimes.length === 0 || !topics.trim()}
                size="lg"
              >
                次へ進む
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Generate and Edit */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                投稿生成
              </CardTitle>
              <CardDescription>
                選択した設定で{selectedDates.length * selectedTimes.length}件の投稿を生成します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">設定確認</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>ペルソナ:</strong> {selectedPersona?.name}</p>
                    <p><strong>日付数:</strong> {selectedDates.length}日</p>
                    <p><strong>時間数:</strong> {selectedTimes.length}時間</p>
                  </div>
                  <div>
                    <p><strong>投稿数:</strong> {selectedDates.length * selectedTimes.length}件</p>
                    <p><strong>トピック:</strong> {topics}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentStep(1)}
                  size="lg"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  戻る
                </Button>
                <Button 
                  onClick={generatePosts}
                  disabled={isGenerating}
                  className="flex-1"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      投稿を生成
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CreatePosts;
