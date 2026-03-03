import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const ThreadsOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Threads認証を処理中...');
  const [details, setDetails] = useState<{ persona_name?: string; threads_username?: string; token_expires_at?: string } | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const returnedState = searchParams.get('state');
    const savedState = sessionStorage.getItem('threads_oauth_state');
    const personaId = sessionStorage.getItem('threads_oauth_persona_id');
    const redirectUri = sessionStorage.getItem('threads_oauth_redirect_uri');

    // URLからcodeパラメータを除去（ブラウザ履歴・Referer漏洩防止）
    window.history.replaceState({}, '', '/auth/callback');

    if (!code) {
      setStatus('error');
      setMessage('認証コードが見つかりません。Threads認証画面からリダイレクトされていません。');
      return;
    }

    // CSRF検証: stateパラメータの一致確認
    if (!returnedState || !savedState || returnedState !== savedState) {
      setStatus('error');
      setMessage('セキュリティ検証に失敗しました。ペルソナ設定画面からやり直してください。');
      sessionStorage.removeItem('threads_oauth_state');
      sessionStorage.removeItem('threads_oauth_persona_id');
      sessionStorage.removeItem('threads_oauth_redirect_uri');
      return;
    }

    if (!personaId) {
      setStatus('error');
      setMessage('ペルソナ情報が見つかりません。ペルソナ設定画面からやり直してください。');
      return;
    }

    const exchangeToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('threads-oauth-callback', {
          body: { code, state: returnedState, persona_id: personaId, redirect_uri: redirectUri },
        });

        if (error) throw error;

        if (data?.success) {
          setStatus('success');
          setMessage('Threads認証が完了しました！');
          setDetails(data);
          toast({
            title: '認証成功',
            description: `${data.persona_name || 'ペルソナ'}のThreadsトークンが設定されました。`,
          });
        } else {
          throw new Error(data?.error || 'トークン交換に失敗しました');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        // 内部エラーメッセージの漏洩を防ぐため、汎用メッセージを表示
        setMessage('Threadsトークンの取得に失敗しました。しばらく待ってからやり直してください。');
        toast({
          title: 'エラー',
          description: 'Threads認証に失敗しました',
          variant: 'destructive',
        });
      } finally {
        sessionStorage.removeItem('threads_oauth_state');
        sessionStorage.removeItem('threads_oauth_persona_id');
        sessionStorage.removeItem('threads_oauth_redirect_uri');
      }
    };

    exchangeToken();
  }, [searchParams, toast]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === 'processing' && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
            {status === 'success' && <CheckCircle className="h-6 w-6 text-green-500" />}
            {status === 'error' && <XCircle className="h-6 w-6 text-destructive" />}
            Threads OAuth認証
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className={status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
            {message}
          </p>

          {details && (
            <div className="text-left space-y-2 bg-muted/50 rounded-lg p-4 text-sm">
              {details.persona_name && (
                <p><span className="font-medium">ペルソナ:</span> {details.persona_name}</p>
              )}
              {details.threads_username && (
                <p><span className="font-medium">Threadsユーザー:</span> @{details.threads_username}</p>
              )}
              {details.token_expires_at && (
                <p><span className="font-medium">トークン期限:</span> {new Date(details.token_expires_at).toLocaleDateString('ja-JP')}</p>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-center pt-2">
            <Button onClick={() => navigate('/persona-setup')}>
              ペルソナ設定に戻る
            </Button>
            {status === 'error' && (
              <Button variant="outline" onClick={() => navigate('/persona-setup')}>
                やり直す
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ThreadsOAuthCallback;
