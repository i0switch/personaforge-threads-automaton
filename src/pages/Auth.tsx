
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PasswordInput } from "@/components/Auth/PasswordInput";
import { useSecureAuth } from "@/hooks/useSecureAuth";

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
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  const { secureSignIn, secureSignUp } = useSecureAuth();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const signInResult = await secureSignIn(email, password);

      if (!signInResult.success) {
        throw new Error(signInResult.error || "ログインに失敗しました。");
      }

      toast({
        title: "ログイン成功",
        description: "ダッシュボードにリダイレクトします。",
      });

    } catch (error: any) {
      console.error("Sign in error:", error);
      setError(error.message || "ログインに失敗しました。");
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

    setIsLoading(true);

    try {
      const signUpResult = await secureSignUp(email, password, displayName);
      if (!signUpResult.success) {
        throw new Error(signUpResult.error || "アカウント作成に失敗しました。");
      }

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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke('send-password-reset', {
        body: { email: resetEmail }
      });

      if (response.error) {
        throw response.error;
      }

      setResetSent(true);
      toast({
        title: "パスワードリセットメール送信完了",
        description: "リセット用のリンクをメールでお送りしました。メールをご確認ください。",
      });

    } catch (error: any) {
      console.error("Password reset error:", error);
      setError(error.message || "パスワードリセットメールの送信に失敗しました。");
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
            Threads-Genius AI
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="signin">ログイン</TabsTrigger>
                <TabsTrigger value="signup">新規登録</TabsTrigger>
                <TabsTrigger value="reset">リセット</TabsTrigger>
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

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "ログイン中..." : "ログイン"}
                  </Button>

                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm"
                      onClick={() => {
                        setActiveTab("reset");
                        if (email) setResetEmail(email);
                      }}
                    >
                      パスワードを忘れた方はこちら
                    </Button>
                  </div>
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

              <TabsContent value="reset">
                {resetSent ? (
                  <div className="text-center space-y-4">
                    <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Mail className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        メールを送信しました
                      </h3>
                      <p className="text-sm text-gray-600 mt-2">
                        {resetEmail} にパスワードリセット用のリンクを送信しました。
                        メールをご確認ください。
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        setResetSent(false);
                        setResetEmail("");
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      別のメールアドレスでリセット
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handlePasswordReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">メールアドレス</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        autoComplete="email"
                      />
                      <p className="text-sm text-gray-600">
                        登録済みのメールアドレスを入力してください。
                        パスワードリセット用のリンクをお送りします。
                      </p>
                    </div>

                    {error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "送信中..." : "リセットリンクを送信"}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
