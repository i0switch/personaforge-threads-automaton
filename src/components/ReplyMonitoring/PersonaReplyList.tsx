
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Reply {
  id: string;
  original_post_id: string;
  reply_text: string;
  reply_author_username: string;
  reply_timestamp: string;
  auto_reply_sent: boolean;
  persona_id: string;
  personas: {
    name: string;
  };
}

interface Persona {
  id: string;
  name: string;
}

export const PersonaReplyList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPersonas();
      fetchReplies();
    }
  }, [user]);

  useEffect(() => {
    fetchReplies();
  }, [selectedPersona]);

  const fetchPersonas = async () => {
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('id, name')
        .eq('user_id', user!.id)
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
      
      let query = supabase
        .from('thread_replies')
        .select(`
          *,
          personas (
            name
          )
        `)
        .eq('user_id', user!.id)
        .order('reply_timestamp', { ascending: false })
        .limit(50);

      if (selectedPersona !== 'all') {
        query = query.eq('persona_id', selectedPersona);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReplies(data || []);
    } catch (error) {
      console.error('Error fetching replies:', error);
      toast({
        title: 'エラー',
        description: 'リプライの取得に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <Select value={selectedPersona} onValueChange={setSelectedPersona}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="ペルソナを選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全てのペルソナ</SelectItem>
            {personas.map((persona) => (
              <SelectItem key={persona.id} value={persona.id}>
                {persona.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={fetchReplies} disabled={loading}>
          更新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            受信したリプライ
            {selectedPersona !== 'all' && (
              <span className="text-sm font-normal ml-2">
                - {personas.find(p => p.id === selectedPersona)?.name}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && replies.length === 0 ? (
            <p className="text-gray-500">読み込み中...</p>
          ) : replies.length === 0 ? (
            <p className="text-gray-500">まだリプライはありません</p>
          ) : (
            <div className="space-y-4">
              {replies.map((reply) => (
                <Card key={reply.id} className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {reply.personas?.name}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            @{reply.reply_author_username}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {reply.auto_reply_sent && (
                            <Badge variant="secondary">自動返信済み</Badge>
                          )}
                          <span className="text-sm text-gray-500">
                            {new Date(reply.reply_timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-gray-900">{reply.reply_text}</p>
                    </div>
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
