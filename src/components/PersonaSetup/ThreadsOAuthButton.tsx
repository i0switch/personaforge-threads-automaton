import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MissingFields {
  appId?: boolean;
  appSecret?: boolean;
  notSaved?: boolean;
}

interface ThreadsOAuthButtonProps {
  personaId: string;
  appId: string;
  disabled?: boolean;
  missingFields?: MissingFields;
}

const REDIRECT_URI = 'https://threads-genius-ai.lovable.app/auth/callback';

export const ThreadsOAuthButton = ({ personaId, appId, disabled, missingFields }: ThreadsOAuthButtonProps) => {
  const { toast } = useToast();
  const [showMissingDialog, setShowMissingDialog] = useState(false);

  const hasMissing = missingFields?.appId || missingFields?.appSecret || missingFields?.notSaved;

  const handleOAuth = () => {
    if (hasMissing) {
      setShowMissingDialog(true);
      return;
    }

    if (!appId) {
      toast({
        title: 'エラー',
        description: 'アプリIDを先に設定してください。',
        variant: 'destructive',
      });
      return;
    }

    localStorage.setItem('threads_oauth_persona_id', personaId);
    localStorage.setItem('threads_oauth_redirect_uri', REDIRECT_URI);

    const authUrl = `https://threads.net/oauth/authorize?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=threads_basic,threads_content_publish&response_type=code`;
    window.location.href = authUrl;
  };

  const missingItems: string[] = [];
  if (missingFields?.notSaved) missingItems.push('ペルソナを先に保存してください');
  if (missingFields?.appId) missingItems.push('Threads App ID を入力してください');
  if (missingFields?.appSecret) missingItems.push('Threads App Secret を入力してください');

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleOAuth}
        disabled={disabled}
        className="w-full"
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        Threads OAuth認証でトークンを自動取得
      </Button>

      <Dialog open={showMissingDialog} onOpenChange={setShowMissingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              OAuth認証に必要な情報が不足しています
            </DialogTitle>
            <DialogDescription>
              Threads OAuth認証を行うには、以下の項目を設定してください。
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 mt-2">
            {missingItems.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <Button onClick={() => setShowMissingDialog(false)} className="mt-4 w-full">
            閉じる
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
