import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ThreadsOAuthButtonProps {
  personaId: string;
  appId: string;
  disabled?: boolean;
}

const REDIRECT_URI = 'https://threads-genius-ai.lovable.app/auth/callback';

export const ThreadsOAuthButton = ({ personaId, appId, disabled }: ThreadsOAuthButtonProps) => {
  const { toast } = useToast();

  const handleOAuth = () => {
    if (!appId) {
      toast({
        title: 'エラー',
        description: 'アプリIDを先に設定してください。',
        variant: 'destructive',
      });
      return;
    }

    // コールバックで使用するためにlocalStorageに保存
    localStorage.setItem('threads_oauth_persona_id', personaId);
    localStorage.setItem('threads_oauth_redirect_uri', REDIRECT_URI);

    const authUrl = `https://threads.net/oauth/authorize?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=threads_basic,threads_content_publish&response_type=code`;

    window.location.href = authUrl;
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleOAuth}
      disabled={disabled || !appId}
      className="w-full"
    >
      <ExternalLink className="h-4 w-4 mr-2" />
      Threads OAuth認証でトークンを自動取得
    </Button>
  );
};
