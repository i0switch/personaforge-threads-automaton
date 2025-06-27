
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageCircle, Settings, Activity, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ReplyList } from "@/components/ReplyMonitoring/ReplyList";
import { ReplySettings } from "@/components/ReplyMonitoring/ReplySettings";
import { ActivityLogs } from "@/components/ReplyMonitoring/ActivityLogs";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];
type ThreadReply = Database['public']['Tables']['thread_replies']['Row'];
type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];

const ReplyMonitoring = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [repliesLoading, setRepliesLoading] = useState(false);

  useEffect(() => {
    loadPersonas();
  }, [user]);

  useEffect(() => {
    if (selectedPersona) {
      loadReplies();
      loadActivityLogs();
    }
  }, [selectedPersona]);

  const loadPersonas = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setPersonas(data || []);
      if (data && data.length > 0) {
        setSelectedPersona(data[0]);
      }
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

  const loadReplies = async () => {
    if (!selectedPersona) return;
    
    setRepliesLoading(true);
    try {
      const { data, error } = await supabase
        .from('thread_replies')
        .select('*')
        .eq('persona_id', selectedPersona.id)
        .order('reply_timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setReplies(data || []);
    } catch (error) {
      console.error('Error loading replies:', error);
      toast({
        title: "エラー",
        description: "リプライの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setRepliesLoading(false);
    }
  };

  const loadActivityLogs = async () => {
    if (!selectedPersona) return;
    
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('persona_id', selectedPersona.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setActivityLogs(data || []);
    } catch (error) {
      console.error('Error loading activity logs:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
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
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            ホームに戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">リプライ監視</h1>
            <p className="text-muted-foreground">自動返信とコメント管理</p>
          </div>
        </div>

        {personas.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>ペルソナが見つかりません</CardTitle>
              <CardDescription>
                リプライ監視を開始するには、まずペルソナを作成してください。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/persona-setup")}>
                ペルソナを作成
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="replies" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="replies" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                リプライ一覧
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                設定
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                アクティビティ
              </TabsTrigger>
            </TabsList>

            <TabsContent value="replies" className="space-y-6">
              <ReplyList
                personas={personas}
                selectedPersona={selectedPersona}
                onPersonaChange={setSelectedPersona}
                replies={replies}
                loading={repliesLoading}
                onRefresh={loadReplies}
              />
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <ReplySettings
                personas={personas}
                selectedPersona={selectedPersona}
                onPersonaChange={setSelectedPersona}
              />
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              <ActivityLogs
                personas={personas}
                selectedPersona={selectedPersona}
                onPersonaChange={setSelectedPersona}
                activityLogs={activityLogs}
                onRefresh={loadActivityLogs}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default ReplyMonitoring;
