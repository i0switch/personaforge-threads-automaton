
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
  created_at: string;
}

export const PersonaLimitManager = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithPersonaLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [limitInputs, setLimitInputs] = useState<Record<string, number>>({});

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      console.log("Loading users for persona limit management...");
      
      // Get user account status first
      const { data: userAccountData, error: accountError } = await supabase
        .from('user_account_status')
        .select('user_id, persona_limit, is_approved, subscription_status, created_at')
        .order('created_at', { ascending: true });

      if (accountError) {
        console.error('Error fetching user account status:', accountError);
        throw accountError;
      }

      console.log("User account data:", userAccountData);

      // Get profiles data separately
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name');

      // Get user emails for admin
      const { data: emailData, error: emailError } = await supabase
        .rpc('get_user_emails_for_admin');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      if (emailError) {
        console.error('Error fetching emails:', emailError);
        throw emailError;
      }

      console.log("Profiles data:", profilesData);
      console.log("Email data:", emailData);

      // Use the check_persona_limit function for each user to get accurate counts
      const usersWithPersonaCount = await Promise.all(
        userAccountData.map(async (account) => {
          console.log(`Processing user: ${account.user_id}`);
          
          // Find corresponding profile and email
          const profile = profilesData?.find(p => p.user_id === account.user_id);
          const userEmail = emailData?.find(e => e.user_id === account.user_id);
          
          // Use the updated check_persona_limit function
          const { data: limitData, error: limitError } = await supabase
            .rpc('check_persona_limit', { user_id_param: account.user_id });

          let personaCount = 0;
          if (limitError) {
            console.error(`Error checking persona limit for user ${account.user_id}:`, limitError);
          } else if (limitData && limitData.length > 0) {
            personaCount = Number(limitData[0].current_count);
            console.log(`User ${account.user_id} (${profile?.display_name}) has ${personaCount} personas`);
          }

          return {
            user_id: account.user_id,
            email: userEmail?.email || 'Email not available',
            display_name: profile?.display_name || 'Unknown',
            persona_limit: account.persona_limit,
            current_personas: personaCount,
            is_approved: account.is_approved,
            subscription_status: account.subscription_status || 'free',
            created_at: account.created_at
          };
        })
      );

      console.log("Final users with persona count:", usersWithPersonaCount);
      setUsers(usersWithPersonaCount);
      
      // Initialize limit inputs with current values
      const initialLimits: Record<string, number> = {};
      usersWithPersonaCount.forEach(user => {
        initialLimits[user.user_id] = user.persona_limit;
      });
      setLimitInputs(initialLimits);
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

      // Reload the data to reflect changes
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

  const handleLimitInputChange = (userId: string, value: string) => {
    const newLimit = parseInt(value) || 1;
    setLimitInputs(prev => ({
      ...prev,
      [userId]: newLimit
    }));
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
          <Button 
            onClick={loadUsers} 
            variant="outline" 
            className="mb-4"
            disabled={loading}
          >
            データを再読み込み
          </Button>
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
                  value={limitInputs[user.user_id] || user.persona_limit}
                  onChange={(e) => handleLimitInputChange(user.user_id, e.target.value)}
                  className="w-20"
                  disabled={updatingUserId === user.user_id}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updatePersonaLimit(user.user_id, limitInputs[user.user_id] || user.persona_limit)}
                  disabled={updatingUserId === user.user_id || limitInputs[user.user_id] === user.persona_limit}
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
