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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      day_plan_items: {
        Row: {
          block_id: number | null
          date: string
          done_at: string | null
          deferred_to: string | null
          manual: boolean
          id: number
          label: string | null
          sort_order: number
          topic_id: string | null
          user_id: string
        }
        Insert: {
          block_id?: number | null
          date: string
          done_at?: string | null
          deferred_to?: string | null
          manual?: boolean
          id?: never
          label?: string | null
          sort_order: number
          topic_id?: string | null
          user_id?: string
        }
        Update: {
          block_id?: number | null
          date?: string
          done_at?: string | null
          deferred_to?: string | null
          manual?: boolean
          id?: never
          label?: string | null
          sort_order?: number
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_plan_items_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "schedule_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_plan_items_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_plan_items_user_id_date_fkey"
            columns: ["user_id", "date"]
            isOneToOne: false
            referencedRelation: "day_plans"
            referencedColumns: ["user_id", "date"]
          },
        ]
      }
      day_plans: {
        Row: {
          date: string
          generated_at: string | null
          user_id: string
        }
        Insert: {
          date: string
          generated_at?: string | null
          user_id?: string
        }
        Update: {
          date?: string
          generated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          co: string | null
          origin: string
          est_minutes: number | null
          id: string
          name: string
          sort_order: number
          track_id: string
          user_id: string
        }
        Insert: {
          co?: string | null
          origin?: string
          est_minutes?: number | null
          id: string
          name: string
          sort_order: number
          track_id: string
          user_id?: string
        }
        Update: {
          co?: string | null
          origin?: string
          est_minutes?: number | null
          id?: string
          name?: string
          sort_order?: number
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      revisions: {
        Row: {
          due_date: string | null
          interval_step: number
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          due_date?: string | null
          interval_step?: number
          topic_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          due_date?: string | null
          interval_step?: number
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schedule_blocks: {
        Row: {
          id: number
          label: string | null
          topics: number
          minutes: number
          sort_order: number
          track_id: string | null
          user_id: string
          weekday: number
        }
        Insert: {
          id?: never
          label?: string | null
          topics?: number
          minutes?: number
          sort_order: number
          track_id?: string | null
          user_id?: string
          weekday: number
        }
        Update: {
          id?: never
          label?: string | null
          topics?: number
          minutes?: number
          sort_order?: number
          track_id?: string | null
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          bloom: string | null
          confidence: number | null
          last_reviewed_at: string | null
          links: string[]
          notes: string | null
          origin: string
          practice_done: boolean
          done_at: string | null
          est_minutes: number | null
          id: string
          module_id: string
          revision: boolean
          sort_order: number
          title: string
          user_id: string
        }
        Insert: {
          bloom?: string | null
          confidence?: number | null
          last_reviewed_at?: string | null
          links?: string[]
          notes?: string | null
          origin?: string
          practice_done?: boolean
          done_at?: string | null
          est_minutes?: number | null
          id: string
          module_id: string
          revision?: boolean
          sort_order: number
          title: string
          user_id?: string
        }
        Update: {
          bloom?: string | null
          confidence?: number | null
          last_reviewed_at?: string | null
          links?: string[]
          notes?: string | null
          origin?: string
          practice_done?: boolean
          done_at?: string | null
          est_minutes?: number | null
          id?: string
          module_id?: string
          revision?: boolean
          sort_order?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          count_in_overall: boolean
          course_code: string | null
          origin: string
          exam_date: string | null
          id: string
          name: string
          sort_order: number
          type: string
          user_id: string
        }
        Insert: {
          count_in_overall?: boolean
          course_code?: string | null
          origin?: string
          exam_date?: string | null
          id: string
          name: string
          sort_order: number
          type: string
          user_id?: string
        }
        Update: {
          count_in_overall?: boolean
          course_code?: string | null
          origin?: string
          exam_date?: string | null
          id?: string
          name?: string
          sort_order?: number
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          daily_budget: (number | null)[] | null
          streak_min_no_plan: number
          streak_plan_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          daily_budget?: (number | null)[] | null
          streak_min_no_plan?: number
          streak_plan_pct?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          daily_budget?: (number | null)[] | null
          streak_min_no_plan?: number
          streak_plan_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_plan_item: {
        Args: { p_date: string; p_topic_id: string | null; p_label: string | null }
        Returns: number | null
      }
      import_topics: {
        Args: { p_track_id: string; p_rows: Json }
        Returns: number
      }
      defer_plan_item: {
        Args: { p_item_id: number; p_to: string }
        Returns: number | null
      }
      save_day_plan: {
        Args: { p_date: string; p_items: Json; p_replace: boolean }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
