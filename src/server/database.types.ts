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
      answers: {
        Row: {
          chosen_option_id: string
          client_event_id: string
          id: string
          is_correct: boolean
          lesson_id: string
          occurred_at: string
          question_index: number
          user_id: string
        }
        Insert: {
          chosen_option_id: string
          client_event_id: string
          id?: string
          is_correct: boolean
          lesson_id: string
          occurred_at: string
          question_index: number
          user_id: string
        }
        Update: {
          chosen_option_id?: string
          client_event_id?: string
          id?: string
          is_correct?: boolean
          lesson_id?: string
          occurred_at?: string
          question_index?: number
          user_id?: string
        }
        Relationships: []
      }
      chip_cases: {
        Row: {
          auto_values: boolean
          buy_in: number
          colors: Json
          players: number
          user_id: string
        }
        Insert: {
          auto_values?: boolean
          buy_in: number
          colors: Json
          players: number
          user_id: string
        }
        Update: {
          auto_values?: boolean
          buy_in?: number
          colors?: Json
          players?: number
          user_id?: string
        }
        Relationships: []
      }
      content_questions: {
        Row: {
          chapter_id: string
          correct_option_id: string
          lesson_id: string
          option_ids: string[]
          question_index: number
        }
        Insert: {
          chapter_id: string
          correct_option_id: string
          lesson_id: string
          option_ids: string[]
          question_index: number
        }
        Update: {
          chapter_id?: string
          correct_option_id?: string
          lesson_id?: string
          option_ids?: string[]
          question_index?: number
        }
        Relationships: []
      }
      game_seats: {
        Row: {
          balance_points: number
          end_points: number
          game_id: string
          id: string
          name: string | null
          seat_index: number
          user_id: string
        }
        Insert: {
          balance_points?: number
          end_points?: number
          game_id: string
          id?: string
          name?: string | null
          seat_index: number
          user_id: string
        }
        Update: {
          balance_points?: number
          end_points?: number
          game_id?: string
          id?: string
          name?: string | null
          seat_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_seats_game_id_user_id_fkey"
            columns: ["game_id", "user_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      games: {
        Row: {
          auto_values: boolean | null
          buy_in: number
          client_event_id: string
          colors: Json | null
          deal: Json | null
          dealt_stack: number
          id: string
          played_at: string
          players: number
          user_id: string
        }
        Insert: {
          auto_values?: boolean | null
          buy_in: number
          client_event_id?: string
          colors?: Json | null
          deal?: Json | null
          dealt_stack: number
          id?: string
          played_at?: string
          players: number
          user_id: string
        }
        Update: {
          auto_values?: boolean | null
          buy_in?: number
          client_event_id?: string
          colors?: Json | null
          deal?: Json | null
          dealt_stack?: number
          id?: string
          played_at?: string
          players?: number
          user_id?: string
        }
        Relationships: []
      }
      lesson_completions: {
        Row: {
          chapter_id: string
          client_event_id: string
          correct_count: number
          id: string
          lesson_id: string
          occurred_at: string
          question_count: number
          user_id: string
        }
        Insert: {
          chapter_id: string
          client_event_id: string
          correct_count: number
          id?: string
          lesson_id: string
          occurred_at: string
          question_count: number
          user_id: string
        }
        Update: {
          chapter_id?: string
          client_event_id?: string
          correct_count?: number
          id?: string
          lesson_id?: string
          occurred_at?: string
          question_count?: number
          user_id?: string
        }
        Relationships: []
      }
      player_state: {
        Row: {
          hearts: number
          hearts_settled_at: string
          longest_streak: number
          streak_count: number
          streak_day: string | null
          tz_offset_min: number
          user_id: string
        }
        Insert: {
          hearts?: number
          hearts_settled_at?: string
          longest_streak?: number
          streak_count?: number
          streak_day?: string | null
          tz_offset_min?: number
          user_id: string
        }
        Update: {
          hearts?: number
          hearts_settled_at?: string
          longest_streak?: number
          streak_count?: number
          streak_day?: string | null
          tz_offset_min?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_id: string | null
          created_at: string
          display_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_id?: string | null
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_id?: string | null
          created_at?: string
          display_name?: string | null
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
      complete_lesson: {
        Args: {
          p_chapter_id: string
          p_client_event_id: string
          p_lesson_id: string
          p_occurred_at: string
          p_tz_offset_min: number
        }
        Returns: Json
      }
      delete_account: { Args: never; Returns: undefined }
      get_state: { Args: never; Returns: Json }
      live_streak: {
        Args: {
          p_streak_count: number
          p_streak_day: string
          p_today_local: string
        }
        Returns: number
      }
      set_profile: {
        Args: { p_avatar_id: string; p_display_name: string }
        Returns: Json
      }
      settle_hearts: {
        Args: { p_at: string; p_hearts: number; p_settled_at: string }
        Returns: {
          hearts: number
          settled_at: string
        }[]
      }
      submit_answer: {
        Args: {
          p_chosen_option_id: string
          p_client_event_id: string
          p_lesson_id: string
          p_occurred_at: string
          p_question_index: number
          p_tz_offset_min: number
        }
        Returns: Json
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
    Enums: {},
  },
} as const

