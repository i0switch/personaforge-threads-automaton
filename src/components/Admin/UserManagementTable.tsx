
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, UserCheck, UserX, Shield, Loader2 } from "lucide-react";
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
    try {
      // まずプロフィール情報を取得
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, created_at');

      if (profilesError) throw profilesError;

      // 次にアカウント状態を別々に取得
      const { data: accountStatusData, error: statusError } = await supabase
        .from('user_account_status')
        .select('user_id, is_approved, is_active, subscription_status, approved_at');

      if (statusError) throw statusError;

      // 認証ユーザー情報を取得（管理者権限が必要）
      let authUsers: any[] = [];
      try {
        const { data: { users: fetchedUsers }, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) {
          console.warn('Could not fetch auth users:', authError);
        } else {
          authUsers = fetchedUsers || [];
        }
      } catch (error) {
        console.warn('Auth admin access not available:', error);
      }

      // データを結合
      const combinedData = profilesData?.map(profile => {
        const authUser = authUsers.find(u => u.id === profile.user_id);
        const accountStatus = accountStatusData?.find(s => s.user_id === profile.user_id);
        
        return {
          user_id: profile.user_id,
          email: authUser?.email || `user-${profile.user_id.slice(0, 8)}@hidden.com`,
          display_name: profile.display_name || 'Unknown',
          is_approved: accountStatus?.is_approved || false,
          is_active: accountStatus?.is_active || false,
          subscription_status: accountStatus?.subscription_status || 'free',
          created_at: profile.created_at,
          approved_at: accountStatus?.approved_at || null
        };
      }) || [];

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
    setUpdating(userId);
    try {
      const updateData: any = { [field]: value };
      
      // 承認の場合は承認日時と承認者も記録
      if (field === 'is_approved' && value) {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user?.id;
        // 承認時は自動的にアクティブにする
        updateData.is_active = true;
      }

      // user_account_statusレコードが存在するかチェック
      const { data: existingStatus } = await supabase
        .from('user_account_status')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingStatus) {
        // レコードが存在しない場合は新規作成
        const { error: insertError } = await supabase
          .from('user_account_status')
          .insert({
            user_id: userId,
            ...updateData
          });

        if (insertError) throw insertError;
      } else {
        // レコードが存在する場合は更新
        const { error: updateError } = await supabase
          .from('user_account_status')
          .update(updateData)
          .eq('user_id', userId);

        if (updateError) throw updateError;
      }

      toast({
        title: "成功",
        description: `ユーザーの${field === 'is_approved' ? '承認' : 'アクティブ'}状態を更新しました。`,
      });

      await loadUsers();
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
    setUpdating(userId);
    try {
      // user_account_statusレコードが存在するかチェック
      const { data: existingStatus } = await supabase
        .from('user_account_status')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingStatus) {
        // レコードが存在しない場合は新規作成
        const { error: insertError } = await supabase
          .from('user_account_status')
          .insert({
            user_id: userId,
            subscription_status: subscriptionStatus
          });

        if (insertError) throw insertError;
      } else {
        // レコードが存在する場合は更新
        const { error: updateError } = await supabase
          .from('user_account_status')
          .update({ subscription_status: subscriptionStatus })
          .eq('user_id', userId);

        if (updateError) throw updateError;
      }

      toast({
        title: "成功",
        description: "課金ステータスを更新しました。",
      });

      await loadUsers();
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
                    {!userAccount.is_approved && (
                      <Button
                        size="sm"
                        onClick={() => updateUserStatus(userAccount.user_id, 'is_approved', true)}
                        disabled={updating === userAccount.user_id}
                      >
                        {updating === userAccount.user_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={userAccount.is_active ? "destructive" : "default"}
                      onClick={() => updateUserStatus(userAccount.user_id, 'is_active', !userAccount.is_active)}
                      disabled={updating === userAccount.user_id}
                    >
                      {updating === userAccount.user_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : userAccount.is_active ? (
                        <UserX className="h-4 w-4" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
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
