import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PasswordInput } from "@/components/Auth/PasswordInput";
import { useAuth } from "@/contexts/AuthContext";

const PasswordReset = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Extract tokens from URL parameters
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");
  const type = searchParams.get("type");

  useEffect(() => {
    // If user is already logged in, redirect to home
    if (user) {
      navigate("/");
      return;
    }

    // Check if we have the required tokens
    if (!accessToken || !refreshToken || type !== "recovery") {
      setError("無効なパスワードリセットリンクです。再度リセットを実行してください。");
      return;
    }

    // Set the session with the tokens from URL
    const setSessionFromTokens = async () => {
      try {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error("Session setup error:", error);
          setError("リセットリンクが無効または期限切れです。");
        }
      } catch (error) {
        console.error("Token validation error:", error);
        setError("パスワードリセットの検証に失敗しました。");
      }
    };

    setSessionFromTokens();
  }, [user, navigate, accessToken, refreshToken, type]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validate passwords
    if (password !== confirmPassword) {
      setError("パスワードが一致しません。");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください。");
      setIsLoading(false);
      return;
    }

    try {
      // Update user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      
      toast({
        title: "パスワード更新完了",
        description: "パスワードが正常に更新されました。ログインページにリダイレクトします。",
      });

      // Sign out after password reset to force fresh login
      await supabase.auth.signOut();
      
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate("/auth");
      }, 3000);

    } catch (error: any) {
      console.error("Password reset error:", error);
      setError(error.message || "パスワードの更新に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-green-800">パスワード更新完了</CardTitle>
              <CardDescription>
                パスワードが正常に更新されました。まもなくログインページにリダイレクトします。
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            パスワードリセット
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            新しいパスワードを設定してください
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>新しいパスワード</CardTitle>
            <CardDescription>
              安全なパスワードを設定してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">新しいパスワード</Label>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  placeholder="新しいパスワード（6文字以上）"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">パスワード確認</Label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="パスワードを再入力"
                  required
                  autoComplete="new-password"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !accessToken}
              >
                {isLoading ? "更新中..." : "パスワードを更新"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Button
                variant="link"
                onClick={() => navigate("/auth")}
                className="text-sm"
              >
                ログインページに戻る
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PasswordReset;