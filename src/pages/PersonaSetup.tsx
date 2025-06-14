import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Upload, ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const PersonaSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [persona, setPersona] = useState({
    name: "AIアシスタント みか",
    age: "20代",
    personality: "フレンドリーで親しみやすい性格。テクノロジーとライフスタイルに詳しく、親近感のある話し方をする。",
    expertise: ["テック系", "ライフスタイル", "フレンドリー"],
    toneOfVoice: "親しみやすく、時々絵文字を使って表現する。専門用語は分かりやすく説明する。",
    avatar: "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=150"
  });

  const [newExpertise, setNewExpertise] = useState("");

  const handleSave = () => {
    toast({
      title: "ペルソナを保存しました",
      description: "設定が正常に更新されました。",
    });
    navigate("/");
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
                <Button variant="outline" size="sm" className="mb-4">
                  <Upload className="h-4 w-4 mr-2" />
                  画像を変更
                </Button>
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
              <CardTitle>基本設定</CardTitle>
              <CardDescription>
                ペルソナの基本的な特性を設定します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">名前</Label>
                  <Input
                    id="name"
                    value={persona.name}
                    onChange={(e) => setPersona(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="ペルソナの名前"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age">年齢層</Label>
                  <Input
                    id="age"
                    value={persona.age}
                    onChange={(e) => setPersona(prev => ({ ...prev, age: e.target.value }))}
                    placeholder="年齢層（例：20代）"
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
                />
              </div>

              <div className="space-y-2">
                <Label>専門分野・興味関心</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newExpertise}
                    onChange={(e) => setNewExpertise(e.target.value)}
                    placeholder="新しい分野を追加"
                    onKeyPress={(e) => e.key === 'Enter' && addExpertise()}
                  />
                  <Button onClick={addExpertise} variant="outline" size="sm">
                    追加
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {persona.expertise.map((item, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeExpertise(item)}
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
                <Button onClick={() => navigate("/")} variant="outline">
                  キャンセル
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PersonaSetup;