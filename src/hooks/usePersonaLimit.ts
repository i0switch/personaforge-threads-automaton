
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
      console.log(`Checking persona limit for user: ${user.id}`);
      
      // First, get a fresh count of personas directly
      const { data: personasData, error: personasError } = await supabase
        .from('personas')
        .select('id')
        .eq('user_id', user.id);

      if (personasError) {
        console.error('Error fetching personas:', personasError);
        throw personasError;
      }

      const actualPersonaCount = personasData?.length || 0;
      console.log(`Direct persona count: ${actualPersonaCount}`);

      // Then get the user's persona limit
      const { data: accountData, error: accountError } = await supabase
        .from('user_account_status')
        .select('persona_limit')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (accountError) {
        console.error('Error fetching account status:', accountError);
        // If no record exists, use default
        setLimitInfo({
          currentCount: actualPersonaCount,
          personaLimit: 1,
          canCreate: actualPersonaCount < 1
        });
        return;
      }

      console.log('Account data:', accountData);

      const personaLimit = accountData.persona_limit || 1;
      const canCreate = actualPersonaCount < personaLimit;
      
      console.log(`User ${user.id}: ${actualPersonaCount}/${personaLimit} personas, can create: ${canCreate}`);
      
      setLimitInfo({
        currentCount: actualPersonaCount,
        personaLimit,
        canCreate
      });

      // Also call the RPC function for comparison
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('check_persona_limit', { user_id_param: user.id });

      if (!rpcError && rpcData && rpcData.length > 0) {
        console.log('RPC result for comparison:', rpcData[0]);
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

    // user_account_statusテーブルの変更をリアルタイムで監視
    const accountChannel = supabase
      .channel('user_account_status_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_account_status',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          console.log('Account status updated:', payload);
          checkPersonaLimit();
        }
      )
      .subscribe();

    // personasテーブルの変更も監視
    const personasChannel = supabase
      .channel('personas_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'personas',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          console.log('Personas updated:', payload);
          checkPersonaLimit();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(accountChannel);
      supabase.removeChannel(personasChannel);
    };
  }, [user]);

  return {
    limitInfo,
    loading,
    error,
    refetch: checkPersonaLimit
  };
};
