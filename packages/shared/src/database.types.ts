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
      affectations: {
        Row: {
          chauffeur_id: string | null
          conteneur_id: string
          created_at: string
          created_by: string | null
          date_affectation: string
          date_depart_prevue: string | null
          date_depart_reelle: string | null
          date_retour: string | null
          id: string
          km_depart: number | null
          km_retour: number | null
          notes: string | null
          remorque_id: string | null
          statut: Database["public"]["Enums"]["affectation_statut"]
          tenant_id: string
          tracteur_id: string | null
          updated_at: string
        }
        Insert: {
          chauffeur_id?: string | null
          conteneur_id: string
          created_at?: string
          created_by?: string | null
          date_affectation?: string
          date_depart_prevue?: string | null
          date_depart_reelle?: string | null
          date_retour?: string | null
          id?: string
          km_depart?: number | null
          km_retour?: number | null
          notes?: string | null
          remorque_id?: string | null
          statut?: Database["public"]["Enums"]["affectation_statut"]
          tenant_id: string
          tracteur_id?: string | null
          updated_at?: string
        }
        Update: {
          chauffeur_id?: string | null
          conteneur_id?: string
          created_at?: string
          created_by?: string | null
          date_affectation?: string
          date_depart_prevue?: string | null
          date_depart_reelle?: string | null
          date_retour?: string | null
          id?: string
          km_depart?: number | null
          km_retour?: number | null
          notes?: string | null
          remorque_id?: string | null
          statut?: Database["public"]["Enums"]["affectation_statut"]
          tenant_id?: string
          tracteur_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affectations_chauffeur_id_fkey"
            columns: ["chauffeur_id"]
            isOneToOne: false
            referencedRelation: "chauffeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affectations_conteneur_id_fkey"
            columns: ["conteneur_id"]
            isOneToOne: false
            referencedRelation: "conteneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affectations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affectations_remorque_id_fkey"
            columns: ["remorque_id"]
            isOneToOne: false
            referencedRelation: "materiel_roulant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affectations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affectations_tracteur_id_fkey"
            columns: ["tracteur_id"]
            isOneToOne: false
            referencedRelation: "materiel_roulant"
            referencedColumns: ["id"]
          },
        ]
      }
      chauffeurs: {
        Row: {
          adresse: string | null
          categories_permis: string[] | null
          created_at: string
          created_by: string | null
          date_embauche: string | null
          date_naissance: string | null
          email: string | null
          id: string
          nom: string
          notes: string | null
          numero_cni: string | null
          numero_cnps: string | null
          numero_permis: string | null
          permis_expiration: string | null
          permis_obtention: string | null
          photo_url: string | null
          prenoms: string
          search_text: string | null
          sexe: Database["public"]["Enums"]["sexe"] | null
          statut: Database["public"]["Enums"]["chauffeur_statut"]
          telephone: string
          telephone_secondaire: string | null
          tenant_id: string
          updated_at: string
          visite_medicale_expiration: string | null
        }
        Insert: {
          adresse?: string | null
          categories_permis?: string[] | null
          created_at?: string
          created_by?: string | null
          date_embauche?: string | null
          date_naissance?: string | null
          email?: string | null
          id?: string
          nom: string
          notes?: string | null
          numero_cni?: string | null
          numero_cnps?: string | null
          numero_permis?: string | null
          permis_expiration?: string | null
          permis_obtention?: string | null
          photo_url?: string | null
          prenoms: string
          search_text?: string | null
          sexe?: Database["public"]["Enums"]["sexe"] | null
          statut?: Database["public"]["Enums"]["chauffeur_statut"]
          telephone: string
          telephone_secondaire?: string | null
          tenant_id: string
          updated_at?: string
          visite_medicale_expiration?: string | null
        }
        Update: {
          adresse?: string | null
          categories_permis?: string[] | null
          created_at?: string
          created_by?: string | null
          date_embauche?: string | null
          date_naissance?: string | null
          email?: string | null
          id?: string
          nom?: string
          notes?: string | null
          numero_cni?: string | null
          numero_cnps?: string | null
          numero_permis?: string | null
          permis_expiration?: string | null
          permis_obtention?: string | null
          photo_url?: string | null
          prenoms?: string
          search_text?: string | null
          sexe?: Database["public"]["Enums"]["sexe"] | null
          statut?: Database["public"]["Enums"]["chauffeur_statut"]
          telephone?: string
          telephone_secondaire?: string | null
          tenant_id?: string
          updated_at?: string
          visite_medicale_expiration?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chauffeurs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chauffeurs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conteneurs: {
        Row: {
          client: string | null
          created_at: string
          created_by: string | null
          date_badt: string | null
          date_do: string | null
          date_livraison_prevue: string | null
          date_livraison_reelle: string | null
          destination_id: string | null
          destination_libre: string | null
          id: string
          marchandise: string | null
          navire_voyage: string | null
          notes: string | null
          num_declaration: string | null
          numero: string
          numero_bl: string | null
          origine_id: string | null
          plomb: string | null
          poids_kg: number | null
          search_text: string | null
          shipping_line_id: string | null
          statut: Database["public"]["Enums"]["conteneur_statut"]
          tenant_id: string
          transitaire: string | null
          type_conteneur_id: string | null
          type_visite: string | null
          updated_at: string
        }
        Insert: {
          client?: string | null
          created_at?: string
          created_by?: string | null
          date_badt?: string | null
          date_do?: string | null
          date_livraison_prevue?: string | null
          date_livraison_reelle?: string | null
          destination_id?: string | null
          destination_libre?: string | null
          id?: string
          marchandise?: string | null
          navire_voyage?: string | null
          notes?: string | null
          num_declaration?: string | null
          numero: string
          numero_bl?: string | null
          origine_id?: string | null
          plomb?: string | null
          poids_kg?: number | null
          search_text?: string | null
          shipping_line_id?: string | null
          statut?: Database["public"]["Enums"]["conteneur_statut"]
          tenant_id: string
          transitaire?: string | null
          type_conteneur_id?: string | null
          type_visite?: string | null
          updated_at?: string
        }
        Update: {
          client?: string | null
          created_at?: string
          created_by?: string | null
          date_badt?: string | null
          date_do?: string | null
          date_livraison_prevue?: string | null
          date_livraison_reelle?: string | null
          destination_id?: string | null
          destination_libre?: string | null
          id?: string
          marchandise?: string | null
          navire_voyage?: string | null
          notes?: string | null
          num_declaration?: string | null
          numero?: string
          numero_bl?: string | null
          origine_id?: string | null
          plomb?: string | null
          poids_kg?: number | null
          search_text?: string | null
          shipping_line_id?: string | null
          statut?: Database["public"]["Enums"]["conteneur_statut"]
          tenant_id?: string
          transitaire?: string | null
          type_conteneur_id?: string | null
          type_visite?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conteneurs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteneurs_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "port_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteneurs_origine_id_fkey"
            columns: ["origine_id"]
            isOneToOne: false
            referencedRelation: "port_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteneurs_shipping_line_id_fkey"
            columns: ["shipping_line_id"]
            isOneToOne: false
            referencedRelation: "shipping_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteneurs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteneurs_type_conteneur_id_fkey"
            columns: ["type_conteneur_id"]
            isOneToOne: false
            referencedRelation: "types_conteneur"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          date_emission: string | null
          date_expiration: string | null
          fichier_nom: string | null
          fichier_taille: number | null
          fichier_url: string | null
          id: string
          notes: string | null
          numero: string | null
          owner_id: string
          owner_type: Database["public"]["Enums"]["document_owner_type"]
          tenant_id: string
          type_document: Database["public"]["Enums"]["document_type"]
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          date_emission?: string | null
          date_expiration?: string | null
          fichier_nom?: string | null
          fichier_taille?: number | null
          fichier_url?: string | null
          id?: string
          notes?: string | null
          numero?: string | null
          owner_id: string
          owner_type: Database["public"]["Enums"]["document_owner_type"]
          tenant_id: string
          type_document: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          date_emission?: string | null
          date_expiration?: string | null
          fichier_nom?: string | null
          fichier_taille?: number | null
          fichier_url?: string | null
          id?: string
          notes?: string | null
          numero?: string | null
          owner_id?: string
          owner_type?: Database["public"]["Enums"]["document_owner_type"]
          tenant_id?: string
          type_document?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      materiel_roulant: {
        Row: {
          annee: number | null
          assurance_fin: string | null
          autorisation_dgttc_fin: string | null
          capacite_tonnes: number | null
          created_at: string
          created_by: string | null
          date_acquisition: string | null
          etat: Database["public"]["Enums"]["materiel_etat"]
          id: string
          immatriculation: string
          kilometrage_actuel: number | null
          marque: string | null
          modele: string | null
          notes: string | null
          patente_fin: string | null
          prix_acquisition_fcfa: number | null
          search_text: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["materiel_type"]
          updated_at: string
          vignette_fin: string | null
          visite_technique_fin: string | null
        }
        Insert: {
          annee?: number | null
          assurance_fin?: string | null
          autorisation_dgttc_fin?: string | null
          capacite_tonnes?: number | null
          created_at?: string
          created_by?: string | null
          date_acquisition?: string | null
          etat?: Database["public"]["Enums"]["materiel_etat"]
          id?: string
          immatriculation: string
          kilometrage_actuel?: number | null
          marque?: string | null
          modele?: string | null
          notes?: string | null
          patente_fin?: string | null
          prix_acquisition_fcfa?: number | null
          search_text?: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["materiel_type"]
          updated_at?: string
          vignette_fin?: string | null
          visite_technique_fin?: string | null
        }
        Update: {
          annee?: number | null
          assurance_fin?: string | null
          autorisation_dgttc_fin?: string | null
          capacite_tonnes?: number | null
          created_at?: string
          created_by?: string | null
          date_acquisition?: string | null
          etat?: Database["public"]["Enums"]["materiel_etat"]
          id?: string
          immatriculation?: string
          kilometrage_actuel?: number | null
          marque?: string | null
          modele?: string | null
          notes?: string | null
          patente_fin?: string | null
          prix_acquisition_fcfa?: number | null
          search_text?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["materiel_type"]
          updated_at?: string
          vignette_fin?: string | null
          visite_technique_fin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materiel_roulant_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiel_roulant_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      immutable_unaccent: { Args: { input: string }; Returns: string }
      is_manager_of: { Args: { p_tenant_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      jwt_tenant_id: { Args: never; Returns: string }
      jwt_user_role: { Args: never; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      storage_tenant_from_path: { Args: { file_name: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      affectation_statut: "PLANIFIEE" | "EN_COURS" | "TERMINEE" | "ANNULEE"
      chauffeur_statut: "ACTIF" | "EN_CONGE" | "SUSPENDU" | "INACTIF"
      conteneur_statut: "EN_ATTENTE" | "EN_COURS" | "LIVRE" | "ANNULE"
      document_owner_type: "CHAUFFEUR" | "MATERIEL"
      document_type:
        | "CNI"
        | "PERMIS_CONDUIRE"
        | "VISITE_MEDICALE"
        | "ATTESTATION_CNPS"
        | "CONTRAT_TRAVAIL"
        | "PHOTO_IDENTITE"
        | "CARTE_GRISE"
        | "ASSURANCE"
        | "VISITE_TECHNIQUE"
        | "VIGNETTE"
        | "PATENTE_TRANSPORT"
        | "AUTORISATION_DGTTC"
        | "AUTRE"
      materiel_etat:
        | "EN_SERVICE"
        | "EN_PANNE"
        | "EN_REPARATION"
        | "HORS_SERVICE"
        | "VENDU"
      materiel_type:
        | "TRACTEUR"
        | "REMORQUE"
        | "SEMI_REMORQUE"
        | "PORTE_CONTENEUR_20"
        | "PORTE_CONTENEUR_40"
        | "PORTE_CONTENEUR_MIXTE"
      plan_abonnement: "STARTER" | "BUSINESS" | "PREMIUM"
      port_kind: "PORT_MARITIME" | "VILLE_HINTERLAND" | "PORT_SEC"
      sexe: "M" | "F"
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
      affectation_statut: ["PLANIFIEE", "EN_COURS", "TERMINEE", "ANNULEE"],
      chauffeur_statut: ["ACTIF", "EN_CONGE", "SUSPENDU", "INACTIF"],
      conteneur_statut: ["EN_ATTENTE", "EN_COURS", "LIVRE", "ANNULE"],
      document_owner_type: ["CHAUFFEUR", "MATERIEL"],
      document_type: [
        "CNI",
        "PERMIS_CONDUIRE",
        "VISITE_MEDICALE",
        "ATTESTATION_CNPS",
        "CONTRAT_TRAVAIL",
        "PHOTO_IDENTITE",
        "CARTE_GRISE",
        "ASSURANCE",
        "VISITE_TECHNIQUE",
        "VIGNETTE",
        "PATENTE_TRANSPORT",
        "AUTORISATION_DGTTC",
        "AUTRE",
      ],
      materiel_etat: [
        "EN_SERVICE",
        "EN_PANNE",
        "EN_REPARATION",
        "HORS_SERVICE",
        "VENDU",
      ],
      materiel_type: [
        "TRACTEUR",
        "REMORQUE",
        "SEMI_REMORQUE",
        "PORTE_CONTENEUR_20",
        "PORTE_CONTENEUR_40",
        "PORTE_CONTENEUR_MIXTE",
      ],
      plan_abonnement: ["STARTER", "BUSINESS", "PREMIUM"],
      port_kind: ["PORT_MARITIME", "VILLE_HINTERLAND", "PORT_SEC"],
      sexe: ["M", "F"],
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
