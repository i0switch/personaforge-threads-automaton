
import { useState } from 'react';
import { z } from 'zod';
import { toast } from '@/hooks/use-toast';
import { validateAndSanitize } from '@/lib/validation';

interface UseSecureFormOptions<T> {
  schema: z.ZodSchema<T>;
  onSubmit: (data: T) => Promise<void> | void;
  sanitizeFields?: string[];
}

export function useSecureForm<T>({ schema, onSubmit, sanitizeFields = [] }: UseSecureFormOptions<T>) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (data: any) => {
    try {
      setLoading(true);
      setErrors({});

      // サニタイゼーション
      const sanitizedData = { ...data };
      sanitizeFields.forEach(field => {
        if (sanitizedData[field] && typeof sanitizedData[field] === 'string') {
          sanitizedData[field] = validateAndSanitize(sanitizedData[field]);
        }
      });

      // バリデーション
      const validatedData = schema.parse(sanitizedData);
      
      await onSubmit(validatedData);
      
      toast({
        title: "成功",
        description: "データが正常に保存されました。",
      });
    } catch (error) {
      console.error('Form submission error:', error);
      
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path.length > 0) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        
        toast({
          title: "入力エラー",
          description: "入力内容を確認してください。",
          variant: "destructive",
        });
      } else {
        toast({
          title: "エラー",
          description: error instanceof Error ? error.message : "予期しないエラーが発生しました。",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    handleSubmit,
    loading,
    errors,
    setErrors,
  };
}
