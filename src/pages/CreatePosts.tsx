import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  Plus, 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  Users,
  Loader2,
  Image as ImageIcon,
  Download
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";
import { useImageGenerator } from "@/hooks/useImageGenerator";

type Persona = Database['public']['Tables']['personas']['Row'];

const CreatePosts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [topics, setTopics] = useState("");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>(["09:00"]);
  const [customTimes, setCustomTimes] = useState<{ [key: string]: string }>({});
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<{ [key: string]: string }>({});
  
  const imageGenerator = useImageGenerator();

  useEffect(() => {
    fetchPersonas();
  }, [user]);

  const fetchPersonas = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching personas:', error);
      toast({
        title: "エラー",
        description: "ペルソナの取得に失敗しました。",
        variant: "destructive",
      });
      return;
    }

    setPersonas(data || []);
    if (data && data.length > 0) {
      setSelectedPersona(data[0].id);
    }
  };

  const addCustomTime = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setCustomTimes(prev => ({ ...prev, [id]: "12:00" }));
  };

  const removeCustomTime = (id: string) => {
    setCustomTimes(prev => {
      const newTimes = { ...prev };
      delete newTimes[id];
      return newTimes;
    });
  };

  const addSelectedTime = (time: string) => {
    if (!selectedTimes.includes(time)) {
      setSelectedTimes(prev => [...prev, time]);
    }
  };

  const removeSelectedTime = (time: string) => {
    setSelectedTimes(prev => prev.filter(t => t !== time));
  };

  const generatePosts = async () => {
    if (!selectedPersona || !topics.trim() || selectedDates.length === 0 || selectedTimes.length === 0) {
      toast({
        title: "エラー",
        description: "すべての必須項目を入力してください。",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      console.log('Generating posts with data:', {
        personaId: selectedPersona,
        topics: topics.split('\n').filter(t => t.trim()),
        selectedDates,
        selectedTimes,
        customPrompt
      });

      const scheduledDates = [];
      for (const date of selectedDates) {
        for (const time of selectedTimes) {
          const [hours, minutes] = time.split(':').map(Number);
          const scheduledDate = new Date(date);
          scheduledDate.setHours(hours, minutes, 0, 0);
          scheduledDates.push(scheduledDate.toISOString());
        }
      }

      const { data, error } = await supabase.functions.invoke('generate-posts', {
        body: {
          personaId: selectedPersona,
          topics: topics.split('\n').filter(t => t.trim()),
          scheduledDates,
          customPrompt
        }
      });

      if (error) {
        console.error('Error generating posts:', error);
        throw error;
      }

      if (!data || !data.posts) {
        throw new Error('投稿の生成に失敗しました');
      }

      console.log('Generated posts:', data.posts);

      // Get persona data for navigation
      const selectedPersonaData = personas.find(p => p.id === selectedPersona);
      
      if (!selectedPersonaData) {
        throw new Error('選択されたペルソナが見つかりません');
      }

      // Navigate to review page with generated posts
      navigate("/review-posts", {
        state: {
          posts: data.posts,
          persona: selectedPersonaData
        }
      });

    } catch (error) {
      console.error('Error generating posts:', error);
      toast({
        title: "エラー",
        description: error.message || "投稿の生成に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImageForDate = async (date: Date) => {
    if (!imageGenerator.faceImage) {
      toast({
        title: "エラー",
        description: "顔写真をアップロードしてください。",
        variant: "destructive",
      });
      return;
    }

    const dateKey = format(date, 'yyyy-MM-dd');
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;

          const payload = {
            face_image_b64: base64,
            prompt: imageGenerator.subject + (imageGenerator.additionalPrompt ? `, ${imageGenerator.additionalPrompt}` : ''),
            negative_prompt: imageGenerator.additionalNegative,
            guidance_scale: imageGenerator.guidanceScale[0],
            ip_adapter_scale: imageGenerator.ipAdapterScale[0],
            num_inference_steps: imageGenerator.numSteps[0],
            width: imageGenerator.width[0],
            height: imageGenerator.height[0],
            upscale: imageGenerator.upscale,
            upscale_factor: imageGenerator.upscaleFactor[0]
          };

          const { data, error } = await supabase.functions.invoke('generate-image-huggingface', {
            body: payload
          });

          if (error) {
            throw new Error(`画像生成に失敗しました: ${error.message}`);
          }

          if (!data || !data.image) {
            throw new Error('画像データが返されませんでした');
          }

          setGeneratedImages(prev => ({
            ...prev,
            [dateKey]: data.image
          }));

          toast({
            title: "生成完了",
            description: `${format(date, 'MM/dd', { locale: ja })}の画像が生成されました。`,
          });
        } catch (error) {
          console.error('Error generating image:', error);
          toast({
            title: "エラー",
            description: error.message || "画像生成に失敗しました。",
            variant: "destructive",
          });
        }
      };
      reader.readAsDataURL(imageGenerator.faceImage);
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "エラー",
        description: "画像生成に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const downloadImage = (dateKey: string) => {
    const imageUrl = generatedImages[dateKey];
    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-image-${dateKey}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const predefinedTimes = [
    "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
    "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
    "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
  ];

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
            <p className="text-muted-foreground">AIを使って魅力的な投稿を自動生成</p>
          </div>
        </div>

        {/* Persona Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              ペルソナ選択
            </CardTitle>
            <CardDescription>投稿に使用するペルソナを選択してください</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {personas.map((persona) => (
                <div
                  key={persona.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedPersona === persona.id
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedPersona(persona.id)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={persona.avatar_url || ""} />
                      <AvatarFallback>{persona.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{persona.name}</p>
                      <p className="text-sm text-muted-foreground">{persona.personality}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Topics */}
        <Card>
          <CardHeader>
            <CardTitle>投稿トピック</CardTitle>
            <CardDescription>投稿で扱いたいトピックを1行ずつ入力してください</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="例：&#10;今日のおすすめランチ&#10;週末の過ごし方&#10;最新のトレンド情報"
              rows={5}
            />
          </CardContent>
        </Card>

        {/* Schedule Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Date Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                投稿日選択
              </CardTitle>
              <CardDescription>投稿したい日付を選択してください（複数選択可）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => setSelectedDates(dates || [])}
                className="rounded-md border"
                disabled={(date) => date < new Date()}
              />
              
              {selectedDates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">選択された日付:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDates.map((date, index) => (
                      <Badge key={index} variant="secondary">
                        {format(date, 'MM/dd (E)', { locale: ja })}
                        <button
                          onClick={() => setSelectedDates(prev => prev.filter((_, i) => i !== index))}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
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
                投稿時刻選択
              </CardTitle>
              <CardDescription>投稿したい時刻を選択してください（複数選択可）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Predefined Times */}
              <div>
                <p className="text-sm font-medium mb-2">定型時刻:</p>
                <div className="grid grid-cols-3 gap-2">
                  {predefinedTimes.map((time) => (
                    <Button
                      key={time}
                      variant={selectedTimes.includes(time) ? "default" : "outline"}
                      size="sm"
                      onClick={() => selectedTimes.includes(time) ? removeSelectedTime(time) : addSelectedTime(time)}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Times */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">カスタム時刻:</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addCustomTime}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    追加
                  </Button>
                </div>
                <div className="space-y-2">
                  {Object.entries(customTimes).map(([id, time]) => (
                    <div key={id} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setCustomTimes(prev => ({ ...prev, [id]: e.target.value }))}
                        className="border rounded px-2 py-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          addSelectedTime(time);
                          removeCustomTime(id);
                        }}
                      >
                        追加
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeCustomTime(id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Times */}
              {selectedTimes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">選択された時刻:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTimes.sort().map((time, index) => (
                      <Badge key={index} variant="secondary">
                        {time}
                        <button
                          onClick={() => removeSelectedTime(time)}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Custom Prompt */}
        <Card>
          <CardHeader>
            <CardTitle>カスタムプロンプト（オプション）</CardTitle>
            <CardDescription>AIに追加で指示したい内容があれば入力してください</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="例：もっとカジュアルなトーンで書いて、絵文字を使って、質問形式で終わらせて"
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Image Generation Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              画像生成（オプション）
            </CardTitle>
            <CardDescription>投稿に添付する画像を生成できます</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Face Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">
                顔写真をアップロード
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={imageGenerator.handleFaceImageChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              {imageGenerator.faceImagePreview && (
                <img
                  src={imageGenerator.faceImagePreview}
                  alt="Face preview"
                  className="mt-2 w-32 h-32 object-cover rounded-lg border"
                />
              )}
            </div>

            {/* Prompt Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">被写体</label>
                <input
                  type="text"
                  value={imageGenerator.subject}
                  onChange={(e) => imageGenerator.setSubject(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="a beautiful 20yo woman"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">追加プロンプト</label>
                <input
                  type="text"
                  value={imageGenerator.additionalPrompt}
                  onChange={(e) => imageGenerator.setAdditionalPrompt(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="smiling, outdoor, casual clothes"
                />
              </div>
            </div>

            {/* Image Generation for Selected Dates */}
            {selectedDates.length > 0 && imageGenerator.faceImage && (
              <div>
                <p className="text-sm font-medium mb-3">選択した日付の画像を生成:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {selectedDates.map((date, index) => {
                    const dateKey = format(date, 'yyyy-MM-dd');
                    const hasImage = generatedImages[dateKey];
                    
                    return (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="text-center mb-2">
                          <p className="text-sm font-medium">
                            {format(date, 'MM/dd', { locale: ja })}
                          </p>
                        </div>
                        
                        {hasImage ? (
                          <div className="space-y-2">
                            <img
                              src={hasImage}
                              alt={`Generated for ${dateKey}`}
                              className="w-full h-32 object-cover rounded border"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadImage(dateKey)}
                              className="w-full"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              ダウンロード
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => generateImageForDate(date)}
                            disabled={imageGenerator.generating}
                            className="w-full"
                          >
                            {imageGenerator.generating ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-1" />
                            )}
                            生成
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generate Button */}
        <div className="flex justify-center">
          <Button 
            onClick={generatePosts} 
            disabled={isGenerating || !selectedPersona || !topics.trim() || selectedDates.length === 0 || selectedTimes.length === 0}
            size="lg"
            className="px-8"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                投稿を生成する
              </>
            )}
          </Button>
        </div>

        {/* Summary */}
        {selectedPersona && selectedDates.length > 0 && selectedTimes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>生成予定の投稿数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {selectedDates.length * selectedTimes.length}
                </div>
                <p className="text-muted-foreground">
                  {selectedDates.length}日 × {selectedTimes.length}時刻 = 合計投稿数
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CreatePosts;
