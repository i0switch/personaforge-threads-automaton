
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GeneratePostsParams {
  personaId: string;
  topics: string[];
  selectedDates: string[];
  selectedTimes: string[];
  customPrompt: string;
}

export const usePostGeneration = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generatePosts = async (params: GeneratePostsParams) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-posts', {
        body: params
      });

      if (error) throw error;

      toast({
        title: "成功",
        description: `${data?.length || 0}件の投稿を生成しました。`,
      });

      return data;
    } catch (error) {
      console.error('Error generating posts:', error);
      toast({
        title: "エラー",
        description: "投稿の生成に失敗しました。",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { generatePosts, loading };
};
