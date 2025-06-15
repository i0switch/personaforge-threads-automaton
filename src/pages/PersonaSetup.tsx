import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Upload, ArrowLeft, Save, Loader2, ImagePlus, Link } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type PersonaData = {
  name: string;
  age: string;
  personality: string;
  expertise: string[];
  toneOfVoice: string;
  avatar: string;
  threadsAccessToken: string;
};

const PersonaSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const personaId = searchParams.get('id');
  
  const [persona, setPersona] = useState<PersonaData>({
    name: "",
    age: "",
    personality: "",
    expertise: [],
    toneOfVoice: "",
    avatar: "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=150",
    threadsAccessToken: ""
  });

  const [newExpertise, setNewExpertise] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showImageUrlInput, setShowImageUrlInput] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (personaId) {
      loadPersona(personaId);
    }
  }, [personaId]);

  const loadPersona = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setPersona({
          name: data.name,
          age: data.age || "",
          personality: data.personality || "",
          expertise: data.expertise || [],
          toneOfVoice: data.tone_of_voice || "",
          avatar: data.avatar_url || "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=150",
          threadsAccessToken: data.threads_access_token || ""
        });
      }
    } catch (error) {
      console.error('Error loading persona:', error);
      toast({
        title: "エラー",
        description: "ペルソナの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!persona.name.trim()) {
      toast({
        title: "エラー",
        description: "ペルソナ名を入力してください。",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const personaData = {
        name: persona.name,
        age: persona.age,
        personality: persona.personality,
        expertise: persona.expertise,
        tone_of_voice: persona.toneOfVoice,
        avatar_url: persona.avatar,
        threads_access_token: persona.threadsAccessToken,
        user_id: user.id,
        is_active: true
      };

      if (personaId) {
        // Update existing persona
        const { error } = await supabase
          .from('personas')
          .update(personaData)
          .eq('id', personaId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Create new persona
        const { error } = await supabase
          .from('personas')
          .insert([personaData]);

        if (error) throw error;
      }

      toast({
        title: "成功",
        description: personaId ? "ペルソナを更新しました。" : "ペルソナを作成しました。",
      });
      navigate("/");
    } catch (error) {
      console.error('Error saving persona:', error);
      toast({
        title: "エラー",
        description: "ペルソナの保存に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addExpertise = () => {
    if (newExpertise && !persona.expertise.includes(newExpertise)) {
      setPersona(prev => ({
        ...prev,
        expertise: [...prev.expertise, newExpertise]
      }));
      setNewExpertise("");
    }
  };

  const removeExpertise = (item: string) => {
    setPersona(prev => ({
      ...prev,
      expertise: prev.expertise.filter(exp => exp !== item)
    }));
  };

  const handleImageChange = () => {
    setShowImageUrlInput(true);
    setImageUrl(persona.avatar);
  };

  const handleImageUrlSave = () => {
    if (imageUrl.trim()) {
      setPersona(prev => ({ ...prev, avatar: imageUrl }));
      setShowImageUrlInput(false);
      setImageUrl("");
      toast({
        title: "成功",
        description: "画像を変更しました。",
      });
    }
  };

  const handleImageUrlCancel = () => {
    setShowImageUrlInput(false);
    setImageUrl("");
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Create a preview URL for the uploaded file
      const url = URL.createObjectURL(file);
      setPersona(prev => ({ ...prev, avatar: url }));
      toast({
        title: "成功",
        description: "画像をアップロードしました。",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate("/")} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">ペルソナ設定</h1>
            <p className="text-muted-foreground">AIの人格とキャラクターを設定します</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Preview */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>プレビュー</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <Avatar className="h-24 w-24 mx-auto mb-4">
                  <AvatarImage src={persona.avatar} />
                  <AvatarFallback>AI</AvatarFallback>
                </Avatar>
                
                {/* Image Change UI */}
                {showImageUrlInput ? (
                  <div className="space-y-2 mb-4">
                    <Label htmlFor="imageUrl">画像URL</Label>
                    <Input
                      id="imageUrl"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="画像のURLを入力してください"
                    />
                    <div className="flex gap-2 justify-center">
                      <Button onClick={handleImageUrlSave} size="sm">
                        <Save className="h-4 w-4 mr-2" />
                        保存
                      </Button>
                      <Button onClick={handleImageUrlCancel} variant="outline" size="sm">
                        キャンセル
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    <div className="flex gap-2 justify-center">
                      <Button 
                        onClick={handleImageChange} 
                        variant="outline" 
                        size="sm"
                        disabled={saving}
                      >
                        <Link className="h-4 w-4 mr-2" />
                        URLで変更
                      </Button>
                      <Button 
                        onClick={() => document.getElementById('fileInput')?.click()}
                        variant="outline" 
                        size="sm"
                        disabled={saving}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        ファイル選択
                      </Button>
                    </div>
                    <input
                      id="fileInput"
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{persona.name}</h3>
                <p className="text-sm text-muted-foreground">{persona.age}</p>
                <p className="text-sm">{persona.personality}</p>
                <div className="flex flex-wrap gap-2">
                  {persona.expertise.map((item, index) => (
                    <Badge key={index} variant="secondary">{item}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{personaId ? "ペルソナ編集" : "新規ペルソナ作成"}</CardTitle>
              <CardDescription>
                ペルソナの基本的な特性を設定します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>読み込み中...</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">名前</Label>
                      <Input
                        id="name"
                        value={persona.name}
                        onChange={(e) => setPersona(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="ペルソナの名前"
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age">年齢層</Label>
                      <Input
                        id="age"
                        value={persona.age}
                        onChange={(e) => setPersona(prev => ({ ...prev, age: e.target.value }))}
                        placeholder="年齢層（例：20代）"
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="personality">性格・特徴</Label>
                    <Textarea
                      id="personality"
                      value={persona.personality}
                      onChange={(e) => setPersona(prev => ({ ...prev, personality: e.target.value }))}
                      placeholder="ペルソナの性格や特徴を詳しく記述してください"
                      rows={3}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tone">話し方・トーン</Label>
                    <Textarea
                      id="tone"
                      value={persona.toneOfVoice}
                      onChange={(e) => setPersona(prev => ({ ...prev, toneOfVoice: e.target.value }))}
                      placeholder="どのような話し方をするか詳しく記述してください"
                      rows={3}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="threadsToken">Threadsアクセストークン</Label>
                    <Input
                      id="threadsToken"
                      type="password"
                      value={persona.threadsAccessToken}
                      onChange={(e) => setPersona(prev => ({ ...prev, threadsAccessToken: e.target.value }))}
                      placeholder="このペルソナ用のThreadsアクセストークンを入力"
                      disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                      このペルソナでThreadsに投稿する際に使用されるアクセストークンです
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>専門分野・興味関心</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={newExpertise}
                        onChange={(e) => setNewExpertise(e.target.value)}
                        placeholder="新しい分野を追加"
                        onKeyPress={(e) => e.key === 'Enter' && addExpertise()}
                        disabled={saving}
                      />
                      <Button onClick={addExpertise} variant="outline" size="sm" disabled={saving}>
                        追加
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {persona.expertise.map((item, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary"
                          className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => !saving && removeExpertise(item)}
                        >
                          {item} ×
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      クリックして削除
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button onClick={() => navigate("/")} variant="outline" disabled={saving}>
                      キャンセル
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          保存中...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          {personaId ? "更新" : "作成"}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PersonaSetup;