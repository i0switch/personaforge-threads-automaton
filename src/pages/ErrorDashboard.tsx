import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  ExternalLink,
  RefreshCw,
  XCircle,
  AlertCircle,
  Settings,
  User
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTokenHealth } from "@/hooks/useTokenHealth";

interface ErrorItem {
  id: string;
  type: string;
  category: string;
  message: string;
  details: any;
  created_at: string;
  severity: 'high' | 'medium' | 'low';
  solution: string;
  actionText: string;
  actionPath?: string;
}

const ErrorDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tokenStatuses, checkAllTokens } = useTokenHealth();
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (user) {
      checkForErrors();
    }
  }, [user]);

  const checkForErrors = async () => {
    if (!user) return;
    
    setChecking(true);
    
    // トークンヘルスチェックを最新に更新
    await checkAllTokens();
    
    try {
      const errorItems: ErrorItem[] = [];
      
      // セキュリティイベントからエラーを取得（過去24時間）
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      
      const { data: securityEvents, error: securityError } = await supabase
        .from('security_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .order('created_at', { ascending: false });

      if (!securityError && securityEvents) {
        // Threads投稿エラーをチェック
        const threadErrors = securityEvents.filter(event => 
          event.event_type === 'threads_post_error' || 
          (event.details && typeof event.details === 'object' && event.details !== null && 
           'error_type' in event.details && event.details.error_type === 'threads_post_failed')
        );
        
        threadErrors.forEach(event => {
          let severity: 'high' | 'medium' | 'low' = 'medium';
          let solution = "投稿内容を確認し、再試行してください。";
          let actionText = "投稿を確認";
          let actionPath = "/scheduled-posts";
          
          const details = event.details as any;
          const errorMessage = details?.error_message as string;
          
          if (errorMessage?.includes('500 characters')) {
            severity = 'high';
            solution = "投稿内容が500文字を超えています。内容を短縮してください。";
            actionText = "投稿を編集";
          } else if (errorMessage?.includes('access token')) {
            severity = 'high';
            solution = "アクセストークンが無効です。ペルソナ設定で再認証してください。";
            actionText = "ペルソナ設定";
            actionPath = "/persona-setup";
          }
          
          errorItems.push({
            id: event.id,
            type: 'threads_error',
            category: 'Threads投稿エラー',
            message: errorMessage || 'Threads投稿でエラーが発生しました',
            details: event.details,
            created_at: event.created_at,
            severity,
            solution,
            actionText,
            actionPath
          });
        });

        // 認証エラーをチェック
        const authErrors = securityEvents.filter(event => 
          event.event_type === 'authentication_error' || 
          event.event_type === 'token_error'
        );
        
        authErrors.forEach(event => {
          errorItems.push({
            id: event.id,
            type: 'auth_error',
            category: '認証エラー',
            message: 'アクセストークンの認証に失敗しました',
            details: event.details,
            created_at: event.created_at,
            severity: 'high',
            solution: "ペルソナ設定でThreadsアカウントの再認証を行ってください。",
            actionText: "再認証",
            actionPath: "/persona-setup"
          });
        });
      }

      // ペルソナ設定不備をチェック
      const { data: personas, error: personaError } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (!personaError && personas) {
        personas.forEach(persona => {
          // トークンヘルスチェック結果を確認
          const tokenStatus = tokenStatuses.find(status => status.personaId === persona.id);
          
          if (!persona.threads_access_token || !persona.threads_user_id) {
            errorItems.push({
              id: `persona_${persona.id}`,
              type: 'persona_config',
              category: 'ペルソナ設定不備',
              message: `${persona.name}のThreads連携が未完了です`,
              details: { persona_name: persona.name, persona_id: persona.id },
              created_at: persona.updated_at,
              severity: 'medium',
              solution: "ペルソナ設定でThreadsアカウントとの連携を完了してください。",
              actionText: "設定完了",
              actionPath: "/persona-setup"
            });
          } else if (tokenStatus && !tokenStatus.isHealthy) {
            // トークンが設定されているが無効な場合
            errorItems.push({
              id: `token_${persona.id}`,
              type: 'token_invalid',
              category: 'トークンエラー',
              message: `${persona.name}のThreadsトークンが無効です`,
              details: { 
                persona_name: persona.name, 
                persona_id: persona.id,
                error: tokenStatus.error,
                last_checked: tokenStatus.lastChecked
              },
              created_at: new Date().toISOString(),
              severity: 'high',
              solution: "Threadsトークンの有効期限が切れているか、権限が取り消されています。ペルソナ設定で再認証を行ってください。",
              actionText: "再認証",
              actionPath: "/persona-setup"
            });
          }
        });
      }

      setErrors(errorItems);
      
      if (errorItems.length === 0) {
        toast.success("エラーは検出されませんでした");
      } else {
        toast.warning(`${errorItems.length}件のエラーが検出されました`);
      }
      
    } catch (error) {
      console.error('Error checking for errors:', error);
      toast.error("エラーチェック中に問題が発生しました");
    } finally {
      setChecking(false);
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <XCircle className="h-5 w-5 text-red-600" />;
      case 'medium': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'low': return <AlertCircle className="h-5 w-5 text-blue-600" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-stone-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="flex items-center gap-2 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
              戻る
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">エラー状況確認</h1>
              <p className="text-gray-600">現在発生しているエラーと対応方法を確認できます</p>
            </div>
          </div>
          <Button
            onClick={checkForErrors}
            disabled={checking}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'チェック中...' : '再チェック'}
          </Button>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-0 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-800">
                    {errors.filter(e => e.severity === 'low').length}
                  </p>
                  <p className="text-green-700">軽微なエラー</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 bg-gradient-to-r from-yellow-50 to-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold text-yellow-800">
                    {errors.filter(e => e.severity === 'medium').length}
                  </p>
                  <p className="text-yellow-700">要注意エラー</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 bg-gradient-to-r from-red-50 to-rose-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-800">
                    {errors.filter(e => e.severity === 'high').length}
                  </p>
                  <p className="text-red-700">緊急対応エラー</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error List */}
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">エラーをチェック中...</p>
            </CardContent>
          </Card>
        ) : errors.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
              <h3 className="text-xl font-semibold text-green-800 mb-2">
                エラーは検出されませんでした
              </h3>
              <p className="text-green-700">
                すべてのシステムが正常に動作しています
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {errors.map((error) => (
              <Card key={error.id} className="border-l-4 border-l-red-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(error.severity)}
                      <div>
                        <CardTitle className="text-lg text-gray-800">
                          {error.category}
                        </CardTitle>
                        <CardDescription className="text-gray-600">
                          {error.message}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getSeverityColor(error.severity)}>
                        {error.severity === 'high' ? '緊急' : 
                         error.severity === 'medium' ? '注意' : '軽微'}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        {new Date(error.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Alert className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>対応方法：</strong> {error.solution}
                    </AlertDescription>
                  </Alert>
                  
                  {error.actionPath && (
                    <Button
                      onClick={() => navigate(error.actionPath!)}
                      className="flex items-center gap-2"
                      variant={error.severity === 'high' ? 'default' : 'outline'}
                    >
                      {error.type === 'persona_config' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Settings className="h-4 w-4" />
                      )}
                      {error.actionText}
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}

                  {error.details && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                        詳細情報を表示
                      </summary>
                      <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                        {JSON.stringify(error.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorDashboard;