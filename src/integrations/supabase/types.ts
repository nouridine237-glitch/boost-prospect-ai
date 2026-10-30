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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ai_generations: {
        Row: {
          created_at: string
          generated_content: string
          generation_type: Database["public"]["Enums"]["ai_generation_type"]
          id: string
          prospect_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_content: string
          generation_type?: Database["public"]["Enums"]["ai_generation_type"]
          id?: string
          prospect_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          generated_content?: string
          generation_type?: Database["public"]["Enums"]["ai_generation_type"]
          id?: string
          prospect_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          bonus: boolean
          created_at: string
          credits_estimes: number
          generation_type: Database["public"]["Enums"]["ai_generation_type"]
          id: string
          user_id: string
        }
        Insert: {
          bonus?: boolean
          created_at?: string
          credits_estimes?: number
          generation_type: Database["public"]["Enums"]["ai_generation_type"]
          id?: string
          user_id: string
        }
        Update: {
          bonus?: boolean
          created_at?: string
          credits_estimes?: number
          generation_type?: Database["public"]["Enums"]["ai_generation_type"]
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      capture_pages: {
        Row: {
          created_at: string
          display_name: string
          photo_url: string | null
          seen_at: string
          slug: string
          tagline: string
          updated_at: string
          user_id: string
          visits: number
          whatsapp: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          photo_url?: string | null
          seen_at?: string
          slug: string
          tagline?: string
          updated_at?: string
          user_id: string
          visits?: number
          whatsapp?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          photo_url?: string | null
          seen_at?: string
          slug?: string
          tagline?: string
          updated_at?: string
          user_id?: string
          visits?: number
          whatsapp?: string
        }
        Relationships: []
      }
      capture_rate_limits: {
        Row: {
          created_at: string
          id: string
          ip_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          capture_paiement: string | null
          checkout_url: string | null
          created_at: string
          devise: string
          id: string
          method: string
          montant: number
          plan_demande: Database["public"]["Enums"]["paid_plan"]
          reference_transaction: string
          saspay_session_id: string | null
          statut: Database["public"]["Enums"]["payment_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          capture_paiement?: string | null
          checkout_url?: string | null
          created_at?: string
          devise?: string
          id?: string
          method?: string
          montant: number
          plan_demande: Database["public"]["Enums"]["paid_plan"]
          reference_transaction?: string
          saspay_session_id?: string | null
          statut?: Database["public"]["Enums"]["payment_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          capture_paiement?: string | null
          checkout_url?: string | null
          created_at?: string
          devise?: string
          id?: string
          method?: string
          montant?: number
          plan_demande?: Database["public"]["Enums"]["paid_plan"]
          reference_transaction?: string
          saspay_session_id?: string | null
          statut?: Database["public"]["Enums"]["payment_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          full_name: string
          id: string
          onboarded: boolean
          onboarding_dismissed: boolean
          preferences: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          full_name?: string
          id: string
          onboarded?: boolean
          onboarding_dismissed?: boolean
          preferences?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          full_name?: string
          id?: string
          onboarded?: boolean
          onboarding_dismissed?: boolean
          preferences?: Json
          updated_at?: string
        }
        Relationships: []
      }
      prospect_events: {
        Row: {
          content: string
          created_at: string
          id: string
          prospect_id: string
          type: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          prospect_id: string
          type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          prospect_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          created_at: string
          first_contact_at: string | null
          id: string
          interest_level: number | null
          joined_team_at: string | null
          last_contact_date: string | null
          main_objection: string
          name: string
          next_followup_date: string | null
          notes: string | null
          phone: string | null
          product_interest: string
          social_network: string | null
          source: string
          status: Database["public"]["Enums"]["prospect_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_contact_at?: string | null
          id?: string
          interest_level?: number | null
          joined_team_at?: string | null
          last_contact_date?: string | null
          main_objection?: string
          name: string
          next_followup_date?: string | null
          notes?: string | null
          phone?: string | null
          product_interest?: string
          social_network?: string | null
          source?: string
          status?: Database["public"]["Enums"]["prospect_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_contact_at?: string | null
          id?: string
          interest_level?: number | null
          joined_team_at?: string | null
          last_contact_date?: string | null
          main_objection?: string
          name?: string
          next_followup_date?: string | null
          notes?: string | null
          phone?: string | null
          product_interest?: string
          social_network?: string | null
          source?: string
          status?: Database["public"]["Enums"]["prospect_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          referral_id: string | null
          type: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          referral_id?: string | null
          type: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          referral_id?: string | null
          type?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          paid_rewarded: boolean
          referred_id: string
          referrer_id: string
          reward_note: string
          rewarded: boolean
          status: string
          validated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          paid_rewarded?: boolean
          referred_id: string
          referrer_id: string
          reward_note?: string
          rewarded?: boolean
          status?: string
          validated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          paid_rewarded?: boolean
          referred_id?: string
          referrer_id?: string
          reward_note?: string
          rewarded?: boolean
          status?: string
          validated_at?: string | null
        }
        Relationships: []
      }
      scripts: {
        Row: {
          category: string
          company: string | null
          content: string
          created_at: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          company?: string | null
          content: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          company?: string | null
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          date_debut: string
          date_renouvellement: string | null
          id: string
          limite_generations_ia: number
          limite_prospects: number
          plan: Database["public"]["Enums"]["plan_type"]
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_debut?: string
          date_renouvellement?: string | null
          id?: string
          limite_generations_ia?: number
          limite_prospects?: number
          plan?: Database["public"]["Enums"]["plan_type"]
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_debut?: string
          date_renouvellement?: string | null
          id?: string
          limite_generations_ia?: number
          limite_prospects?: number
          plan?: Database["public"]["Enums"]["plan_type"]
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_goals_weekly: {
        Row: {
          contacts_goal: number
          recrues_goal: number
          relances_goal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          contacts_goal?: number
          recrues_goal?: number
          relances_goal?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          contacts_goal?: number
          recrues_goal?: number
          relances_goal?: number
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
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _ai_bonus_left: { Args: { _user_id: string }; Returns: number }
      _paid_plan_of: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["plan_type"]
      }
      capture_page_view: {
        Args: { _slug: string }
        Returns: {
          display_name: string
          photo_url: string
          tagline: string
          whatsapp: string
        }[]
      }
      company_script_teasers: {
        Args: never
        Returns: {
          category: string
          company: string
          id: string
          sort_order: number
          title: string
        }[]
      }
      effective_plan: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["plan_type"]
      }
      feature_plan: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["plan_type"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_ai_bonus: { Args: never; Returns: number }
      reserve_ai_generation: {
        Args: { _type: Database["public"]["Enums"]["ai_generation_type"] }
        Returns: string
      }
      submit_capture_lead: {
        Args: {
          _interest: string
          _ip_hash: string
          _name: string
          _phone: string
          _slug: string
        }
        Returns: string
      }
    }
    Enums: {
      ai_generation_type:
        | "message_prospection"
        | "reponse_prospect"
        | "script_appel"
        | "post_reseau_social"
      app_role: "user" | "admin"
      paid_plan: "pro" | "expert" | "business"
      payment_request_status: "en_attente" | "valide" | "refuse" | "echoue"
      plan_type: "gratuit" | "pro" | "expert" | "business"
      prospect_status:
        | "nouveau"
        | "contacté"
        | "discussion"
        | "intéressé"
        | "client"
        | "non_intéressé"
      subscription_status: "actif" | "expire" | "en_attente"
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
    Enums: {
      ai_generation_type: [
        "message_prospection",
        "reponse_prospect",
        "script_appel",
        "post_reseau_social",
      ],
      app_role: ["user", "admin"],
      paid_plan: ["pro", "expert", "business"],
      payment_request_status: ["en_attente", "valide", "refuse", "echoue"],
      plan_type: ["gratuit", "pro", "expert", "business"],
      prospect_status: [
        "nouveau",
        "contacté",
        "discussion",
        "intéressé",
        "client",
        "non_intéressé",
      ],
      subscription_status: ["actif", "expire", "en_attente"],
    },
  },
} as const
