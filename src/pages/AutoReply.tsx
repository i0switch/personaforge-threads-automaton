import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Bot, MessageCircle, Save, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const AutoReply = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [replyDelay, setReplyDelay] = useState(30);
  
  const [replyRules, setReplyRules] = useState([
    {
      id: 1,
      trigger: "こんにちは",
      response: "こんにちは！コメントありがとうございます😊 何かご質問がありましたらお気軽にどうぞ！",
      enabled: true
    },
    {
      id: 2,
      trigger: "質問",
      response: "ご質問をいただきありがとうございます！詳しく教えていただけると、より適切にお答えできます。",
      enabled: true
    },
    {
      id: 3,
      trigger: "ありがとう",
      response: "こちらこそありがとうございます！お役に立てて嬉しいです✨",
      enabled: true
    }
  ]);

  const [newRule, setNewRule] = useState({
    trigger: "",
    response: ""
  });

  const [recentReplies] = useState([
    {
      id: 1,
      originalComment: "この投稿とても参考になりました！ありがとうございます",
      autoReply: "こちらこそありがとうございます！お役に立てて嬉しいです✨",
      timestamp: "2024-06-14 15:30",
      status: "sent"
    },
    {
      id: 2,
      originalComment: "質問があります。これについてもう少し詳しく教えてください",
      autoReply: "ご質問をいただきありがとうございます！詳しく教えていただけると、より適切にお答えできます。",
      timestamp: "2024-06-14 14:15",
      status: "sent"
    }
  ]);

  const handleSaveSettings = () => {
    toast({
      title: "設定を保存しました",
      description: "自動返信の設定が更新されました。",
    });
  };

  const addReplyRule = () => {
    if (newRule.trigger && newRule.response) {
      const newId = Math.max(...replyRules.map(r => r.id)) + 1;
      setReplyRules(prev => [...prev, {
        id: newId,
        trigger: newRule.trigger,
        response: newRule.response,
        enabled: true
      }]);
      setNewRule({ trigger: "", response: "" });
      toast({
        title: "返信ルールを追加しました",
        description: "新しい自動返信ルールが追加されました。",
      });
    }
  };

  const deleteReplyRule = (id: number) => {
    setReplyRules(prev => prev.filter(rule => rule.id !== id));
    toast({
      title: "返信ルールを削除しました",
      description: "選択した返信ルールを削除しました。",
    });
  };

  const toggleRule = (id: number) => {
    setReplyRules(prev => prev.map(rule => 
      rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
    ));
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate("/")} variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">自動返信設定</h1>
            <p className="text-muted-foreground">AIによる自動返信の設定と管理</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日の自動返信</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground">+2 前日比</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">返信率</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">95%</div>
              <p className="text-xs text-muted-foreground">自動返信成功率</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">アクティブルール</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{replyRules.filter(r => r.enabled).length}</div>
              <p className="text-xs text-muted-foreground">有効な返信ルール</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="settings">基本設定</TabsTrigger>
            <TabsTrigger value="rules">返信ルール</TabsTrigger>
            <TabsTrigger value="history">返信履歴</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>自動返信の基本設定</CardTitle>
                <CardDescription>
                  自動返信機能の全般的な設定を行います
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="auto-reply-enabled">自動返信を有効にする</Label>
                    <p className="text-sm text-muted-foreground">
                      AIがコメントを分析して自動的に返信します
                    </p>
                  </div>
                  <Switch
                    id="auto-reply-enabled"
                    checked={autoReplyEnabled}
                    onCheckedChange={setAutoReplyEnabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reply-delay">返信遅延時間（秒）</Label>
                  <Input
                    id="reply-delay"
                    type="number"
                    value={replyDelay}
                    onChange={(e) => setReplyDelay(parseInt(e.target.value))}
                    min="0"
                    max="300"
                    className="w-32"
                  />
                  <p className="text-sm text-muted-foreground">
                    自然な応答のための遅延時間を設定します
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveSettings}>
                    <Save className="h-4 w-4 mr-2" />
                    設定を保存
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>新しい返信ルールを追加</CardTitle>
                <CardDescription>
                  特定のキーワードに対する自動返信を設定します
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trigger">トリガーキーワード</Label>
                    <Input
                      id="trigger"
                      value={newRule.trigger}
                      onChange={(e) => setNewRule(prev => ({ ...prev, trigger: e.target.value }))}
                      placeholder="例: ありがとう, 質問, こんにちは"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="response">自動返信内容</Label>
                    <Textarea
                      id="response"
                      value={newRule.response}
                      onChange={(e) => setNewRule(prev => ({ ...prev, response: e.target.value }))}
                      placeholder="自動返信で送信するメッセージを入力"
                      rows={3}
                    />
                  </div>
                </div>
                <Button onClick={addReplyRule} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  返信ルールを追加
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>既存の返信ルール</CardTitle>
                <CardDescription>
                  設定済みの自動返信ルールを管理します
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {replyRules.map((rule) => (
                    <Card key={rule.id} className={!rule.enabled ? "opacity-50" : ""}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">トリガー</Badge>
                              <span className="font-medium">{rule.trigger}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {rule.response}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={() => toggleRule(rule.id)}
                            />
                            <Button
                              onClick={() => deleteReplyRule(rule.id)}
                              variant="outline"
                              size="sm"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>最近の自動返信履歴</CardTitle>
                <CardDescription>
                  AIが自動送信した返信の履歴を確認できます
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentReplies.map((reply) => (
                    <Card key={reply.id}>
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          <div>
                            <Badge variant="outline" className="mb-2">元のコメント</Badge>
                            <p className="text-sm">{reply.originalComment}</p>
                          </div>
                          <div>
                            <Badge variant="outline" className="mb-2">自動返信</Badge>
                            <p className="text-sm text-muted-foreground">{reply.autoReply}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{reply.timestamp}</span>
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              送信済み
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AutoReply;