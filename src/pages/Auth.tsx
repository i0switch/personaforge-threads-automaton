
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PasswordInput } from "@/components/Auth/PasswordInput";
import { enhancedSecurity } from "@/utils/enhancedSecurity";

const Auth = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const checkBruteForce = async (email: string) => {
    const blocked = await enhancedSecurity.checkBruteForceAttempts(email);
    setIsBlocked(blocked);
    return blocked;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Check for brute force attempts
      const blocked = await checkBruteForce(email);
      if (blocked) {
        setError("アカウントが一時的にロックされています。15分後に再試行してください。");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Log login attempt
      await enhancedSecurity.logLoginAttempt({
        email,
        success: !signInError,
        timestamp: new Date()
      });

      if (signInError) {
        throw signInError;
      }

      toast({
        title: "ログイン成功",
        description: "ダッシュボードにリダイレクトします。",
      });

    } catch (error: any) {
      console.error("Sign in error:", error);
      setError(error.message || "ログインに失敗しました。");
      
      // Log failed login attempt
      await enhancedSecurity.logLoginAttempt({
        email,
        success: false,
        timestamp: new Date()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("パスワードが一致しません。");
      return;
    }

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください。");
      return;
    }

    setIsLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      // Log successful signup
      await enhancedSecurity.logSecurityEvent({
        event_type: 'user_signup',
        details: {
          email,
          display_name: displayName,
          timestamp: new Date().toISOString()
        }
      });

      toast({
        title: "アカウント作成完了",
        description: "確認メールを送信しました。メールを確認してアカウントを有効化してください。",
      });

    } catch (error: any) {
      console.error("Sign up error:", error);
      setError(error.message || "アカウント作成に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            ソーシャルメディア自動化プラットフォーム
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            アカウントにログインするか、新規作成してください
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>認証</CardTitle>
            <CardDescription>
              ログインまたは新規アカウントを作成
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">ログイン</TabsTrigger>
                <TabsTrigger value="signup">新規登録</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">メールアドレス</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      autoComplete="email"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">パスワード</Label>
                    <PasswordInput
                      value={password}
                      onChange={setPassword}
                      placeholder="パスワード"
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {isBlocked && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        セキュリティのため、このアカウントは一時的にロックされています。
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading || isBlocked}>
                    {isLoading ? "ログイン中..." : "ログイン"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">表示名</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="山田太郎"
                      required
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">メールアドレス</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      autoComplete="email"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">パスワード</Label>
                    <PasswordInput
                      value={password}
                      onChange={setPassword}
                      placeholder="パスワード（6文字以上）"
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">パスワード確認</Label>
                    <PasswordInput
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="パスワードを再入力"
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "作成中..." : "アカウント作成"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
