
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UserWithPersonaLimit {
  user_id: string;
  email: string;
  display_name: string;
  persona_limit: number;
  current_personas: number;
  is_approved: boolean;
  subscription_status: string;
}

export const PersonaLimitManager = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithPersonaLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data: usersData, error } = await supabase
        .from('user_account_status')
        .select(`
          user_id,
          persona_limit,
          is_approved,
          subscription_status,
          profiles!inner(display_name)
        `)
        .order('persona_limit', { ascending: false });

      if (error) throw error;

      // ユーザーごとのペルソナ数を取得
      const usersWithPersonaCount = await Promise.all(
        usersData.map(async (user) => {
          const { data: personas } = await supabase
            .from('personas')
            .select('id')
            .eq('user_id', user.user_id);

          // メールアドレスを取得
          const { data: authUser } = await supabase.auth.admin.getUserById(user.user_id);

          return {
            user_id: user.user_id,
            email: authUser.user?.email || 'Unknown',
            display_name: user.profiles?.display_name || 'Unknown',
            persona_limit: user.persona_limit,
            current_personas: personas?.length || 0,
            is_approved: user.is_approved,
            subscription_status: user.subscription_status || 'free'
          };
        })
      );

      setUsers(usersWithPersonaCount);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "エラー",
        description: "ユーザー情報の読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePersonaLimit = async (userId: string, newLimit: number) => {
    if (newLimit < 1) {
      toast({
        title: "エラー",
        description: "ペルソナ上限は1以上である必要があります。",
        variant: "destructive",
      });
      return;
    }

    setUpdatingUserId(userId);
    try {
      const { error } = await supabase
        .from('user_account_status')
        .update({ persona_limit: newLimit })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "成功",
        description: "ペルソナ上限を更新しました。",
      });

      await loadUsers();
    } catch (error) {
      console.error('Error updating persona limit:', error);
      toast({
        title: "エラー",
        description: "ペルソナ上限の更新に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleLimitChange = (userId: string, value: string) => {
    const newLimit = parseInt(value);
    if (!isNaN(newLimit)) {
      updatePersonaLimit(userId, newLimit);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            ペルソナ上限管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">読み込み中...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          ペルソナ上限管理
        </CardTitle>
        <CardDescription>
          ユーザーごとのペルソナ作成上限を設定できます
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map((user) => (
            <div key={user.user_id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium">{user.display_name}</h4>
                  <Badge variant={user.is_approved ? "default" : "secondary"}>
                    {user.is_approved ? "承認済み" : "未承認"}
                  </Badge>
                  <Badge variant="outline">
                    {user.subscription_status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">
                    {user.current_personas} / {user.persona_limit} ペルソナ
                  </span>
                  {user.current_personas >= user.persona_limit && (
                    <Badge variant="destructive">上限達成</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={user.persona_limit}
                  onChange={(e) => handleLimitChange(user.user_id, e.target.value)}
                  className="w-20"
                  disabled={updatingUserId === user.user_id}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updatePersonaLimit(user.user_id, user.persona_limit)}
                  disabled={updatingUserId === user.user_id}
                >
                  {updatingUserId === user.user_id ? "更新中..." : "更新"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
