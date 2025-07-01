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
      console.log("Loading users for persona limit management...");
      
      // Get user account status first
      const { data: userAccountData, error: accountError } = await supabase
        .from('user_account_status')
        .select('user_id, persona_limit, is_approved, subscription_status')
        .order('persona_limit', { ascending: false });

      if (accountError) {
        console.error('Error fetching user account status:', accountError);
        throw accountError;
      }

      console.log("User account data:", userAccountData);

      // Get profiles data separately
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      console.log("Profiles data:", profilesData);

      // Process each user
      const usersWithPersonaCount = await Promise.all(
        userAccountData.map(async (account) => {
          console.log(`Processing user: ${account.user_id}`);
          
          // Find corresponding profile
          const profile = profilesData.find(p => p.user_id === account.user_id);
          
          // Get persona count
          const { data: personas, error: personasError } = await supabase
            .from('personas')
            .select('id')
            .eq('user_id', account.user_id);

          if (personasError) {
            console.error(`Error fetching personas for user ${account.user_id}:`, personasError);
          }

          const personaCount = personas?.length || 0;
          console.log(`User ${account.user_id} has ${personaCount} personas`);

          return {
            user_id: account.user_id,
            email: 'Email not available', // Skip email for now due to auth admin issues
            display_name: profile?.display_name || 'Unknown',
            persona_limit: account.persona_limit,
            current_personas: personaCount,
            is_approved: account.is_approved,
            subscription_status: account.subscription_status || 'free'
          };
        })
      );

      console.log("Final users with persona count:", usersWithPersonaCount);
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
