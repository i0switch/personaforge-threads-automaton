
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
    console.log('Loading admin stats...');
    try {
      // 新しいRPC関数を使用して正確な統計を取得
      const { data, error } = await supabase.rpc('get_user_stats').single();

      if (error) {
        console.error('Stats error:', error);
        throw error;
      }

      console.log('Stats from RPC:', data);

      const calculatedStats = {
        totalUsers: Number(data.total_users) || 0,
        approvedUsers: Number(data.approved_users) || 0,
        pendingUsers: Number(data.pending_users) || 0,
        activeSubscriptions: Number(data.active_subscriptions) || 0
      };

      console.log('Calculated stats:', calculatedStats);
      setStats(calculatedStats);
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
