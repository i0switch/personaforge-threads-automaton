
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalUsers: number;
  approvedUsers: number;
  pendingUsers: number;
  activeSubscriptions: number;
}

export const AdminStats = () => {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    approvedUsers: 0,
    pendingUsers: 0,
    activeSubscriptions: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // プロフィールの総数を取得（総ユーザー数）
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id');

      if (profilesError) throw profilesError;

      // アカウント状態を取得
      const { data: accountStatuses, error: statusError } = await supabase
        .from('user_account_status')
        .select('user_id, is_approved, is_active, subscription_status');

      if (statusError) throw statusError;

      const totalUsers = profiles?.length || 0;
      
      // アカウント状態が存在するユーザーの統計
      const approvedUsers = accountStatuses?.filter(u => u.is_approved).length || 0;
      
      // 承認待ちユーザー = 総ユーザー数 - 承認済みユーザー数
      const pendingUsers = totalUsers - approvedUsers;
      
      const activeSubscriptions = accountStatuses?.filter(u => 
        u.subscription_status && u.subscription_status !== 'free'
      ).length || 0;

      setStats({
        totalUsers,
        approvedUsers,
        pendingUsers,
        activeSubscriptions
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "総ユーザー数",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-600"
    },
    {
      title: "承認済みユーザー",
      value: stats.approvedUsers,
      icon: UserCheck,
      color: "text-green-600"
    },
    {
      title: "承認待ちユーザー",
      value: stats.pendingUsers,
      icon: UserX,
      color: "text-orange-600"
    },
    {
      title: "有料プラン",
      value: stats.activeSubscriptions,
      icon: CreditCard,
      color: "text-purple-600"
    }
  ];

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
