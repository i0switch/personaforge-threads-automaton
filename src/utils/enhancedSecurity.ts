
import { supabase } from '@/integrations/supabase/client';

export interface SecurityEvent {
  event_type: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: any;
}

export interface LoginAttempt {
  email: string;
  success: boolean;
  timestamp: Date;
  ip_address?: string;
  user_agent?: string;
}

export const enhancedSecurity = {
  // Log security events to the new security_events table
  logSecurityEvent: async (event: SecurityEvent) => {
    try {
      const { error } = await supabase
        .from('security_events')
        .insert({
          event_type: event.event_type,
          user_id: event.user_id,
          ip_address: event.ip_address || 'unknown',
          user_agent: event.user_agent || navigator.userAgent,
          details: event.details
        });

      if (error) {
        console.error('Failed to log security event:', error);
      }
    } catch (error) {
      console.error('Security logging error:', error);
    }
  },

  // Enhanced brute force protection
  checkBruteForceAttempts: async (email: string): Promise<boolean> => {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
      const { data: recentFailures, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('event_type', 'login_failed')
        .gte('created_at', fifteenMinutesAgo.toISOString())
        .like('details->email', `%${email}%`);

      if (error) {
        console.error('Error checking brute force attempts:', error);
        return false;
      }

      // Block if more than 5 failed attempts in 15 minutes
      return (recentFailures?.length || 0) >= 5;
    } catch (error) {
      console.error('Brute force check error:', error);
      return false;
    }
  },

  // Log login attempts with enhanced details
  logLoginAttempt: async (attempt: LoginAttempt) => {
    await enhancedSecurity.logSecurityEvent({
      event_type: attempt.success ? 'login_success' : 'login_failed',
      ip_address: attempt.ip_address,
      user_agent: attempt.user_agent,
      details: {
        email: attempt.email,
        timestamp: attempt.timestamp.toISOString(),
        success: attempt.success
      }
    });
  },

  // Enhanced session monitoring
  monitorSessionActivity: async (userId: string, action: string) => {
    await enhancedSecurity.logSecurityEvent({
      event_type: 'session_activity',
      user_id: userId,
      details: {
        action,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }
    });
  },

  // Rate limiting for API endpoints
  checkRateLimit: async (endpoint: string, identifier: string): Promise<boolean> => {
    try {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      
      const { data: recentRequests, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('event_type', 'api_request')
        .gte('created_at', oneMinuteAgo.toISOString())
        .eq('details->endpoint', endpoint)
        .eq('details->identifier', identifier);

      if (error) {
        console.error('Rate limit check error:', error);
        return false;
      }

      // Allow max 60 requests per minute per identifier
      return (recentRequests?.length || 0) >= 60;
    } catch (error) {
      console.error('Rate limiting error:', error);
      return false;
    }
  },

  // Log API requests for rate limiting
  logApiRequest: async (endpoint: string, identifier: string, success: boolean) => {
    await enhancedSecurity.logSecurityEvent({
      event_type: 'api_request',
      details: {
        endpoint,
        identifier,
        success,
        timestamp: new Date().toISOString()
      }
    });
  },

  // Admin access logging
  logAdminAccess: async (userId: string, action: string, resource?: string) => {
    await enhancedSecurity.logSecurityEvent({
      event_type: 'admin_access',
      user_id: userId,
      details: {
        action,
        resource,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }
    });
  },

  // Webhook security verification
  verifyWebhookSecurity: async (signature: string, payload: string, secret: string): Promise<boolean> => {
    try {
      const crypto = window.crypto;
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const data = encoder.encode(payload);
      
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const expectedSignature = await crypto.subtle.sign('HMAC', key, data);
      const expectedHex = Array.from(new Uint8Array(expectedSignature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const providedSignature = signature.replace('sha256=', '');
      return expectedHex === providedSignature;
    } catch (error) {
      console.error('Webhook verification error:', error);
      return false;
    }
  }
};
