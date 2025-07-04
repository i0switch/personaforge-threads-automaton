import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, UserCheck, UserX, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface UserAccount {
  user_id: string;
  email: string;
  display_name: string;
  is_approved: boolean;
  is_active: boolean;
  subscription_status: string;
  created_at: string;
  approved_at: string | null;
}

export const UserManagementTable = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    console.log('Loading users...');
    try {
      // プロフィール情報を取得
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, created_at')
        .order('created_at', { ascending: true });

      if (profilesError) {
        console.error('Profiles error:', profilesError);
        throw profilesError;
      }

      console.log('Profiles data:', profilesData);

      // アカウント状態を取得
      const { data: accountStatusData, error: statusError } = await supabase
        .from('user_account_status')
        .select('user_id, is_approved, is_active, subscription_status, approved_at');

      // 管理者のメールアドレス取得
      const { data: emailData, error: emailError } = await supabase
        .rpc('get_user_emails_for_admin');

      if (statusError) {
        console.error('Account status error:', statusError);
        throw statusError;
      }

      if (emailError) {
        console.error('Email error:', emailError);
        throw emailError;
      }

      console.log('Account status data:', accountStatusData);
      console.log('Email data:', emailData);

      let combinedData: UserAccount[] = [];

      // プロフィールベースでデータを構築（メールアドレスは代替表示）
      if (profilesData) {
        combinedData = profilesData.map(profile => {
          const accountStatus = accountStatusData?.find(s => s.user_id === profile.user_id);
          const userEmail = emailData?.find(e => e.user_id === profile.user_id);
          const shortUserId = profile.user_id.slice(0, 8);
          
          return {
            user_id: profile.user_id,
            email: userEmail?.email || `user-${shortUserId}@internal.app`,
            display_name: profile.display_name || `User ${shortUserId}`,
            is_approved: accountStatus?.is_approved ?? false,
            is_active: accountStatus?.is_active ?? false,
            subscription_status: accountStatus?.subscription_status || 'free',
            created_at: profile.created_at,
            approved_at: accountStatus?.approved_at || null
          };
        });
      }

      console.log('Final combined user data:', combinedData);
      setUsers(combinedData);
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

  const updateUserStatus = async (userId: string, field: 'is_approved' | 'is_active', value: boolean) => {
    console.log(`Updating user ${userId} ${field} to ${value}`);
    setUpdating(userId);
    
    try {
      const currentUser = users.find(u => u.user_id === userId);
      const updateData: any = {
        user_id: userId,
        subscription_status: currentUser?.subscription_status || 'free',
      };
      
      // 承認の場合の特別処理
      if (field === 'is_approved') {
        updateData.is_approved = value;
        if (value) {
          updateData.approved_at = new Date().toISOString();
          updateData.approved_by = user?.id;
          // 承認時は必ずアクティブにする
          updateData.is_active = true;
        } else {
          updateData.approved_at = null;
          updateData.approved_by = null;
          updateData.is_active = currentUser?.is_active ?? false;
        }
      } else {
        updateData.is_approved = currentUser?.is_approved ?? false;
        updateData.is_active = value;
      }

      console.log('Update data being sent:', updateData);

      // upsertを使用して確実にデータを更新
      const { error } = await supabase
        .from('user_account_status')
        .upsert(updateData, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      console.log('Status updated successfully');

      toast({
        title: "成功",
        description: `ユーザーの${field === 'is_approved' ? '承認' : 'アクティブ'}状態を更新しました。`,
      });

      // ローカル状態を即座に更新
      setUsers(prevUsers => 
        prevUsers.map(u => {
          if (u.user_id === userId) {
            const updatedUser = { ...u };
            if (field === 'is_approved') {
              updatedUser.is_approved = value;
              updatedUser.approved_at = value ? new Date().toISOString() : null;
              if (value) {
                updatedUser.is_active = true; // 承認時は自動的にアクティブ
              }
            } else {
              updatedUser.is_active = value;
            }
            return updatedUser;
          }
          return u;
        })
      );

    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: "エラー",
        description: "ユーザー状態の更新に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const updateSubscriptionStatus = async (userId: string, subscriptionStatus: string) => {
    console.log(`Updating subscription for user ${userId} to ${subscriptionStatus}`);
    setUpdating(userId);
    
    try {
      const currentUser = users.find(u => u.user_id === userId);
      const { error } = await supabase
        .from('user_account_status')
        .upsert({
          user_id: userId,
          is_approved: currentUser?.is_approved ?? false,
          is_active: currentUser?.is_active ?? false,
          subscription_status: subscriptionStatus
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "成功",
        description: "課金ステータスを更新しました。",
      });

      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.user_id === userId 
            ? { ...u, subscription_status: subscriptionStatus }
            : u
        )
      );

    } catch (error) {
      console.error('Error updating subscription status:', error);
      toast({
        title: "エラー",
        description: "課金ステータスの更新に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('このユーザーを完全に削除しますか？この操作は取り消せません。')) {
      return;
    }

    setUpdating(userId);
    try {
      // Delete from profiles table (this will cascade due to foreign keys)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "成功",
        description: "ユーザーを削除しました。",
      });

      // Remove from local state
      setUsers(prevUsers => prevUsers.filter(u => u.user_id !== userId));

    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "エラー",
        description: "ユーザー削除に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "approved") return matchesSearch && user.is_approved;
    if (statusFilter === "pending") return matchesSearch && !user.is_approved;
    if (statusFilter === "active") return matchesSearch && user.is_active;
    if (statusFilter === "inactive") return matchesSearch && !user.is_active;
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>ユーザー情報を読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and filter controls */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ユーザー名またはメールアドレスで検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="ステータスで絞り込み" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="approved">承認済み</SelectItem>
            <SelectItem value="pending">承認待ち</SelectItem>
            <SelectItem value="active">アクティブ</SelectItem>
            <SelectItem value="inactive">非アクティブ</SelectItem>
          </SelectContent>
        </Select>
      </div>


      {/* Users table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ユーザー名</TableHead>
              <TableHead>メールアドレス</TableHead>
              <TableHead>承認状態</TableHead>
              <TableHead>アクティブ状態</TableHead>
              <TableHead>課金ステータス</TableHead>
              <TableHead>登録日</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((userAccount) => (
              <TableRow key={userAccount.user_id}>
                <TableCell className="font-medium">
                  {userAccount.display_name}
                </TableCell>
                <TableCell>{userAccount.email}</TableCell>
                <TableCell>
                  <Badge variant={userAccount.is_approved ? "default" : "secondary"}>
                    {userAccount.is_approved ? "承認済み" : "承認待ち"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={userAccount.is_active ? "default" : "destructive"}>
                    {userAccount.is_active ? "アクティブ" : "非アクティブ"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select
                    value={userAccount.subscription_status}
                    onValueChange={(value) => updateSubscriptionStatus(userAccount.user_id, value)}
                    disabled={updating === userAccount.user_id}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">無料</SelectItem>
                      <SelectItem value="basic">ベーシック</SelectItem>
                      <SelectItem value="premium">プレミアム</SelectItem>
                      <SelectItem value="enterprise">エンタープライズ</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {new Date(userAccount.created_at).toLocaleDateString('ja-JP')}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={userAccount.is_approved ? "outline" : "default"}
                      onClick={() => updateUserStatus(userAccount.user_id, 'is_approved', !userAccount.is_approved)}
                      disabled={updating === userAccount.user_id}
                    >
                      {updating === userAccount.user_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : userAccount.is_approved ? (
                        <>
                          <UserX className="h-4 w-4 mr-1" />
                          承認取消
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4 mr-1" />
                          承認
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant={userAccount.is_active ? "destructive" : "default"}
                      onClick={() => updateUserStatus(userAccount.user_id, 'is_active', !userAccount.is_active)}
                      disabled={updating === userAccount.user_id}
                    >
                      {updating === userAccount.user_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : userAccount.is_active ? (
                        <>
                          <UserX className="h-4 w-4 mr-1" />
                          無効化
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4 mr-1" />
                          有効化
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteUser(userAccount.user_id)}
                      disabled={updating === userAccount.user_id}
                    >
                      {updating === userAccount.user_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-1" />
                          削除
                        </>
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          条件に一致するユーザーが見つかりません。
        </div>
      )}
    </div>
  );
};
