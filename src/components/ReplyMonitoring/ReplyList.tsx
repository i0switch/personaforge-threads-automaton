
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Reply {
  id: string;
  original_post_id: string;
  reply_id: string;
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

  useEffect(() => {
    if (user) {
      fetchReplies();
    }
  }, [user]);

  const fetchReplies = async () => {
    try {
      setLoading(true);
      console.debug('[ReplyList] fetching replies for user:', user?.id);
      
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

      console.debug('[ReplyList] fetched', { error, hasData: !!data });
      
      if (error) {
        console.error('[ReplyList] supabase error', error);
        setReplies([]);
        return;
      }
      
      setReplies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('[ReplyList] unexpected error:', error);
      setReplies([]);
      toast({
        title: 'エラー',
        description: 'リプライの取得に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
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
              {(replies ?? []).map((reply) => (
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
                            {new Date(reply.reply_timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
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

export { ReplyList as default };
