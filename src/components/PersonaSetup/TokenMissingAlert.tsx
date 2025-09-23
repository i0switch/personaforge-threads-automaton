import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const TokenMissingAlert = () => {
  const { user } = useAuth();
  const [personasWithoutTokens, setPersonasWithoutTokens] = useState<Array<{
    id: string;
    name: string;
    has_auto_post: boolean;
    has_random_post: boolean;
  }>>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchPersonasWithoutTokens = async () => {
      try {
        const { data, error } = await supabase
          .from('personas')
          .select(`
            id,
            name,
            threads_access_token,
            auto_post_configs!inner(id, is_active),
            random_post_configs!inner(id, is_active)
          `)
          .eq('is_active', true)
          .eq('user_id', user.id)
          .is('threads_access_token', null);

        if (error) {
          console.error('Error fetching personas without tokens:', error);
          return;
        }

        const personasWithIssues = data?.map(persona => ({
          id: persona.id,
          name: persona.name,
          has_auto_post: persona.auto_post_configs?.some(config => config.is_active) || false,
          has_random_post: persona.random_post_configs?.some(config => config.is_active) || false
        })).filter(persona => persona.has_auto_post || persona.has_random_post) || [];

        setPersonasWithoutTokens(personasWithIssues);
      } catch (error) {
        console.error('Error in fetchPersonasWithoutTokens:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPersonasWithoutTokens();
  }, [user]);

  if (isLoading || !isVisible || personasWithoutTokens.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <div className="flex justify-between items-start w-full">
        <div className="flex-1">
          <AlertTitle className="mb-2">
            🚨 トークン未設定のペルソナが見つかりました
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="font-medium">
              以下のペルソナで自動投稿が設定されていますが、Threadsアクセストークンが未設定のため動作しません：
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {personasWithoutTokens.map(persona => (
                <li key={persona.id}>
                  <span className="font-medium">{persona.name}</span>
                  <span className="text-muted-foreground ml-2">
                    ({persona.has_auto_post && "自動投稿"}{persona.has_auto_post && persona.has_random_post && " + "}
                    {persona.has_random_post && "ランダム投稿"})
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = '/persona-setup'}
                className="mr-2"
              >
                ペルソナ設定へ
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsVisible(false)}
              >
                後で対応する
              </Button>
            </div>
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsVisible(false)}
          className="ml-2 h-4 w-4 p-0 hover:bg-transparent"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </Alert>
  );
};