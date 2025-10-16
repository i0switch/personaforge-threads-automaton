import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { isWebSocketRestricted } from '@/utils/platform';

interface AutoReply {
  id: string;
  reply_text: string;
  reply_author_username: string;
  reply_timestamp: string;
  persona_id: string;
  persona_name: string;
  auto_reply_sent: boolean;
  ai_generated_response?: string;
}

interface Persona {
  id: string;
  name: string;
}

export const AutoRepliesList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [replies, setReplies] = useState<AutoReply[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPersonas();
      fetchReplies();
    }
  }, [user]);

  useEffect(() => {
    fetchReplies();
  }, [selectedPersona]);

  // リアルタイム監視の設定（Safari/WebKit対応）
  useEffect(() => {
    if (!user) return;

    const isRestricted = isWebSocketRestricted();
    let channel: any = null;
    let pollTimer: number | null = null;

    if (isRestricted) {
      console.warn('Safari/WebKit 環境のため、Realtime を無効化しポーリングにフォールバックします');
      pollTimer = window.setInterval(fetchReplies, 10000);
    } else {
      console.log('Setting up realtime subscription for auto-replies');
      channel = supabase
        .channel('auto-replies-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'thread_replies',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('New auto reply received via realtime:', payload);
            fetchReplies();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'thread_replies',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Auto reply updated via realtime:', payload);
            fetchReplies();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'activity_logs',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('New activity log received via realtime:', payload);
            fetchReplies();
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) {
        console.log('Cleaning up auto-replies realtime subscription');
        supabase.removeChannel(channel);
      }
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
    };
  }, [user]);

  const fetchPersonas = async () => {
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('id, name')
        .eq('user_id', user?.id)
        .eq('is_active', true);

      if (error) throw error;
      setPersonas(data || []);
    } catch (error) {
      console.error('Error fetching personas:', error);
    }
  };

  const fetchReplies = async () => {
    try {
      setLoading(true);
      
      // まずthread_repliesを取得
      let query = supabase
        .from('thread_replies')
        .select(`
          id,
          reply_text,
          reply_author_username,
          reply_timestamp,
          persona_id,
          auto_reply_sent,
          reply_id,
          personas!inner(name)
        `)
        .eq('user_id', user?.id)
        .eq('auto_reply_sent', true)
        .order('reply_timestamp', { ascending: false })
        .limit(100);

      if (selectedPersona !== 'all') {
        query = query.eq('persona_id', selectedPersona);
      }

      const { data: repliesData, error: repliesError } = await query;

      if (repliesError) throw repliesError;

      if (!repliesData || repliesData.length === 0) {
        setReplies([]);
        return;
      }

      // 一度にactivity_logsを取得（最適化）
      const { data: logsData } = await supabase
        .from('activity_logs')
        .select('metadata, description, created_at')
        .eq('user_id', user?.id)
        .in('action_type', ['ai_auto_reply_sent', 'auto_reply_sent'])
        .order('created_at', { ascending: false })
        .limit(500);

      // repliesとlogsをマッピング
      const repliesWithAIResponse = repliesData.map(reply => {
        const matchingLog = logsData?.find(log => {
          const metadata = log.metadata as any;
          return metadata?.reply_id === reply.reply_id || 
                 metadata?.threads_reply_id === reply.reply_id ||
                 metadata?.original_reply_id === reply.reply_id;
        });

        const metadata = matchingLog?.metadata as any;
        
        return {
          id: reply.id,
          reply_text: reply.reply_text,
          reply_author_username: reply.reply_author_username,
          reply_timestamp: reply.reply_timestamp,
          persona_id: reply.persona_id,
          persona_name: (reply.personas as any)?.name || '不明',
          auto_reply_sent: reply.auto_reply_sent,
          ai_generated_response: metadata?.ai_response || metadata?.response_text || metadata?.auto_reply_text
        };
      });

      setReplies(repliesWithAIResponse);
    } catch (error) {
      console.error('Error fetching replies:', error);
      toast({
        title: "エラー",
        description: "自動返信の取得に失敗しました",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>自動返信履歴</CardTitle>
          <CardDescription>
            ペルソナごとの自動返信の履歴を確認できます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="font-medium">ペルソナ:</label>
            <Select value={selectedPersona} onValueChange={setSelectedPersona}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {personas.map(persona => (
                  <SelectItem key={persona.id} value={persona.id}>
                    {persona.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {replies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              自動返信の履歴がありません
            </div>
          ) : (
            <div className="space-y-3">
              {replies.map(reply => (
                <Card key={reply.id} className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{reply.persona_name}</Badge>
                        <span className="text-sm text-muted-foreground">
                          @{reply.reply_author_username}
                        </span>
                      </div>
                      <Badge className="bg-green-500 hover:bg-green-600">
                        自動返信済み
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(reply.reply_timestamp), 'yyyy年M月d日 HH:mm', { locale: ja })}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          受信したリプライ
                        </Badge>
                      </div>
                      <p className="text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded-md">
                        {reply.reply_text}
                      </p>
                    </div>
                    
                    {reply.ai_generated_response && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            AI生成返信文
                          </Badge>
                        </div>
                        <p className="text-sm whitespace-pre-wrap bg-green-50 p-3 rounded-md">
                          {reply.ai_generated_response}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
