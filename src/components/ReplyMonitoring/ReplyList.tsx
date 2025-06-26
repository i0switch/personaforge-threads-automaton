
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export const ReplyList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingReply, setSendingReply] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchReplies();
    }
  }, [user]);

  const fetchReplies = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
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

  const sendManualReply = async (reply: Reply) => {
    try {
      setSendingReply(reply.id);
      
      const { data, error } = await supabase.functions.invoke('threads-auto-reply', {
        body: {
          postContent: '', // 元投稿の内容
          replyContent: reply.reply_text,
          replyId: reply.reply_id,
          personaId: reply.persona_id,
          userId: user!.id
        }
      });

      if (error) {
        console.error('Error sending manual reply:', error);
        throw error;
      }

      // auto_reply_sentを更新
      const { error: updateError } = await supabase
        .from('thread_replies')
        .update({ auto_reply_sent: true })
        .eq('id', reply.id);

      if (updateError) {
        console.error('Error updating reply status:', updateError);
        throw updateError;
      }

      await fetchReplies();
      
      toast({
        title: '成功',
        description: '手動返信を送信しました'
      });
    } catch (error) {
      console.error('Error sending manual reply:', error);
      toast({
        title: 'エラー',
        description: '返信の送信に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setSendingReply(null);
    }
  };

  if (loading && replies.length === 0) {
    return <div>読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>受信したリプライ</CardTitle>
        </CardHeader>
        <CardContent>
          {replies.length === 0 ? (
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
                            <Badge variant="secondary">返信済み</Badge>
                          )}
                          <span className="text-sm text-gray-500">
                            {new Date(reply.reply_timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-gray-900">{reply.reply_text}</p>
                      
                      {!reply.auto_reply_sent && (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => sendManualReply(reply)}
                            disabled={sendingReply === reply.id}
                          >
                            {sendingReply === reply.id ? '送信中...' : '手動返信'}
                          </Button>
                        </div>
                      )}
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
