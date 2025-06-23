export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          avatar_url: string | null
          created_at: string
          expertise: string[] | null
          id: string
          is_active: boolean
          name: string
          personality: string | null
          threads_access_token: string | null
          tone_of_voice: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: string | null
          avatar_url?: string | null
          created_at?: string
          expertise?: string[] | null
          id?: string
          is_active?: boolean
          name: string
          personality?: string | null
          threads_access_token?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: string | null
          avatar_url?: string | null
          created_at?: string
          expertise?: string[] | null
          id?: string
          is_active?: boolean
          name?: string
          personality?: string | null
          threads_access_token?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          user_id?: string
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
          auto_reply_enabled: boolean
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_reply_enabled?: boolean
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
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
          reply_text: string
          reply_timestamp: string
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
          reply_text: string
          reply_timestamp: string
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
          reply_text?: string
          reply_timestamp?: string
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
