export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
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
          threads_username: string | null
          tone_of_voice: string | null
          updated_at: string
          user_id: string
          webhook_verify_token: string | null
        }
        Insert: {
          age?: string | null
          ai_auto_reply_enabled?: boolean | null
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
          threads_username?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          user_id: string
          webhook_verify_token?: string | null
        }
        Update: {
          age?: string | null
          ai_auto_reply_enabled?: boolean | null
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
      check_login_attempts: {
        Args: { user_email: string }
        Returns: boolean
      }
      check_persona_limit: {
        Args: { user_id_param: string }
        Returns: {
          current_count: number
          persona_limit: number
          can_create: boolean
        }[]
      }
      get_user_emails_for_admin: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          email: string
        }[]
      }
      get_user_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_users: number
          approved_users: number
          pending_users: number
          active_subscriptions: number
        }[]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      log_security_event: {
        Args: {
          p_event_type: string
          p_user_id?: string
          p_ip_address?: string
          p_user_agent?: string
          p_details?: Json
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
