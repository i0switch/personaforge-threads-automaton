export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          persona_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          persona_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          persona_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics: {
        Row: {
          app_identifier: string | null
          comments_count: number | null
          created_at: string
          date: string
          engagement_rate: number | null
          id: string
          likes_count: number | null
          persona_id: string | null
          posts_count: number | null
          replies_count: number | null
          shares_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_identifier?: string | null
          comments_count?: number | null
          created_at?: string
          date: string
          engagement_rate?: number | null
          id?: string
          likes_count?: number | null
          persona_id?: string | null
          posts_count?: number | null
          replies_count?: number | null
          shares_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_identifier?: string | null
          comments_count?: number | null
          created_at?: string
          date?: string
          engagement_rate?: number | null
          id?: string
          likes_count?: number | null
          persona_id?: string | null
          posts_count?: number | null
          replies_count?: number | null
          shares_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_post_configs: {
        Row: {
          content_prefs: string | null
          created_at: string
          id: string
          is_active: boolean
          multi_time_enabled: boolean | null
          next_run_at: string
          persona_id: string
          post_time: string
          post_times: string[] | null
          prompt_template: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_prefs?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          multi_time_enabled?: boolean | null
          next_run_at: string
          persona_id: string
          post_time: string
          post_times?: string[] | null
          prompt_template?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_prefs?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          multi_time_enabled?: boolean | null
          next_run_at?: string
          persona_id?: string
          post_time?: string
          post_times?: string[] | null
          prompt_template?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_post_configs_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_auto_post_configs_persona"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_replies: {
        Row: {
          created_at: string
          delay_minutes: number | null
          id: string
          is_active: boolean
          persona_id: string | null
          response_template: string
          trigger_keywords: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delay_minutes?: number | null
          id?: string
          is_active?: boolean
          persona_id?: string | null
          response_template: string
          trigger_keywords?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delay_minutes?: number | null
          id?: string
          is_active?: boolean
          persona_id?: string | null
          response_template?: string
          trigger_keywords?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_replies_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          age: string | null
          ai_auto_reply_enabled: boolean | null
          app_identifier: string | null
          auto_reply_delay_minutes: number | null
          auto_reply_enabled: boolean | null
          avatar_url: string | null
          created_at: string
          expertise: string[] | null
          id: string
          is_active: boolean
          name: string
          personality: string | null
          threads_access_token: string | null
          threads_app_id: string | null
          threads_app_secret: string | null
          threads_user_id: string | null
          threads_username: string | null
          tone_of_voice: string | null
          updated_at: string
          user_id: string
          webhook_verify_token: string | null
        }
        Insert: {
          age?: string | null
          ai_auto_reply_enabled?: boolean | null
          app_identifier?: string | null
          auto_reply_delay_minutes?: number | null
          auto_reply_enabled?: boolean | null
          avatar_url?: string | null
          created_at?: string
          expertise?: string[] | null
          id?: string
          is_active?: boolean
          name: string
          personality?: string | null
          threads_access_token?: string | null
          threads_app_id?: string | null
          threads_app_secret?: string | null
          threads_user_id?: string | null
          threads_username?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          user_id: string
          webhook_verify_token?: string | null
        }
        Update: {
          age?: string | null
          ai_auto_reply_enabled?: boolean | null
          app_identifier?: string | null
          auto_reply_delay_minutes?: number | null
          auto_reply_enabled?: boolean | null
          avatar_url?: string | null
          created_at?: string
          expertise?: string[] | null
          id?: string
          is_active?: boolean
          name?: string
          personality?: string | null
          threads_access_token?: string | null
          threads_app_id?: string | null
          threads_app_secret?: string | null
          threads_user_id?: string | null
          threads_username?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          user_id?: string
          webhook_verify_token?: string | null
        }
        Relationships: []
      }
      post_queue: {
        Row: {
          created_at: string
          id: string
          post_id: string
          queue_position: number
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          queue_position?: number
          scheduled_for: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          queue_position?: number
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_queue_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          app_identifier: string | null
          auto_schedule: boolean | null
          content: string
          created_at: string
          hashtags: string[] | null
          id: string
          images: string[] | null
          last_retry_at: string | null
          max_retries: number | null
          persona_id: string | null
          platform: string | null
          preferred_time_slots: string[] | null
          priority: number | null
          published_at: string | null
          retry_count: number | null
          scheduled_for: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_identifier?: string | null
          auto_schedule?: boolean | null
          content: string
          created_at?: string
          hashtags?: string[] | null
          id?: string
          images?: string[] | null
          last_retry_at?: string | null
          max_retries?: number | null
          persona_id?: string | null
          platform?: string | null
          preferred_time_slots?: string[] | null
          priority?: number | null
          published_at?: string | null
          retry_count?: number | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_identifier?: string | null
          auto_schedule?: boolean | null
          content?: string
          created_at?: string
          hashtags?: string[] | null
          id?: string
          images?: string[] | null
          last_retry_at?: string | null
          max_retries?: number | null
          persona_id?: string | null
          platform?: string | null
          preferred_time_slots?: string[] | null
          priority?: number | null
          published_at?: string | null
          retry_count?: number | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_auto_reply_enabled: boolean
          auto_reply_enabled: boolean
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_auto_reply_enabled?: boolean
          auto_reply_enabled?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_auto_reply_enabled?: boolean
          auto_reply_enabled?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      random_post_configs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          next_run_at: string | null
          persona_id: string
          random_times: string[]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          next_run_at?: string | null
          persona_id: string
          random_times?: string[]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          next_run_at?: string | null
          persona_id?: string
          random_times?: string[]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_random_post_configs_persona"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "random_post_configs_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          identifier: string
          request_count: number | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          identifier: string
          request_count?: number | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      reply_check_settings: {
        Row: {
          check_interval_minutes: number | null
          created_at: string
          id: string
          is_active: boolean | null
          last_check_at: string | null
          persona_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          check_interval_minutes?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_check_at?: string | null
          persona_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          check_interval_minutes?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_check_at?: string | null
          persona_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reply_check_settings_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_settings: {
        Row: {
          auto_schedule_enabled: boolean | null
          created_at: string
          id: string
          optimal_hours: number[] | null
          persona_id: string | null
          queue_limit: number | null
          retry_enabled: boolean | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_schedule_enabled?: boolean | null
          created_at?: string
          id?: string
          optimal_hours?: number[] | null
          persona_id?: string | null
          queue_limit?: number | null
          retry_enabled?: boolean | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_schedule_enabled?: boolean | null
          created_at?: string
          id?: string
          optimal_hours?: number[] | null
          persona_id?: string | null
          queue_limit?: number | null
          retry_enabled?: boolean | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_settings_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          category: string
          created_at: string | null
          details: Json | null
          id: string
          message: string
          resolved: boolean | null
          type: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          details?: Json | null
          id?: string
          message: string
          resolved?: boolean | null
          type: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          message?: string
          resolved?: boolean | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      security_config: {
        Row: {
          activity_logging: boolean | null
          anomaly_detection: boolean | null
          auto_security_scan: boolean | null
          created_at: string | null
          id: string
          security_alerts: boolean | null
          session_timeout: boolean | null
          strong_password_policy: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_logging?: boolean | null
          anomaly_detection?: boolean | null
          auto_security_scan?: boolean | null
          created_at?: string | null
          id?: string
          security_alerts?: boolean | null
          session_timeout?: boolean | null
          strong_password_policy?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_logging?: boolean | null
          anomaly_detection?: boolean | null
          auto_security_scan?: boolean | null
          created_at?: string | null
          id?: string
          security_alerts?: boolean | null
          session_timeout?: boolean | null
          strong_password_policy?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      self_reply_jobs: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          persona_id: string
          post_id: string
          reply_id: string | null
          status: string
          threads_post_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          persona_id: string
          post_id: string
          reply_id?: string | null
          status?: string
          threads_post_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          persona_id?: string
          post_id?: string
          reply_id?: string | null
          status?: string
          threads_post_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_reply_jobs_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      self_reply_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          messages: string[]
          persona_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          messages?: string[]
          persona_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          messages?: string[]
          persona_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_reply_settings_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_replies: {
        Row: {
          auto_reply_sent: boolean | null
          created_at: string
          id: string
          original_post_id: string
          persona_id: string | null
          reply_author_id: string
          reply_author_username: string | null
          reply_id: string
          reply_status: string | null
          reply_text: string
          reply_timestamp: string
          scheduled_reply_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_reply_sent?: boolean | null
          created_at?: string
          id?: string
          original_post_id: string
          persona_id?: string | null
          reply_author_id: string
          reply_author_username?: string | null
          reply_id: string
          reply_status?: string | null
          reply_text: string
          reply_timestamp: string
          scheduled_reply_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_reply_sent?: boolean | null
          created_at?: string
          id?: string
          original_post_id?: string
          persona_id?: string | null
          reply_author_id?: string
          reply_author_username?: string | null
          reply_id?: string
          reply_status?: string | null
          reply_text?: string
          reply_timestamp?: string
          scheduled_reply_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_replies_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_account_status: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          is_active: boolean
          is_approved: boolean
          park_user_link: string | null
          persona_limit: number
          security_migration_notified: boolean | null
          subscription_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_approved?: boolean
          park_user_link?: string | null
          persona_limit?: number
          security_migration_notified?: boolean | null
          subscription_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_approved?: boolean
          park_user_link?: string | null
          persona_limit?: number
          security_migration_notified?: boolean | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          created_at: string
          encrypted_key: string
          id: string
          key_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_key: string
          id?: string
          key_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_key?: string
          id?: string
          key_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          persona_id: string | null
          updated_at: string
          user_id: string
          verify_token: string | null
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          persona_id?: string | null
          updated_at?: string
          user_id: string
          verify_token?: string | null
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          persona_id?: string | null
          updated_at?: string
          user_id?: string
          verify_token?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_settings_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cron_job_status: {
        Row: {
          active: boolean | null
          jobid: number | null
          jobname: string | null
          schedule: string | null
        }
        Insert: {
          active?: boolean | null
          jobid?: number | null
          jobname?: string | null
          schedule?: string | null
        }
        Update: {
          active?: boolean | null
          jobid?: number | null
          jobname?: string | null
          schedule?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      authenticate_service_request: {
        Args: { request_headers: Json }
        Returns: boolean
      }
      calculate_next_multi_time_run: {
        Args: {
          p_current_time: string
          time_slots: string[]
          timezone_name?: string
        }
        Returns: string
      }
      calculate_timezone_aware_next_run: {
        Args: { current_schedule_time: string; timezone_name?: string }
        Returns: string
      }
      check_login_attempts: {
        Args: { user_email: string }
        Returns: boolean
      }
      check_persona_limit: {
        Args: { user_id_param: string }
        Returns: {
          can_create: boolean
          current_count: number
          persona_limit: number
        }[]
      }
      cleanup_post_queue_for_persona: {
        Args: { p_persona_id: string }
        Returns: undefined
      }
      decrypt_access_token: {
        Args: { encrypted_token: string }
        Returns: string
      }
      encrypt_access_token: {
        Args: { token: string }
        Returns: string
      }
      get_cron_job_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          active: boolean | null
          jobid: number | null
          jobname: string | null
          schedule: string | null
        }[]
      }
      get_persona_for_auto_reply: {
        Args: { persona_id_param: string }
        Returns: {
          ai_auto_reply_enabled: boolean
          auto_replies: Json
          id: string
          name: string
          threads_access_token: string
          user_id: string
        }[]
      }
      get_user_emails_for_admin: {
        Args: Record<PropertyKey, never>
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_user_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_subscriptions: number
          approved_users: number
          pending_users: number
          total_users: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      log_policy_violation: {
        Args: {
          operation: string
          table_name: string
          user_id_attempted?: string
        }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          p_details?: Json
          p_event_type: string
          p_ip_address?: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: undefined
      }
      validate_password_strength: {
        Args: { password: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
