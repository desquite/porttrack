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
      port_codes: {
        Row: {
          actif: boolean
          code_unlocode: string
          created_at: string
          est_destination_courante: boolean
          id: string
          kind: Database["public"]["Enums"]["port_kind"]
          nom_lieu: string
          nom_pays: string
          pays_iso: string
        }
        Insert: {
          actif?: boolean
          code_unlocode: string
          created_at?: string
          est_destination_courante?: boolean
          id?: string
          kind: Database["public"]["Enums"]["port_kind"]
          nom_lieu: string
          nom_pays: string
          pays_iso: string
        }
        Update: {
          actif?: boolean
          code_unlocode?: string
          created_at?: string
          est_destination_courante?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["port_kind"]
          nom_lieu?: string
          nom_pays?: string
          pays_iso?: string
        }
        Relationships: []
      }
      shipping_lines: {
        Row: {
          actif: boolean
          code_scac: string
          created_at: string
          id: string
          nom: string
          nom_court: string
          pays_origine: string | null
          site_web: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          code_scac: string
          created_at?: string
          id?: string
          nom: string
          nom_court: string
          pays_origine?: string | null
          site_web?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          code_scac?: string
          created_at?: string
          id?: string
          nom?: string
          nom_court?: string
          pays_origine?: string | null
          site_web?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          adresse: string | null
          created_at: string
          date_creation: string
          date_fin_essai: string | null
          email_manager: string
          id: string
          metadata: Json
          nom_entreprise: string
          plan: Database["public"]["Enums"]["plan_abonnement"]
          rccm: string | null
          statut: Database["public"]["Enums"]["tenant_status"]
          telephone: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          date_creation?: string
          date_fin_essai?: string | null
          email_manager: string
          id?: string
          metadata?: Json
          nom_entreprise: string
          plan?: Database["public"]["Enums"]["plan_abonnement"]
          rccm?: string | null
          statut?: Database["public"]["Enums"]["tenant_status"]
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          created_at?: string
          date_creation?: string
          date_fin_essai?: string | null
          email_manager?: string
          id?: string
          metadata?: Json
          nom_entreprise?: string
          plan?: Database["public"]["Enums"]["plan_abonnement"]
          rccm?: string | null
          statut?: Database["public"]["Enums"]["tenant_status"]
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      types_conteneur: {
        Row: {
          actif: boolean
          charge_max_kg: number | null
          code_iso: string
          code_trade: string
          created_at: string
          description_fr: string
          famille: string
          id: string
          taille_pieds: number
          tare_kg: number | null
          volume_m3: number | null
        }
        Insert: {
          actif?: boolean
          charge_max_kg?: number | null
          code_iso: string
          code_trade: string
          created_at?: string
          description_fr: string
          famille: string
          id?: string
          taille_pieds: number
          tare_kg?: number | null
          volume_m3?: number | null
        }
        Update: {
          actif?: boolean
          charge_max_kg?: number | null
          code_iso?: string
          code_trade?: string
          created_at?: string
          description_fr?: string
          famille?: string
          id?: string
          taille_pieds?: number
          tare_kg?: number | null
          volume_m3?: number | null
        }
        Relationships: []
      }
      users: {
        Row: {
          actif: boolean
          created_at: string
          derniere_connexion: string | null
          email: string
          id: string
          nom: string | null
          permissions: Json
          prenoms: string | null
          role: Database["public"]["Enums"]["user_role"]
          telephone: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          derniere_connexion?: string | null
          email: string
          id: string
          nom?: string | null
          permissions?: Json
          prenoms?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          telephone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          derniere_connexion?: string | null
          email?: string
          id?: string
          nom?: string | null
          permissions?: Json
          prenoms?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          telephone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      is_manager_of: { Args: { p_tenant_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      jwt_tenant_id: { Args: never; Returns: string }
      jwt_user_role: { Args: never; Returns: string }
    }
    Enums: {
      plan_abonnement: "STARTER" | "BUSINESS" | "PREMIUM"
      port_kind: "PORT_MARITIME" | "VILLE_HINTERLAND" | "PORT_SEC"
      tenant_status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED"
      user_role:
        | "SUPER_ADMIN"
        | "MANAGER"
        | "DISPATCHER"
        | "COMPTABLE"
        | "CHEF_GARAGE"
        | "CUSTOM"
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
    Enums: {
      plan_abonnement: ["STARTER", "BUSINESS", "PREMIUM"],
      port_kind: ["PORT_MARITIME", "VILLE_HINTERLAND", "PORT_SEC"],
      tenant_status: ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"],
      user_role: [
        "SUPER_ADMIN",
        "MANAGER",
        "DISPATCHER",
        "COMPTABLE",
        "CHEF_GARAGE",
        "CUSTOM",
      ],
    },
  },
} as const
