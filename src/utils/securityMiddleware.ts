
import { supabase } from '@/integrations/supabase/client';
import { isValidUUID, containsSqlInjection, sanitizeInput } from '@/lib/validation';

// API呼び出し前のセキュリティチェック
export const securityMiddleware = {
  validateUserId: (userId: string): boolean => {
    if (!userId || !isValidUUID(userId)) {
      console.warn('Invalid user ID format:', userId);
      return false;
    }
    return true;
  },

  validatePersonaId: (personaId: string): boolean => {
    if (!personaId || !isValidUUID(personaId)) {
      console.warn('Invalid persona ID format:', personaId);
      return false;
    }
    return true;
  },

  sanitizeQueryParams: (params: Record<string, any>): Record<string, any> => {
    const sanitized: Record<string, any> = {};
    
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === 'string') {
        if (containsSqlInjection(value)) {
          console.warn('Potential SQL injection detected in:', key);
          sanitized[key] = '';
        } else {
          sanitized[key] = sanitizeInput(value);
        }
      } else {
        sanitized[key] = value;
      }
    });
    
    return sanitized;
  },

  logSecurityEvent: async (eventType: string, details: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user?.id || 'anonymous',
          action_type: `security_${eventType}`,
          description: `Security event: ${eventType}`,
          metadata: {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            ...details
          }
        });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  },

  validateFileUpload: (file: File): { valid: boolean; error?: string } => {
    // ファイルサイズチェック (5MB制限)
    if (file.size > 5 * 1024 * 1024) {
      return { valid: false, error: 'ファイルサイズが大きすぎます（5MB以下にしてください）' };
    }

    // ファイルタイプチェック
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: '許可されていないファイル形式です' };
    }

    // ファイル名チェック
    if (containsSqlInjection(file.name)) {
      return { valid: false, error: 'ファイル名に無効な文字が含まれています' };
    }

    return { valid: true };
  }
};

// セキュアなSupabaseクエリラッパー
export const secureQuery = {
  async select(table: string, query: any, userId?: string) {
    try {
      if (userId && !securityMiddleware.validateUserId(userId)) {
        throw new Error('Invalid user ID');
      }

      const sanitizedQuery = securityMiddleware.sanitizeQueryParams(query);
      return await supabase.from(table).select().match(sanitizedQuery);
    } catch (error) {
      await securityMiddleware.logSecurityEvent('query_error', {
        table,
        query,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  async insert(table: string, data: any, userId?: string) {
    try {
      if (userId && !securityMiddleware.validateUserId(userId)) {
        throw new Error('Invalid user ID');
      }

      const sanitizedData = securityMiddleware.sanitizeQueryParams(data);
      return await supabase.from(table).insert(sanitizedData);
    } catch (error) {
      await securityMiddleware.logSecurityEvent('insert_error', {
        table,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  async update(table: string, data: any, userId?: string) {
    try {
      if (userId && !securityMiddleware.validateUserId(userId)) {
        throw new Error('Invalid user ID');
      }

      const sanitizedData = securityMiddleware.sanitizeQueryParams(data);
      return await supabase.from(table).update(sanitizedData);
    } catch (error) {
      await securityMiddleware.logSecurityEvent('update_error', {
        table,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
};
