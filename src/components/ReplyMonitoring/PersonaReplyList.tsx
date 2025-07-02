
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Play, Pause } from 'lucide-react';

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

export const PersonaReplyList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

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

  const checkRepliesNow = async () => {
    try {
      setChecking(true);
      
      const { data, error } = await supabase.functions.invoke('check-replies', {
        body: { manual: true }
      });

      if (error) throw error;

      toast({
        title: '成功',
        description: `リプライチェック完了: ${data?.repliesFound || 0}件の新しいリプライを発見しました`,
      });

      // リプライリストを更新
      await fetchReplies();
    } catch (error) {
      console.error('Error checking replies:', error);
      toast({
        title: 'エラー',
        description: 'リプライチェックに失敗しました',
        variant: 'destructive'
      });
    } finally {
      setChecking(false);
    }
  };

  const toggleReplyMonitoring = async (active: boolean) => {
    try {
      const { error } = await supabase
        .from('reply_check_settings')
        .upsert({
          user_id: user!.id,
          is_active: active,
          check_interval_minutes: 5
        });

      if (error) throw error;

      toast({
        title: '成功',
        description: `リプライ監視を${active ? '開始' : '停止'}しました`,
      });
    } catch (error) {
      console.error('Error updating monitoring settings:', error);
      toast({
        title: 'エラー',
        description: '設定の更新に失敗しました',
        variant: 'destructive'
      });
    }
  };

  if (loading && replies.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>リプライ監視コントロール</span>
            <div className="flex space-x-2">
              <Button
                onClick={() => toggleReplyMonitoring(true)}
                size="sm"
                variant="default"
              >
                <Play className="h-4 w-4 mr-2" />
                監視開始
              </Button>
              <Button
                onClick={() => toggleReplyMonitoring(false)}
                size="sm"
                variant="outline"
              >
                <Pause className="h-4 w-4 mr-2" />
                監視停止
              </Button>
              <Button
                onClick={checkRepliesNow}
                disabled={checking}
                size="sm"
                variant="secondary"
              >
                {checking ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                今すぐチェック
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            リプライ監視の手動制御と即座のチェックができます。通常は自動で5分ごとにチェックされます。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>受信したリプライ ({replies.length}件)</CardTitle>
        </CardHeader>
        <CardContent>
          {replies.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">まだリプライはありません</p>
              <Button onClick={checkRepliesNow} disabled={checking}>
                {checking ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                リプライをチェック
              </Button>
            </div>
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
                            {new Date(reply.reply_timestamp).toLocaleString('ja-JP')}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-gray-900 bg-gray-50 p-3 rounded">
                        {reply.reply_text}
                      </p>
                      
                      <div className="text-xs text-gray-400">
                        Reply ID: {reply.reply_id}
                      </div>
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
