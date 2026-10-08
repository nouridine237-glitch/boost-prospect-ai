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
    PostgrestVersion: "14.5"
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
          created_at: string
          credits_estimes: number
          generation_type: Database["public"]["Enums"]["ai_generation_type"]
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_estimes?: number
          generation_type: Database["public"]["Enums"]["ai_generation_type"]
          id?: string
          user_id: string
        }
        Update: {
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
      payment_requests: {
        Row: {
          capture_paiement: string | null
          created_at: string
          devise: string
          id: string
          montant: number
          plan_demande: Database["public"]["Enums"]["paid_plan"]
          reference_transaction: string
          statut: Database["public"]["Enums"]["payment_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          capture_paiement?: string | null
          created_at?: string
          devise?: string
          id?: string
          montant: number
          plan_demande: Database["public"]["Enums"]["paid_plan"]
          reference_transaction?: string
          statut?: Database["public"]["Enums"]["payment_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          capture_paiement?: string | null
          created_at?: string
          devise?: string
          id?: string
          montant?: number
          plan_demande?: Database["public"]["Enums"]["paid_plan"]
          reference_transaction?: string
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
          preferences: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          full_name?: string
          id: string
          preferences?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          full_name?: string
          id?: string
          preferences?: Json
          updated_at?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          created_at: string
          id: string
          interest_level: number | null
          joined_team_at: string | null
          last_contact_date: string | null
          name: string
          next_followup_date: string | null
          notes: string | null
          phone: string | null
          social_network: string | null
          status: Database["public"]["Enums"]["prospect_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interest_level?: number | null
          joined_team_at?: string | null
          last_contact_date?: string | null
          name: string
          next_followup_date?: string | null
          notes?: string | null
          phone?: string | null
          social_network?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interest_level?: number | null
          joined_team_at?: string | null
          last_contact_date?: string | null
          name?: string
          next_followup_date?: string | null
          notes?: string | null
          phone?: string | null
          social_network?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          updated_at?: string
          user_id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      payment_request_status: "en_attente" | "valide" | "refuse"
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
      payment_request_status: ["en_attente", "valide", "refuse"],
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
