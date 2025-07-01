
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface PersonaLimitInfo {
  currentCount: number;
  personaLimit: number;
  canCreate: boolean;
}

export const usePersonaLimit = () => {
  const { user } = useAuth();
  const [limitInfo, setLimitInfo] = useState<PersonaLimitInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkPersonaLimit = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .rpc('check_persona_limit', { user_id_param: user.id });

      if (fetchError) {
        console.error('Error checking persona limit:', fetchError);
        setError('ペルソナ上限の確認に失敗しました');
        return;
      }

      if (data && data.length > 0) {
        const limitData = data[0];
        setLimitInfo({
          currentCount: Number(limitData.current_count),
          personaLimit: limitData.persona_limit,
          canCreate: limitData.can_create
        });
      } else {
        // デフォルト値を設定
        setLimitInfo({
          currentCount: 0,
          personaLimit: 1,
          canCreate: true
        });
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('予期しないエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkPersonaLimit();
  }, [user]);

  return {
    limitInfo,
    loading,
    error,
    refetch: checkPersonaLimit
  };
};
