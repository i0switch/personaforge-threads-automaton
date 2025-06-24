
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export const AccountTab = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast({
        title: "ログアウト",
        description: "正常にログアウトしました。",
      });
      // ログアウト後にホームページにリダイレクト
      navigate("/");
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "ログアウトエラー",
        description: "ログアウト中にエラーが発生しましたが、セッションをクリアしました。",
        variant: "destructive",
      });
      // エラーが発生してもホームページにリダイレクト
      navigate("/");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>アカウント管理</CardTitle>
        <CardDescription>
          アカウントの基本操作
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>アカウント情報</Label>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <span className="font-medium">メールアドレス:</span> {user?.email}
            </p>
            <p className="text-sm">
              <span className="font-medium">登録日:</span> {new Date(user?.created_at || '').toLocaleDateString('ja-JP')}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <Button 
            onClick={handleSignOut}
            variant="destructive"
            disabled={isSigningOut}
          >
            {isSigningOut ? "ログアウト中..." : "ログアウト"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
