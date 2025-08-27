
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useTokenHealth } from '@/hooks/useTokenHealth';

interface Persona {
  id: string;
  name: string;
  webhook_verify_token: string;
  threads_app_id: string;
  threads_app_secret: string;
}

export const PersonaWebhookSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(false);
  const { tokenStatuses, loading: tokenLoading, checkAllTokens } = useTokenHealth();

  useEffect(() => {
    if (user) {
      fetchPersonas();
    }
  }, [user]);

  const fetchPersonas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('personas')
        .select('id, name, webhook_verify_token, threads_app_id, threads_app_secret')
        .eq('user_id', user!.id)
        .eq('is_active', true);

      if (error) {
        console.error('[PersonaWebhookSettings] supabase error', error);
        setPersonas([]);
        return;
      }
      setPersonas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching personas:', error);
      toast({
        title: 'エラー',
        description: 'ペルソナの取得に失敗しました',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const generateWebhookToken = async (personaId: string) => {
    try {
      const token = crypto.randomUUID();
      const { error } = await supabase
        .from('personas')
        .update({ webhook_verify_token: token })
        .eq('id', personaId)
        .eq('user_id', user!.id);

      if (error) throw error;
      
      await fetchPersonas();
      toast({
        title: '成功',
        description: 'Webhook Verify Tokenを生成しました'
      });
    } catch (error) {
      console.error('Error generating token:', error);
      toast({
        title: 'エラー',
        description: 'トークンの生成に失敗しました',
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: '成功',
      description: 'クリップボードにコピーしました'
    });
  };

  const getWebhookUrl = (personaId: string) => {
    // 正しいSupabase Edge FunctionのURLを生成
    const supabaseUrl = 'https://tqcgbsnoiarnawnppwia.supabase.co';
    return `${supabaseUrl}/functions/v1/threads-webhook?persona_id=${personaId}`;
  };

  const getTokenHealthBadge = (personaId: string) => {
    const tokenStatus = tokenStatuses.find(status => status.personaId === personaId);
    
    if (!tokenStatus) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          チェック中
        </Badge>
      );
    }

    if (tokenStatus.isHealthy) {
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="h-3 w-3" />
          正常
        </Badge>
      );
    }

    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        異常
      </Badge>
    );
  };

  if (loading) {
    return <div>読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">ペルソナ別Webhook設定</h3>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={checkAllTokens}
            disabled={tokenLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${tokenLoading ? 'animate-spin' : ''}`} />
            トークン状態確認
          </Button>
        </div>
      </div>
      
      {personas.map((persona) => (
        <Card key={persona.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>{persona.name}</span>
                {getTokenHealthBadge(persona.id)}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateWebhookToken(persona.id)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Webhook再生成
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Webhook URL（このペルソナ専用）</Label>
              <div className="flex space-x-2">
                <Input 
                  value={getWebhookUrl(persona.id)}
                  readOnly
                  className="bg-gray-50"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(getWebhookUrl(persona.id))}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Webhook Verify Token</Label>
              <div className="flex space-x-2">
                <Input 
                  value={persona.webhook_verify_token || '未生成'}
                  readOnly
                  className="bg-gray-50"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(persona.webhook_verify_token || '')}
                  disabled={!persona.webhook_verify_token}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>App ID</Label>
                <Input 
                  value={persona.threads_app_id || '未設定'}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <div className="space-y-2">
                <Label>App Secret</Label>
                <Input 
                  value={persona.threads_app_secret ? '設定済み' : '未設定'}
                  readOnly
                  className="bg-gray-50"
                  type="password"
                />
              </div>
            </div>

            {/* Token Status Details */}
            {tokenStatuses.find(s => s.personaId === persona.id)?.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800 font-medium">トークンエラー:</p>
                <p className="text-sm text-red-700">
                  {tokenStatuses.find(s => s.personaId === persona.id)?.error}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  ペルソナ設定画面でThreadsアクセストークンを再設定してください。
                </p>
              </div>
            )}

            <p className="text-sm text-gray-600">
              Meta for DevelopersのWebhook設定で、このペルソナ専用のWebhook URLとVerify Tokenを使用してください。
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export { PersonaWebhookSettings as default };
