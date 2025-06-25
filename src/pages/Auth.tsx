
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { validatePassword } from "@/utils/passwordValidation";
import { Bot, Eye, EyeOff } from "lucide-react";

const Auth = () => {
  console.log('Auth component rendered'); // デバッグ用ログ追加
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<Date | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      console.log('User is logged in, redirecting to home');
      navigate("/");
    }
  }, [user, navigate]);

  // Check lockout status
  useEffect(() => {
    if (lockoutTime && new Date() > lockoutTime) {
      setLockoutTime(null);
      setFailedAttempts(0);
    }
  }, [lockoutTime]);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [signupForm, setSignupForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
  });

  const isLockedOut = lockoutTime && new Date() < lockoutTime;
  const lockoutRemaining = lockoutTime ? Math.ceil((lockoutTime.getTime() - new Date().getTime()) / 1000) : 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login attempt');
    
    if (isLockedOut) {
      toast({
        title: "アカウントロック中",
        description: `${lockoutRemaining}秒後に再試行してください。`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signIn(loginForm.email, loginForm.password);
      
      if (error) {
        console.error('Login error:', error);
        setFailedAttempts(prev => prev + 1);
        
        // Lock account after 5 failed attempts
        if (failedAttempts >= 4) {
          const lockDuration = Math.min(300, 60 * Math.pow(2, failedAttempts - 4));
          setLockoutTime(new Date(Date.now() + lockDuration * 1000));
          toast({
            title: "アカウントロック",
            description: `ログイン試行回数が上限に達しました。${lockDuration}秒後に再試行してください。`,
            variant: "destructive",
          });
        } else {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "ログインエラー",
              description: `メールアドレスまたはパスワードが正しくありません。残り試行回数: ${5 - failedAttempts - 1}回`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "ログインエラー", 
              description: error.message,
              variant: "destructive",
            });
          }
        }
      } else {
        setFailedAttempts(0);
        setLockoutTime(null);
        toast({
          title: "ログイン成功",
          description: "正常にログインしました。",
        });
        navigate("/");
      }
    } catch (error) {
      console.error('Unexpected login error:', error);
      toast({
        title: "エラー",
        description: "予期しないエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Signup attempt');
    
    if (signupForm.password !== signupForm.confirmPassword) {
      toast({
        title: "パスワードエラー",
        description: "パスワードが一致しません。",
        variant: "destructive",
      });
      return;
    }

    // Enhanced password validation
    const passwordValidation = validatePassword(signupForm.password);
    if (!passwordValidation.isValid) {
      toast({
        title: "パスワードエラー",
        description: passwordValidation.errors[0],
        variant: "destructive",
      });
      return;
    }

    if (!signupForm.displayName.trim()) {
      toast({
        title: "入力エラー",
        description: "ユーザー名を入力してください。",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signUp(signupForm.email, signupForm.password, signupForm.displayName);
      
      if (error) {
        console.error('Signup error:', error);
        if (error.message.includes("User already registered")) {
          toast({
            title: "サインアップエラー",
            description: "このメールアドレスは既に登録されています。",
            variant: "destructive",
          });
        } else {
          toast({
            title: "サインアップエラー",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "サインアップ成功",
          description: "アカウントが作成されました。確認メールをご確認ください。",
        });
      }
    } catch (error) {
      console.error('Unexpected signup error:', error);
      toast({
        title: "エラー",
        description: "予期しないエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  console.log('Rendering auth page content');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary p-3 rounded-lg">
              <Bot className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Threads-Genius AI</h1>
          <p className="text-muted-foreground">Gemini搭載Threads自動運用ツール</p>
        </div>

        {isLockedOut && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
            <p className="text-red-800 font-medium">アカウントがロックされています</p>
            <p className="text-red-600 text-sm">{lockoutRemaining}秒後に再試行可能</p>
          </div>
        )}

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">ログイン</TabsTrigger>
            <TabsTrigger value="signup">サインアップ</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>ログイン</CardTitle>
                <CardDescription>
                  アカウントにログインしてください
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">メールアドレス</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="your@email.com"
                      required
                      disabled={isLockedOut}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">パスワード</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        value={loginForm.password}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="パスワード"
                        required
                        disabled={isLockedOut}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLockedOut}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading || isLockedOut}>
                    {isLoading ? "ログイン中..." : "ログイン"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card>
              <CardHeader>
                <CardTitle>サインアップ</CardTitle>
                <CardDescription>
                  新しいアカウントを作成してください
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-display-name">ユーザー名</Label>
                    <Input
                      id="signup-display-name"
                      type="text"
                      value={signupForm.displayName}
                      onChange={(e) => setSignupForm(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="山田太郎"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">メールアドレス</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">パスワード</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        value={signupForm.password}
                        onChange={(e) => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="パスワード（8文字以上、複雑性要件）"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <PasswordStrengthIndicator password={signupForm.password} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">パスワード確認</Label>
                    <div className="relative">
                      <Input
                        id="signup-confirm"
                        type={showConfirmPassword ? "text" : "password"}
                        value={signupForm.confirmPassword}
                        onChange={(e) => setSignupForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="パスワードを再入力"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "作成中..." : "アカウント作成"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Auth;
