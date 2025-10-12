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

interface AutoPost {
  id: string;
  content: string;
  published_at: string;
  persona_id: string;
  persona_name: string;
  auto_schedule: boolean;
  status: string;
}

interface Persona {
  id: string;
  name: string;
}

export const AutoPostsList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<AutoPost[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPersonas();
      fetchPosts();
    }
  }, [user, selectedPersona]);

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

  const fetchPosts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('posts')
        .select(`
          id,
          content,
          published_at,
          persona_id,
          auto_schedule,
          status,
          personas!inner(name)
        `)
        .eq('user_id', user?.id)
        .eq('auto_schedule', true)
        .eq('status', 'published')
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(100);

      if (selectedPersona !== 'all') {
        query = query.eq('persona_id', selectedPersona);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData = data?.map(post => ({
        id: post.id,
        content: post.content,
        published_at: post.published_at,
        persona_id: post.persona_id,
        persona_name: (post.personas as any)?.name || '不明',
        auto_schedule: post.auto_schedule,
        status: post.status
      })) || [];

      setPosts(formattedData);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "エラー",
        description: "自動投稿の取得に失敗しました",
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
          <CardTitle>自動投稿履歴</CardTitle>
          <CardDescription>
            ペルソナごとの自動投稿の履歴を確認できます
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

          {posts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              自動投稿の履歴がありません
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map(post => (
                <Card key={post.id} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{post.persona_name}</Badge>
                      <Badge className="bg-blue-500 hover:bg-blue-600">
                        自動投稿
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(post.published_at), 'yyyy年M月d日 HH:mm', { locale: ja })}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{post.content}</p>
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
