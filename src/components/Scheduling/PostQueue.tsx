
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Queue, Play, Pause, ArrowUp, ArrowDown, X } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type QueueItem = Database['public']['Tables']['post_queue']['Row'] & {
  posts?: {
    content: string;
    personas?: {
      name: string;
      avatar_url: string | null;
    };
  };
};

export const PostQueue = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadQueue();
  }, [user]);

  const loadQueue = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('post_queue')
        .select(`
          *,
          posts(
            content,
            personas(name, avatar_url)
          )
        `)
        .eq('user_id', user.id)
        .order('queue_position', { ascending: true });

      if (error) throw error;
      setQueueItems(data || []);
    } catch (error) {
      console.error('Error loading queue:', error);
      toast({
        title: "エラー",
        description: "キューの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const processQueue = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('auto-scheduler');
      if (error) throw error;

      toast({
        title: "成功",
        description: "キューの処理を開始しました。",
      });
      
      // キューを再読み込み
      setTimeout(loadQueue, 2000);
    } catch (error) {
      console.error('Error processing queue:', error);
      toast({
        title: "エラー",
        description: "キューの処理に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const moveQueueItem = async (itemId: string, direction: 'up' | 'down') => {
    const currentIndex = queueItems.findIndex(item => item.id === itemId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= queueItems.length) return;

    try {
      const currentItem = queueItems[currentIndex];
      const targetItem = queueItems[newIndex];

      // 位置を交換
      await supabase
        .from('post_queue')
        .update({ queue_position: targetItem.queue_position })
        .eq('id', currentItem.id);

      await supabase
        .from('post_queue')
        .update({ queue_position: currentItem.queue_position })
        .eq('id', targetItem.id);

      loadQueue();
    } catch (error) {
      console.error('Error moving queue item:', error);
      toast({
        title: "エラー",
        description: "キューアイテムの移動に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const removeFromQueue = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('post_queue')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user!.id);

      if (error) throw error;

      toast({
        title: "成功",
        description: "キューから削除しました。",
      });
      
      loadQueue();
    } catch (error) {
      console.error('Error removing from queue:', error);
      toast({
        title: "エラー",
        description: "キューからの削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'queued':
        return <Badge variant="outline">待機中</Badge>;
      case 'processing':
        return <Badge variant="default">処理中</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500">完了</Badge>;
      case 'failed':
        return <Badge variant="destructive">失敗</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>読み込み中...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Queue className="h-5 w-5" />
              投稿キュー
            </CardTitle>
            <CardDescription>
              {queueItems.length}件の投稿がキューに登録されています。
            </CardDescription>
          </div>
          <Button onClick={processQueue} disabled={processing}>
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                処理中...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                キューを処理
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {queueItems.length === 0 ? (
          <div className="text-center py-8">
            <Queue className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">キューに投稿がありません。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queueItems.map((item, index) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">#{index + 1}</span>
                      {getStatusBadge(item.status)}
                      <span className="text-sm text-muted-foreground">
                        {item.posts?.personas?.name || "不明なペルソナ"}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2 mb-2">
                      {item.posts?.content?.substring(0, 100)}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      予定: {format(new Date(item.scheduled_for), 'MM/dd HH:mm', { locale: ja })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moveQueueItem(item.id, 'up')}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moveQueueItem(item.id, 'down')}
                      disabled={index === queueItems.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeFromQueue(item.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
