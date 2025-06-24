
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Copy, RefreshCw } from 'lucide-react';

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

      if (error) throw error;
      setPersonas(data || []);
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
    return `${window.location.origin}/functions/v1/threads-webhook?persona_id=${personaId}`;
  };

  if (loading) {
    return <div>読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      {personas.map((persona) => (
        <Card key={persona.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{persona.name}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateWebhookToken(persona.id)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                トークン再生成
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

            <p className="text-sm text-gray-600">
              Meta for DevelopersのWebhook設定で、このペルソナ専用のWebhook URLとVerify Tokenを使用してください。
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
