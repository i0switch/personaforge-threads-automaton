import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Bot, Calendar as CalendarIcon, Hash, Image, Settings, Wand2, Loader2, Save, Users, Download, RefreshCw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];
type GeneratedPost = {
  id: string;
  content: string;
  hashtags: string[];
  scheduled_for: string;
  edited: boolean;
};

const CreatePosts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const editPostId = searchParams.get('edit');
  
  const [currentStep, setCurrentStep] = useState(editPostId ? 2 : 1);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  
  const [settings, setSettings] = useState({
    selectedDates: [] as Date[],
    selectedTimes: [] as string[],
    topics: ["テクノロジー", "ライフスタイル"],
    customPrompt: ""
  });

  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [newTopic, setNewTopic] = useState("");
  
  // Image generation states
  const [generatedImages, setGeneratedImages] = useState<{[key: string]: string}>({});
  const [imagePrompts, setImagePrompts] = useState<{[key: string]: string}>({});
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [ngrokUrl, setNgrokUrl] = useState<string>("");
  const [referenceImage, setReferenceImage] = useState<string>("");
  const [ipAdapterScale, setIpAdapterScale] = useState<number>(0.8);
  const [controlWeight, setControlWeight] = useState<number>(0.8);
  const [guidanceScale, setGuidanceScale] = useState<number>(8.0);
  const [numSteps, setNumSteps] = useState<number>(25);
  const [imageWidth, setImageWidth] = useState<number>(512);
  const [imageHeight, setImageHeight] = useState<number>(768);

  useEffect(() => {
    loadPersonas();
    if (editPostId) {
      loadPostForEdit(editPostId);
    }
  }, [user, editPostId]);

  // Set reference image when persona is selected
  useEffect(() => {
    if (selectedPersona && personas.length > 0) {
      const persona = personas.find(p => p.id === selectedPersona);
      if (persona && persona.avatar_url) {
        // Convert URL to base64 for API
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          try {
            const base64 = canvas.toDataURL('image/jpeg');
            setReferenceImage(base64);
          } catch (error) {
            console.error('Failed to convert persona image to base64:', error);
          }
        };
        img.onerror = () => {
          console.error('Failed to load persona image for reference');
        };
        img.src = persona.avatar_url;
      }
    }
  }, [selectedPersona, personas]);

  const loadPersonas = async () => {
    if (!user) return;
    
    setLoadingPersonas(true);
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPersonas(data || []);
      
      // Auto-select first persona if available (only if not editing)
      if (data && data.length > 0 && !editPostId) {
        setSelectedPersona(data[0].id);
      }
    } catch (error) {
      console.error('Error loading personas:', error);
      toast({
        title: "エラー",
        description: "ペルソナの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoadingPersonas(false);
    }
  };

  const loadPostForEdit = async (postId: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        // Set up the form for editing
        setSelectedPersona(data.persona_id || "");
        setGeneratedPosts([{
          id: data.id,
          content: data.content,
          hashtags: data.hashtags || [],
          scheduled_for: data.scheduled_for || new Date().toISOString(),
          edited: false
        }]);

        // Load existing images if any
        if (data.images && data.images.length > 0) {
          const imageMap: {[key: string]: string} = {};
          data.images.forEach((image: string, index: number) => {
            imageMap[data.id] = image;
          });
          setGeneratedImages(imageMap);
        }

        // Move to editing step (step 2)
        setCurrentStep(2);
      }
    } catch (error) {
      console.error('Error loading post for edit:', error);
      toast({
        title: "エラー",
        description: "投稿の読み込みに失敗しました。",
        variant: "destructive",
      });
      navigate('/scheduled-posts');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePosts = async () => {
    if (!selectedPersona) {
      toast({
        title: "エラー",
        description: "ペルソナを選択してください。",
        variant: "destructive",
      });
      return;
    }

    if (settings.topics.length === 0) {
      toast({
        title: "エラー",
        description: "投稿トピックを少なくとも1つ追加してください。",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-posts', {
        body: {
          personaId: selectedPersona,
          topics: settings.topics,
          selectedDates: settings.selectedDates,
          selectedTimes: settings.selectedTimes,
          customPrompt: settings.customPrompt,
          user_id: user?.id
        }
      });

      if (error) throw error;

      const postsWithIds = data.posts.map((post: any, index: number) => ({
        ...post,
        id: `generated-${index}`,
        edited: false
      }));

      setGeneratedPosts(postsWithIds);
      setCurrentStep(2);
      
      toast({
        title: "投稿生成完了！",
        description: `${data.generated_count}件の投稿を生成しました。`,
      });
    } catch (error) {
      console.error('Error generating posts:', error);
      toast({
        title: "エラー",
        description: "投稿の生成に失敗しました。OpenAI APIキーが設定されているか確認してください。",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const savePosts = async () => {
    setSaving(true);
    try {
      if (editPostId && generatedPosts.length === 1) {
        // Update existing post
        const post = generatedPosts[0];
        const images = generatedImages[post.id] ? [generatedImages[post.id]] : [];
        const { error } = await supabase
          .from('posts')
          .update({
            content: post.content,
            hashtags: [],
            scheduled_for: post.scheduled_for,
            persona_id: selectedPersona,
            images: images,
          })
          .eq('id', editPostId)
          .eq('user_id', user?.id);

        if (error) throw error;

        toast({
          title: "投稿を更新しました",
          description: "投稿の変更が保存されました。",
        });
        
        navigate('/scheduled-posts');
      } else {
        // Create new posts
        const postsToSave = generatedPosts.map(post => ({
          content: post.content,
          hashtags: [],
          scheduled_for: post.scheduled_for,
          persona_id: selectedPersona,
          user_id: user?.id,
          status: 'scheduled' as const,
          platform: 'threads',
          images: generatedImages[post.id] ? [generatedImages[post.id]] : []
        }));

        const { error } = await supabase
          .from('posts')
          .insert(postsToSave);

        if (error) throw error;

        toast({
          title: "投稿を保存しました",
          description: `${generatedPosts.length}件の投稿を予約投稿として保存しました。`,
        });
        
        setCurrentStep(3);
      }
    } catch (error) {
      console.error('Error saving posts:', error);
      toast({
        title: "エラー",
        description: "投稿の保存に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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

  const updatePost = (id: string, content: string) => {
    setGeneratedPosts(prev => 
      prev.map(post => 
        post.id === id 
          ? { ...post, content, edited: true }
          : post
      )
    );
  };

  const updatePostSchedule = (id: string, scheduled_for: string) => {
    setGeneratedPosts(prev => 
      prev.map(post => 
        post.id === id 
          ? { ...post, scheduled_for, edited: true }
          : post
      )
    );
  };

  const formatScheduledTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Image generation functions
  const generateImagePrompt = async (postContent: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-image-prompt', {
        body: { postContent }
      });

      if (error) throw error;

      if (data && data.success && data.imagePrompt) {
        console.log('Successfully generated image prompt:', data.imagePrompt);
        return data.imagePrompt;
      } else {
        console.warn('No image prompt in response:', data);
        throw new Error(data?.details || 'Failed to generate image prompt');
      }
    } catch (error) {
      console.error('Error generating image prompt with Gemini:', error);
      
      // Only show error for actual failures, not when fallback is used
      if (error.message && !error.message.includes('Failed to generate image prompt')) {
        toast({
          title: "プロンプト生成に失敗",
          description: "Gemini APIによる画像プロンプトの自動生成に失敗しました。デフォルトプロンプトを使用します。",
          variant: "destructive",
        });
      }
      
      // Fallback to simple prompt if Gemini fails
      return "Portrait, casual outfit, confident smile, natural lighting, urban background, engaging pose";
    }
  };

  const generateImage = async (postId: string, prompt?: string) => {
    const post = generatedPosts.find(p => p.id === postId);
    if (!post) return;

    if (!ngrokUrl.trim()) {
      toast({
        title: "エラー",
        description: "ngrokのURLを入力してください。",
        variant: "destructive",
      });
      return;
    }

    let imagePrompt = prompt || imagePrompts[postId];
    
    // If no prompt exists, generate one using Gemini
    if (!imagePrompt) {
      try {
        imagePrompt = await generateImagePrompt(post.content);
      } catch (error) {
        console.error('Failed to generate prompt with Gemini:', error);
        // Note: Error is already shown in generateImagePrompt function
        imagePrompt = "Portrait, casual outfit, confident smile, natural lighting, urban background, engaging pose";
      }
    }
    
    setGeneratingImage(postId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image-huggingface', {
        body: {
          face_image_b64: referenceImage,
          prompt: imagePrompt,
          negative_prompt: "glasses, hat",
          guidance_scale: guidanceScale,
          ip_adapter_scale: ipAdapterScale,
          num_inference_steps: numSteps,
          width: imageWidth,
          height: imageHeight
        }
      });

      if (error) throw error;

      if (data.success && data.image_data) {
        const imageDataUrl = `data:image/png;base64,${data.image_data}`;
        setGeneratedImages(prev => ({ ...prev, [postId]: imageDataUrl }));
        setImagePrompts(prev => ({ ...prev, [postId]: imagePrompt }));
        
        toast({
          title: "画像生成完了！",
          description: "投稿用の画像を生成しました。",
        });
      } else {
        throw new Error(data.details || 'Image generation failed');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "エラー",
        description: `画像の生成に失敗しました。${error.message}`,
        variant: "destructive",
      });
    } finally {
      setGeneratingImage(null);
    }
  };

  const downloadImage = (imageDataUrl: string, postId: string) => {
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = `post-image-${postId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReferenceImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setReferenceImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePostImageUpload = (event: React.ChangeEvent<HTMLInputElement>, postId: string) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setGeneratedImages(prev => ({ ...prev, [postId]: base64 }));
        toast({
          title: "画像をアップロードしました",
          description: "投稿用の画像がアップロードされました。",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Initialize image prompts when posts are generated
  useEffect(() => {
    const initializeImagePrompts = async () => {
      if (generatedPosts.length > 0 && currentStep === 3) {
        const newPrompts: {[key: string]: string} = {};
        
        for (const post of generatedPosts) {
          if (!imagePrompts[post.id]) {
            try {
              const prompt = await generateImagePrompt(post.content);
              newPrompts[post.id] = prompt;
            } catch (error) {
              console.error('Failed to generate prompt for post:', post.id, error);
              // Use fallback prompt
              newPrompts[post.id] = "Portrait, casual outfit, confident smile, natural lighting, urban background, engaging pose";
            }
          }
        }
        
        if (Object.keys(newPrompts).length > 0) {
          setImagePrompts(prev => ({ ...prev, ...newPrompts }));
        }
      }
    };

    initializeImagePrompts();
  }, [generatedPosts, currentStep]);

  if (loading && editPostId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">投稿データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate(editPostId ? "/scheduled-posts" : "/")} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {editPostId ? "投稿編集" : "投稿作成"}
            </h1>
            <p className="text-muted-foreground">
              {editPostId ? "投稿内容を編集・更新します" : "AIで投稿を一括生成・編集します"}
            </p>
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

        <Tabs value={currentStep === 1 ? "settings" : currentStep === 2 ? "posts" : "images"} className="space-y-6">
          <TabsContent value="settings" className="space-y-6">
            {/* Persona Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  ペルソナ選択
                </CardTitle>
                <CardDescription>
                  投稿を生成するペルソナを選択してください
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPersonas ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>ペルソナを読み込み中...</span>
                  </div>
                ) : personas.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">ペルソナが見つかりません</p>
                    <Button onClick={() => navigate("/persona-setup")} variant="outline">
                      ペルソナを作成する
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Label>使用するペルソナ</Label>
                    <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                      <SelectTrigger>
                        <SelectValue placeholder="ペルソナを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {personas.map((persona) => (
                          <SelectItem key={persona.id} value={persona.id}>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={persona.avatar_url || ""} />
                                <AvatarFallback>{persona.name[0]?.toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span>{persona.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {selectedPersona && (
                      <div className="p-4 bg-muted rounded-lg">
                        {(() => {
                          const persona = personas.find(p => p.id === selectedPersona);
                          return persona ? (
                            <div className="flex items-center gap-4">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={persona.avatar_url || ""} />
                                <AvatarFallback>{persona.name[0]?.toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <h3 className="font-semibold">{persona.name}</h3>
                                {persona.age && <p className="text-sm text-muted-foreground">{persona.age}</p>}
                                {persona.personality && (
                                  <p className="text-sm mt-1 line-clamp-2">{persona.personality}</p>
                                )}
                                {persona.expertise && persona.expertise.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {persona.expertise.slice(0, 3).map((skill, index) => (
                                      <Badge key={index} variant="secondary" className="text-xs">
                                        {skill}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

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
                <div className="space-y-6">
                  {/* Date Selection */}
                  <div className="space-y-2">
                    <Label>投稿日を選択（最大5日）</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !settings.selectedDates.length && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {settings.selectedDates.length > 0
                            ? `${settings.selectedDates.length}日選択済み`
                            : "日付を選択してください"}
                        </Button>
                      </PopoverTrigger>
                       <PopoverContent className="w-80 p-0" align="start">
                        <Calendar
                          mode="multiple"
                          selected={settings.selectedDates}
                          onSelect={(dates) => {
                            if (dates && dates.length <= 5) {
                              setSettings(prev => ({ ...prev, selectedDates: dates }));
                            }
                          }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                          className="p-3 pointer-events-auto w-full max-w-[300px] overflow-hidden"
                        />
                      </PopoverContent>
                    </Popover>
                    {settings.selectedDates.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {settings.selectedDates.map((date, index) => (
                          <Badge key={index} variant="secondary">
                            {format(date, "M/d")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Time Selection */}
                  <div className="space-y-2">
                    <Label>投稿時間を選択</Label>
                    <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto border rounded-lg p-4">
                      {Array.from({ length: 48 }, (_, i) => {
                        const hour = Math.floor(i / 2);
                        const minute = (i % 2) * 30;
                        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                        return (
                          <div key={timeString} className="flex items-center space-x-2">
                            <Checkbox
                              id={timeString}
                              checked={settings.selectedTimes.includes(timeString)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSettings(prev => ({
                                    ...prev,
                                    selectedTimes: [...prev.selectedTimes, timeString].sort()
                                  }));
                                } else {
                                  setSettings(prev => ({
                                    ...prev,
                                    selectedTimes: prev.selectedTimes.filter(t => t !== timeString)
                                  }));
                                }
                              }}
                            />
                            <Label htmlFor={timeString} className="text-sm cursor-pointer">
                              {timeString}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                    {settings.selectedTimes.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground mb-2">
                          選択された時間: {settings.selectedTimes.length}個
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {settings.selectedTimes.map((time) => (
                            <Badge key={time} variant="outline" className="text-xs">
                              {time}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customPrompt">カスタムプロンプト</Label>
                    <Textarea
                      id="customPrompt"
                      value={settings.customPrompt}
                      onChange={(e) => setSettings(prev => ({ ...prev, customPrompt: e.target.value }))}
                      placeholder="例：AI美女アカウント運用の場合、日常系の200文字程度のポストを生成してください"
                      rows={3}
                      className="resize-none"
                    />
                    <p className="text-sm text-muted-foreground">
                      具体的な指示を入力することで、より適切な投稿を生成できます
                    </p>
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
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={handleGeneratePosts} 
                    size="lg"
                    disabled={generating || !selectedPersona || settings.selectedDates.length === 0 || settings.selectedTimes.length === 0}
                  >
                    {generating ? (
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
          </TabsContent>

          <TabsContent value="posts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  {editPostId ? "投稿編集" : "生成された投稿"}
                </CardTitle>
                <CardDescription>
                  {editPostId ? "投稿内容とスケジュールを編集できます" : "投稿内容を確認・編集できます"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {generatedPosts.map((post) => (
                    <Card key={post.id} className={post.edited ? "border-orange-200" : ""}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {formatScheduledTime(post.scheduled_for)}
                            </span>
                          </div>
                          {post.edited && (
                            <Badge variant="outline" className="text-orange-600 border-orange-200">
                              編集済み
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                       <CardContent className="space-y-4">
                         <Textarea
                           value={post.content}
                           onChange={(e) => updatePost(post.id, e.target.value)}
                           rows={3}
                           className="resize-none"
                         />
                         
                       </CardContent>
                    </Card>
                  ))}
                </div>


                 <div className="flex justify-between mt-6">
                   {!editPostId && (
                     <Button onClick={() => setCurrentStep(1)} variant="outline">
                       設定に戻る
                     </Button>
                   )}
                   <div className="flex gap-2 ml-auto">
                     {!editPostId && (
                       <Button onClick={() => setCurrentStep(3)} variant="outline">
                         画像生成へ
                       </Button>
                     )}
                     <Button onClick={savePosts} disabled={saving}>
                       {saving ? (
                         <>
                           <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                           {editPostId ? "更新中..." : "保存中..."}
                         </>
                       ) : (
                         <>
                           <Save className="h-4 w-4 mr-2" />
                           {editPostId ? "投稿を更新" : "投稿を保存"}
                         </>
                       )}
                     </Button>
                   </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="images" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  画像生成
                </CardTitle>
                <CardDescription>
                  投稿内容に基づいて、AIが画像を自動生成します
                </CardDescription>
              </CardHeader>
              <CardContent>
                {generatedPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <Image className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">投稿を先に生成してください</h3>
                    <p className="text-muted-foreground mb-6">
                      画像を生成するには、まず投稿内容を作成する必要があります。
                    </p>
                    <Button onClick={() => setCurrentStep(1)} variant="outline">
                      投稿作成に戻る
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* HuggingFace Spaces Setup */}
                    <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                          <Image className="h-5 w-5" />
                          HuggingFace Spaces セットアップ
                        </CardTitle>
                        <CardDescription className="text-green-700 dark:text-green-300">
                          HuggingFace Spacesの画像生成アプリのURLを入力してください
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="huggingfaceUrl">HuggingFace Spaces URL</Label>
                          <Input
                            id="huggingfaceUrl"
                            value={ngrokUrl}
                            onChange={(e) => setNgrokUrl(e.target.value)}
                            placeholder="例: https://huggingface.co/spaces/i0switch/my-image-generator"
                            className="bg-white dark:bg-gray-900"
                          />
                          <p className="text-sm text-green-700 dark:text-green-300">
                            あなたのHuggingFace SpacesのURLを入力してください
                          </p>
                        </div>
                        
                        <div className="text-sm text-green-700 dark:text-green-300 space-y-2">
                          <p className="font-medium">セットアップ手順:</p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>HuggingFace Spacesで画像生成アプリを作成・デプロイ</li>
                            <li>アプリが正常に動作することを確認</li>
                            <li>SpacesのURLをこちらに入力</li>
                            <li>APIエンドポイント: /api/predict/generate</li>
                          </ol>
                        </div>
                      </CardContent>
                    </Card>

                    {/* InstantID Settings */}
                    <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-purple-800 dark:text-purple-200">
                          <Users className="h-5 w-5" />
                          InstantID 設定
                        </CardTitle>
                        <CardDescription className="text-purple-700 dark:text-purple-300">
                          特定の人物の顔で画像を生成するためのリファレンス画像をアップロードしてください
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="referenceImage">リファレンス画像</Label>
                          <Input
                            id="referenceImage"
                            type="file"
                            accept="image/*"
                            onChange={handleReferenceImageUpload}
                            className="bg-white dark:bg-gray-900"
                          />
                          <p className="text-sm text-purple-700 dark:text-purple-300">
                            JPG、PNG形式の人物画像をアップロードしてください
                          </p>
                          {referenceImage && (
                            <div className="mt-2 p-2 bg-purple-100 dark:bg-purple-900 rounded">
                              <p className="text-sm text-purple-800 dark:text-purple-200">
                                ✓ リファレンス画像がアップロードされました
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="ipAdapterScale">IP Adapter Scale</Label>
                            <Input
                              id="ipAdapterScale"
                              type="number"
                              step="0.1"
                              min="0"
                              max="1"
                              value={ipAdapterScale}
                              onChange={(e) => setIpAdapterScale(parseFloat(e.target.value))}
                              className="bg-white dark:bg-gray-900"
                            />
                            <p className="text-xs text-purple-700 dark:text-purple-300">
                              デフォルト: 0.8
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="controlWeight">Control Weight</Label>
                            <Input
                              id="controlWeight"
                              type="number"
                              step="0.1"
                              min="0"
                              max="1"
                              value={controlWeight}
                              onChange={(e) => setControlWeight(parseFloat(e.target.value))}
                              className="bg-white dark:bg-gray-900"
                            />
                            <p className="text-xs text-purple-700 dark:text-purple-300">
                              デフォルト: 0.8
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>プロンプトへの忠実度 (Guidance Scale): {guidanceScale}</Label>
                            <Slider
                              value={[guidanceScale]}
                              onValueChange={(value) => setGuidanceScale(value[0])}
                              min={1}
                              max={20}
                              step={0.1}
                              className="w-full"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>生成ステップ数 (Steps): {numSteps}</Label>
                            <Slider
                              value={[numSteps]}
                              onValueChange={(value) => setNumSteps(value[0])}
                              min={1}
                              max={50}
                              step={1}
                              className="w-full"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>幅 (Width): {imageWidth}px</Label>
                            <Slider
                              value={[imageWidth]}
                              onValueChange={(value) => setImageWidth(value[0])}
                              min={256}
                              max={1024}
                              step={64}
                              className="w-full"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>高さ (Height): {imageHeight}px</Label>
                            <Slider
                              value={[imageHeight]}
                              onValueChange={(value) => setImageHeight(value[0])}
                              min={256}
                              max={1024}
                              step={64}
                              className="w-full"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <div className="text-blue-600 dark:text-blue-400">
                        <Image className="h-5 w-5" />
                      </div>
                      <div className="text-sm">
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          HuggingFace Spaces + Gemini APIを使用しています
                        </p>
                        <p className="text-blue-700 dark:text-blue-300">
                          投稿内容をGemini APIが解析し、画像生成プロンプトを自動生成します。リファレンス画像をアップロードすると、その人物の顔で画像が生成されます。
                        </p>
                      </div>
                    </div>

                    {generatedPosts.map((post) => (
                      <Card key={post.id} className="overflow-hidden">
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              投稿予定: {formatScheduledTime(post.scheduled_for)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {post.content}
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor={`prompt-${post.id}`}>画像プロンプト</Label>
                            <Textarea
                              id={`prompt-${post.id}`}
                              value={imagePrompts[post.id] || ""}
                              onChange={(e) => setImagePrompts(prev => ({ ...prev, [post.id]: e.target.value }))}
                              placeholder="画像生成のためのプロンプトを入力..."
                              rows={2}
                              className="resize-none"
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                              {generatedImages[post.id] ? (
                                <div className="space-y-3">
                                   <div className="relative group">
                                     <img 
                                       src={generatedImages[post.id]} 
                                       alt="Generated image"
                                       className="w-full h-auto rounded-lg shadow-lg border"
                                     />
                                     <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                                       <Button
                                        onClick={() => downloadImage(generatedImages[post.id], post.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        size="sm"
                                        variant="secondary"
                                      >
                                        <Download className="h-4 w-4 mr-2" />
                                        ダウンロード
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => generateImage(post.id, imagePrompts[post.id])}
                                      disabled={generatingImage === post.id}
                                      variant="outline"
                                      size="sm"
                                    >
                                      {generatingImage === post.id ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          再生成中...
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="h-4 w-4 mr-2" />
                                          再生成
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      onClick={() => downloadImage(generatedImages[post.id], post.id)}
                                      size="sm"
                                      variant="outline"
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      ダウンロード
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="w-full h-64 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center">
                                    <div className="text-center">
                                      <Image className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                                      <p className="text-sm text-muted-foreground">
                                        画像を生成してください
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    onClick={() => generateImage(post.id, imagePrompts[post.id])}
                                    disabled={generatingImage === post.id}
                                    className="w-full"
                                  >
                                    {generatingImage === post.id ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        画像生成中...
                                      </>
                                    ) : (
                                      <>
                                        <Wand2 className="h-4 w-4 mr-2" />
                                        画像を生成
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    <div className="flex justify-center gap-4 pt-6">
                      <Button onClick={() => setCurrentStep(2)} variant="outline">
                        投稿編集に戻る
                      </Button>
                      <Button onClick={() => navigate('/scheduled-posts')} className="bg-primary text-primary-foreground">
                        予約投稿を確認
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CreatePosts;