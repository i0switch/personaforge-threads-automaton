
import { supabase } from '@/integrations/supabase/client';
import { isValidUUID, containsSqlInjection, sanitizeInput } from '@/lib/validation';
import type { Database } from '@/integrations/supabase/types';

// Database type helpers
type PersonaInsert = Database['public']['Tables']['personas']['Insert'];
type PostInsert = Database['public']['Tables']['posts']['Insert'];
type AutoReplyInsert = Database['public']['Tables']['auto_replies']['Insert'];

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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
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

// 型安全なSupabaseクエリラッパー
export const secureQuery = {
  personas: {
    select: async (query: any, userId?: string) => {
      try {
        if (userId && !securityMiddleware.validateUserId(userId)) {
          throw new Error('Invalid user ID');
        }
        const sanitizedQuery = securityMiddleware.sanitizeQueryParams(query);
        return await supabase.from('personas').select().match(sanitizedQuery);
      } catch (error) {
        await securityMiddleware.logSecurityEvent('query_error', {
          table: 'personas',
          query,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },
    
    insert: async (data: Partial<PersonaInsert>, userId?: string) => {
      try {
        if (userId && !securityMiddleware.validateUserId(userId)) {
          throw new Error('Invalid user ID');
        }
        const sanitizedData = securityMiddleware.sanitizeQueryParams(data);
        
        // 必須フィールドの確認
        if (!sanitizedData.name || !sanitizedData.user_id) {
          throw new Error('Required fields (name, user_id) are missing');
        }
        
        // 型安全なデータ構造を作成
        const insertData: PersonaInsert = {
          name: sanitizedData.name,
          user_id: sanitizedData.user_id,
          age: sanitizedData.age || undefined,
          personality: sanitizedData.personality || undefined,
          expertise: sanitizedData.expertise || undefined,
          tone_of_voice: sanitizedData.tone_of_voice || undefined,
          avatar_url: sanitizedData.avatar_url || undefined,
          is_active: sanitizedData.is_active || false
        };
        
        return await supabase.from('personas').insert(insertData);
      } catch (error) {
        await securityMiddleware.logSecurityEvent('insert_error', {
          table: 'personas',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },
    
    update: async (data: any, userId?: string) => {
      try {
        if (userId && !securityMiddleware.validateUserId(userId)) {
          throw new Error('Invalid user ID');
        }
        const sanitizedData = securityMiddleware.sanitizeQueryParams(data);
        return await supabase.from('personas').update(sanitizedData);
      } catch (error) {
        await securityMiddleware.logSecurityEvent('update_error', {
          table: 'personas',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    }
  },

  posts: {
    select: async (query: any, userId?: string) => {
      try {
        if (userId && !securityMiddleware.validateUserId(userId)) {
          throw new Error('Invalid user ID');
        }
        const sanitizedQuery = securityMiddleware.sanitizeQueryParams(query);
        return await supabase.from('posts').select().match(sanitizedQuery);
      } catch (error) {
        await securityMiddleware.logSecurityEvent('query_error', {
          table: 'posts',
          query,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },
    
    insert: async (data: Partial<PostInsert>, userId?: string) => {
      try {
        if (userId && !securityMiddleware.validateUserId(userId)) {
          throw new Error('Invalid user ID');
        }
        const sanitizedData = securityMiddleware.sanitizeQueryParams(data);
        
        // 必須フィールドの確認
        if (!sanitizedData.content || !sanitizedData.user_id) {
          throw new Error('Required fields (content, user_id) are missing');
        }
        
        // 型安全なデータ構造を作成
        const insertData: PostInsert = {
          content: sanitizedData.content,
          user_id: sanitizedData.user_id,
          persona_id: sanitizedData.persona_id || undefined,
          hashtags: sanitizedData.hashtags || undefined,
          images: sanitizedData.images || undefined,
          platform: sanitizedData.platform || undefined,
          scheduled_for: sanitizedData.scheduled_for || undefined,
          status: sanitizedData.status || 'draft',
          priority: sanitizedData.priority || 0,
          auto_schedule: sanitizedData.auto_schedule || false,
          max_retries: sanitizedData.max_retries || 3,
          retry_count: sanitizedData.retry_count || 0,
          preferred_time_slots: sanitizedData.preferred_time_slots || undefined
        };
        
        return await supabase.from('posts').insert(insertData);
      } catch (error) {
        await securityMiddleware.logSecurityEvent('insert_error', {
          table: 'posts',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },
    
    update: async (data: any, userId?: string) => {
      try {
        if (userId && !securityMiddleware.validateUserId(userId)) {
          throw new Error('Invalid user ID');
        }
        const sanitizedData = securityMiddleware.sanitizeQueryParams(data);
        return await supabase.from('posts').update(sanitizedData);
      } catch (error) {
        await securityMiddleware.logSecurityEvent('update_error', {
          table: 'posts',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    }
  },

  autoReplies: {
    select: async (query: any, userId?: string) => {
      try {
        if (userId && !securityMiddleware.validateUserId(userId)) {
          throw new Error('Invalid user ID');
        }
        const sanitizedQuery = securityMiddleware.sanitizeQueryParams(query);
        return await supabase.from('auto_replies').select().match(sanitizedQuery);
      } catch (error) {
        await securityMiddleware.logSecurityEvent('query_error', {
          table: 'auto_replies',
          query,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },
    
    insert: async (data: Partial<AutoReplyInsert>, userId?: string) => {
      try {
        if (userId && !securityMiddleware.validateUserId(userId)) {
          throw new Error('Invalid user ID');
        }
        const sanitizedData = securityMiddleware.sanitizeQueryParams(data);
        
        // 必須フィールドの確認
        if (!sanitizedData.response_template || !sanitizedData.user_id) {
          throw new Error('Required fields (response_template, user_id) are missing');
        }
        
        // 型安全なデータ構造を作成
        const insertData: AutoReplyInsert = {
          response_template: sanitizedData.response_template,
          user_id: sanitizedData.user_id,
          persona_id: sanitizedData.persona_id || undefined,
          trigger_keywords: sanitizedData.trigger_keywords || undefined,
          is_active: sanitizedData.is_active || true
        };
        
        return await supabase.from('auto_replies').insert(insertData);
      } catch (error) {
        await securityMiddleware.logSecurityEvent('insert_error', {
          table: 'auto_replies',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },
    
    update: async (data: any, userId?: string) => {
      try {
        if (userId && !securityMiddleware.validateUserId(userId)) {
          throw new Error('Invalid user ID');
        }
        const sanitizedData = securityMiddleware.sanitizeQueryParams(data);
        return await supabase.from('auto_replies').update(sanitizedData);
      } catch (error) {
        await securityMiddleware.logSecurityEvent('update_error', {
          table: 'auto_replies',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    }
  }
};
