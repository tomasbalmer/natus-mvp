export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      anonymous_sessions: {
        Row: {
          birth_city: string
          birth_country: string
          birth_date: string | null
          birth_time: string | null
          claimed_at: string | null
          clinical_ideation_6m: string | null
          clinical_in_treatment: boolean | null
          clinical_prefer_not_to_say: string[]
          clinical_psychiatric_medication: boolean | null
          country: string
          created_at: string
          expires_at: string
          id: string
          legal_birth_name: string
          locale: string
          natal_chart: Json | null
          openness_to_modalities: string[]
          presenting_need_slugs: string[]
          presenting_need_text: string
          soul_map_id: string | null
          step: number
          user_id: string
        }
        Insert: {
          birth_city?: string
          birth_country?: string
          birth_date?: string | null
          birth_time?: string | null
          claimed_at?: string | null
          clinical_ideation_6m?: string | null
          clinical_in_treatment?: boolean | null
          clinical_prefer_not_to_say?: string[]
          clinical_psychiatric_medication?: boolean | null
          country?: string
          created_at?: string
          expires_at?: string
          id?: string
          legal_birth_name?: string
          locale?: string
          natal_chart?: Json | null
          openness_to_modalities?: string[]
          presenting_need_slugs?: string[]
          presenting_need_text?: string
          soul_map_id?: string | null
          step?: number
          user_id: string
        }
        Update: {
          birth_city?: string
          birth_country?: string
          birth_date?: string | null
          birth_time?: string | null
          claimed_at?: string | null
          clinical_ideation_6m?: string | null
          clinical_in_treatment?: boolean | null
          clinical_prefer_not_to_say?: string[]
          clinical_psychiatric_medication?: boolean | null
          country?: string
          created_at?: string
          expires_at?: string
          id?: string
          legal_birth_name?: string
          locale?: string
          natal_chart?: Json | null
          openness_to_modalities?: string[]
          presenting_need_slugs?: string[]
          presenting_need_text?: string
          soul_map_id?: string | null
          step?: number
          user_id?: string
        }
        Relationships: []
      }
      bed_tracks: {
        Row: {
          frequency_hz: number | null
          id: string
          is_active: boolean
          license: string | null
          name: string
          suits: string
          synthesis: Json
        }
        Insert: {
          frequency_hz?: number | null
          id: string
          is_active?: boolean
          license?: string | null
          name: string
          suits: string
          synthesis: Json
        }
        Update: {
          frequency_hz?: number | null
          id?: string
          is_active?: boolean
          license?: string | null
          name?: string
          suits?: string
          synthesis?: Json
        }
        Relationships: []
      }
      chart_comparisons: {
        Row: {
          consent_id: string
          created_at: string
          external_profile_id: string
          id: string
          mode: string
          prompt_version: string
          result: Json
          user_id: string
        }
        Insert: {
          consent_id: string
          created_at?: string
          external_profile_id: string
          id?: string
          mode: string
          prompt_version: string
          result: Json
          user_id: string
        }
        Update: {
          consent_id?: string
          created_at?: string
          external_profile_id?: string
          id?: string
          mode?: string
          prompt_version?: string
          result?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_comparisons_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "comparison_consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_comparisons_external_profile_id_fkey"
            columns: ["external_profile_id"]
            isOneToOne: false
            referencedRelation: "external_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claude_api_calls: {
        Row: {
          cache_read_tokens: number | null
          cache_write_tokens: number | null
          created_at: string
          error_kind: string | null
          id: string
          input_tokens: number | null
          latency_ms: number
          mode: string
          model: string
          outcome: string
          output_tokens: number | null
          prompt_version: string
          purpose: string
          user_id: string | null
        }
        Insert: {
          cache_read_tokens?: number | null
          cache_write_tokens?: number | null
          created_at?: string
          error_kind?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number
          mode: string
          model: string
          outcome: string
          output_tokens?: number | null
          prompt_version: string
          purpose: string
          user_id?: string | null
        }
        Update: {
          cache_read_tokens?: number | null
          cache_write_tokens?: number | null
          created_at?: string
          error_kind?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number
          mode?: string
          model?: string
          outcome?: string
          output_tokens?: number | null
          prompt_version?: string
          purpose?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          birth_city: string
          birth_country: string
          birth_date: string | null
          birth_time: string | null
          claimed_session_id: string | null
          clinical_ideation_6m: string | null
          clinical_in_treatment: boolean | null
          clinical_prefer_not_to_say: string[]
          clinical_psychiatric_medication: boolean | null
          country: string
          created_at: string
          email: string | null
          id: string
          legal_birth_name: string
          locale: string
          natal_chart: Json | null
          openness_to_modalities: string[]
          presenting_need_slugs: string[]
          presenting_need_text: string
          soul_map_id: string | null
          user_id: string
        }
        Insert: {
          birth_city?: string
          birth_country?: string
          birth_date?: string | null
          birth_time?: string | null
          claimed_session_id?: string | null
          clinical_ideation_6m?: string | null
          clinical_in_treatment?: boolean | null
          clinical_prefer_not_to_say?: string[]
          clinical_psychiatric_medication?: boolean | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          legal_birth_name?: string
          locale?: string
          natal_chart?: Json | null
          openness_to_modalities?: string[]
          presenting_need_slugs?: string[]
          presenting_need_text?: string
          soul_map_id?: string | null
          user_id: string
        }
        Update: {
          birth_city?: string
          birth_country?: string
          birth_date?: string | null
          birth_time?: string | null
          claimed_session_id?: string | null
          clinical_ideation_6m?: string | null
          clinical_in_treatment?: boolean | null
          clinical_prefer_not_to_say?: string[]
          clinical_psychiatric_medication?: boolean | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          legal_birth_name?: string
          locale?: string
          natal_chart?: Json | null
          openness_to_modalities?: string[]
          presenting_need_slugs?: string[]
          presenting_need_text?: string
          soul_map_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_claimed_session_id_fkey"
            columns: ["claimed_session_id"]
            isOneToOne: false
            referencedRelation: "anonymous_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      comparison_consents: {
        Row: {
          expires_at: string
          external_profile_id: string
          id: string
          requested_at: string
          responded_at: string | null
          scope: Json
          status: string
          user_id: string
        }
        Insert: {
          expires_at?: string
          external_profile_id: string
          id?: string
          requested_at?: string
          responded_at?: string | null
          scope?: Json
          status?: string
          user_id: string
        }
        Update: {
          expires_at?: string
          external_profile_id?: string
          id?: string
          requested_at?: string
          responded_at?: string | null
          scope?: Json
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparison_consents_external_profile_id_fkey"
            columns: ["external_profile_id"]
            isOneToOne: false
            referencedRelation: "external_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          synthesis_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          synthesis_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          synthesis_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_synthesis_id_fkey"
            columns: ["synthesis_id"]
            isOneToOne: false
            referencedRelation: "soul_map_syntheses"
            referencedColumns: ["id"]
          },
        ]
      }
      crisis_events: {
        Row: {
          admin_notified_at: string | null
          category: string
          created_at: string
          excerpt: string
          false_positive: boolean | null
          from_clinical_answer: boolean
          id: string
          layer: string
          matched: string[]
          severity: string
          source_surface: string
          user_id: string
        }
        Insert: {
          admin_notified_at?: string | null
          category: string
          created_at?: string
          excerpt?: string
          false_positive?: boolean | null
          from_clinical_answer?: boolean
          id?: string
          layer?: string
          matched?: string[]
          severity: string
          source_surface: string
          user_id: string
        }
        Update: {
          admin_notified_at?: string | null
          category?: string
          created_at?: string
          excerpt?: string
          false_positive?: boolean | null
          from_clinical_answer?: boolean
          id?: string
          layer?: string
          matched?: string[]
          severity?: string
          source_surface?: string
          user_id?: string
        }
        Relationships: []
      }
      crisis_resources: {
        Row: {
          contact: string
          country: string
          id: string
          is_active: boolean
          name: string
          note: string | null
          priority: number
          type: string
          verified_at: string | null
        }
        Insert: {
          contact: string
          country: string
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          priority?: number
          type: string
          verified_at?: string | null
        }
        Update: {
          contact?: string
          country?: string
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          priority?: number
          type?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      external_profiles: {
        Row: {
          birth_city: string
          birth_country: string | null
          birth_date: string | null
          birth_time: string | null
          created_at: string
          display_name: string
          id: string
          legal_birth_name: string
          user_id: string
        }
        Insert: {
          birth_city?: string
          birth_country?: string | null
          birth_date?: string | null
          birth_time?: string | null
          created_at?: string
          display_name: string
          id?: string
          legal_birth_name: string
          user_id: string
        }
        Update: {
          birth_city?: string
          birth_country?: string | null
          birth_date?: string | null
          birth_time?: string | null
          created_at?: string
          display_name?: string
          id?: string
          legal_birth_name?: string
          user_id?: string
        }
        Relationships: []
      }
      match_reactions: {
        Row: {
          modality_slug: string
          reacted_at: string
          reaction: string
          user_id: string
        }
        Insert: {
          modality_slug: string
          reacted_at?: string
          reaction: string
          user_id: string
        }
        Update: {
          modality_slug?: string
          reacted_at?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_reactions_modality_slug_fkey"
            columns: ["modality_slug"]
            isOneToOne: false
            referencedRelation: "modalities"
            referencedColumns: ["slug"]
          },
        ]
      }
      meditations: {
        Row: {
          audio_url: string | null
          created_at: string
          estimated_minutes: number
          id: string
          intent: string
          mode: string
          prompt_version: string
          requested_minutes: number
          script: Json
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          estimated_minutes: number
          id?: string
          intent: string
          mode: string
          prompt_version: string
          requested_minutes: number
          script: Json
          user_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          estimated_minutes?: number
          id?: string
          intent?: string
          mode?: string
          prompt_version?: string
          requested_minutes?: number
          script?: Json
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          conversation_id: string
          counted: boolean
          created_at: string
          id: string
          linked_modality_slugs: string[]
          role: string
          text: string
          type: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          counted?: boolean
          created_at?: string
          id?: string
          linked_modality_slugs?: string[]
          role: string
          text: string
          type?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          counted?: boolean
          created_at?: string
          id?: string
          linked_modality_slugs?: string[]
          role?: string
          text?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      modalities: {
        Row: {
          contraindications: string[]
          evidence_level: string
          extra: Json
          family: string
          intensity: number
          is_active: boolean
          name_en: string
          name_es: string
          requires_clinical_support: boolean
          short_description: string
          slug: string
          typical_format: string
          typical_horizon: string
          what_happens: string
          works_well_for: string[]
        }
        Insert: {
          contraindications?: string[]
          evidence_level: string
          extra?: Json
          family: string
          intensity: number
          is_active?: boolean
          name_en: string
          name_es: string
          requires_clinical_support?: boolean
          short_description: string
          slug: string
          typical_format: string
          typical_horizon: string
          what_happens: string
          works_well_for?: string[]
        }
        Update: {
          contraindications?: string[]
          evidence_level?: string
          extra?: Json
          family?: string
          intensity?: number
          is_active?: boolean
          name_en?: string
          name_es?: string
          requires_clinical_support?: boolean
          short_description?: string
          slug?: string
          typical_format?: string
          typical_horizon?: string
          what_happens?: string
          works_well_for?: string[]
        }
        Relationships: []
      }
      modality_matches: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          prompt_version: string
          result: Json
          strategy: string
          synthesis_id: string
          used_fallback: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          prompt_version: string
          result: Json
          strategy: string
          synthesis_id: string
          used_fallback?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          prompt_version?: string
          result?: Json
          strategy?: string
          synthesis_id?: string
          used_fallback?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modality_matches_synthesis_id_fkey"
            columns: ["synthesis_id"]
            isOneToOne: false
            referencedRelation: "soul_map_syntheses"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          bed_volume: number
          locale: string
          user_id: string
          voice_volume: number
        }
        Insert: {
          bed_volume?: number
          locale?: string
          user_id: string
          voice_volume?: number
        }
        Update: {
          bed_volume?: number
          locale?: string
          user_id?: string
          voice_volume?: number
        }
        Relationships: []
      }
      recommendation_checkins: {
        Row: {
          checked_on: string
          id: string
          practice_title: string
          user_id: string
        }
        Insert: {
          checked_on: string
          id?: string
          practice_title: string
          user_id: string
        }
        Update: {
          checked_on?: string
          id?: string
          practice_title?: string
          user_id?: string
        }
        Relationships: []
      }
      soul_map_syntheses: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          latency_ms: number
          mode: string
          numerology: Json | null
          prompt_version: string
          synthesis: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          latency_ms?: number
          mode: string
          numerology?: Json | null
          prompt_version: string
          synthesis: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          latency_ms?: number
          mode?: string
          numerology?: Json | null
          prompt_version?: string
          synthesis?: Json
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          activated_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          name_en: string
          name_es: string
          slug: string
        }
        Insert: {
          name_en: string
          name_es: string
          slug: string
        }
        Update: {
          name_en?: string
          name_es?: string
          slug?: string
        }
        Relationships: []
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

