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
      absences: {
        Row: {
          chauffeur_id: string
          created_at: string
          created_by: string | null
          date_debut: string
          date_fin: string
          id: string
          justificatif_nom: string | null
          justificatif_url: string | null
          motif: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["absence_type"]
          updated_at: string
        }
        Insert: {
          chauffeur_id: string
          created_at?: string
          created_by?: string | null
          date_debut: string
          date_fin: string
          id?: string
          justificatif_nom?: string | null
          justificatif_url?: string | null
          motif?: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["absence_type"]
          updated_at?: string
        }
        Update: {
          chauffeur_id?: string
          created_at?: string
          created_by?: string | null
          date_debut?: string
          date_fin?: string
          id?: string
          justificatif_nom?: string | null
          justificatif_url?: string | null
          motif?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["absence_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_chauffeur_id_fkey"
            columns: ["chauffeur_id"]
            isOneToOne: false
            referencedRelation: "chauffeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      accident_photos: {
        Row: {
          accident_id: string
          created_at: string
          id: string
          photo_nom: string | null
          photo_url: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          accident_id: string
          created_at?: string
          id?: string
          photo_nom?: string | null
          photo_url: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          accident_id?: string
          created_at?: string
          id?: string
          photo_nom?: string | null
          photo_url?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accident_photos_accident_id_fkey"
            columns: ["accident_id"]
            isOneToOne: false
            referencedRelation: "accidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accident_photos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accident_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      accidents: {
        Row: {
          assurance_ref: string | null
          chauffeur_id: string | null
          circonstances: string
          constat_nom: string | null
          constat_url: string | null
          created_at: string
          created_by: string | null
          date_accident: string
          date_declaration_assurance: string | null
          franchise_fcfa: number | null
          id: string
          lieu_accident: string | null
          materiel_roulant_id: string
          notes: string | null
          panne_id: string | null
          quittance_nom: string | null
          quittance_url: string | null
          remboursement_fcfa: number | null
          statut: Database["public"]["Enums"]["accident_statut"]
          tenant_id: string
          tiers_implique: boolean
          updated_at: string
        }
        Insert: {
          assurance_ref?: string | null
          chauffeur_id?: string | null
          circonstances: string
          constat_nom?: string | null
          constat_url?: string | null
          created_at?: string
          created_by?: string | null
          date_accident: string
          date_declaration_assurance?: string | null
          franchise_fcfa?: number | null
          id?: string
          lieu_accident?: string | null
          materiel_roulant_id: string
          notes?: string | null
          panne_id?: string | null
          quittance_nom?: string | null
          quittance_url?: string | null
          remboursement_fcfa?: number | null
          statut?: Database["public"]["Enums"]["accident_statut"]
          tenant_id: string
          tiers_implique?: boolean
          updated_at?: string
        }
        Update: {
          assurance_ref?: string | null
          chauffeur_id?: string | null
          circonstances?: string
          constat_nom?: string | null
          constat_url?: string | null
          created_at?: string
          created_by?: string | null
          date_accident?: string
          date_declaration_assurance?: string | null
          franchise_fcfa?: number | null
          id?: string
          lieu_accident?: string | null
          materiel_roulant_id?: string
          notes?: string | null
          panne_id?: string | null
          quittance_nom?: string | null
          quittance_url?: string | null
          remboursement_fcfa?: number | null
          statut?: Database["public"]["Enums"]["accident_statut"]
          tenant_id?: string
          tiers_implique?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accidents_chauffeur_id_fkey"
            columns: ["chauffeur_id"]
            isOneToOne: false
            referencedRelation: "chauffeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accidents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accidents_materiel_roulant_id_fkey"
            columns: ["materiel_roulant_id"]
            isOneToOne: false
            referencedRelation: "materiel_roulant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accidents_panne_id_fkey"
            columns: ["panne_id"]
            isOneToOne: false
            referencedRelation: "pannes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      bot_consultations: {
        Row: {
          code: string | null
          commande_brute: string
          created_at: string
          details: string | null
          document_type: string | null
          id: string
          immatriculation: string | null
          materiel_id: string | null
          numero_demandeur: string
          statut: Database["public"]["Enums"]["bot_consultation_statut"]
          tenant_id: string | null
        }
        Insert: {
          code?: string | null
          commande_brute: string
          created_at?: string
          details?: string | null
          document_type?: string | null
          id?: string
          immatriculation?: string | null
          materiel_id?: string | null
          numero_demandeur: string
          statut: Database["public"]["Enums"]["bot_consultation_statut"]
          tenant_id?: string | null
        }
        Update: {
          code?: string | null
          commande_brute?: string
          created_at?: string
          details?: string | null
          document_type?: string | null
          id?: string
          immatriculation?: string | null
          materiel_id?: string | null
          numero_demandeur?: string
          statut?: Database["public"]["Enums"]["bot_consultation_statut"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_consultations_materiel_id_fkey"
            columns: ["materiel_id"]
            isOneToOne: false
            referencedRelation: "materiel_roulant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_consultations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_whatsapp_numeros: {
        Row: {
          actif: boolean
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          numero: string
          numero_core: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          numero: string
          numero_core?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          numero?: string
          numero_core?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_whatsapp_numeros_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_whatsapp_numeros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chauffeurs: {
        Row: {
          adresse: string | null
          auth_user_id: string | null
          categories_permis: string[] | null
          created_at: string
          created_by: string | null
          date_embauche: string | null
          date_naissance: string | null
          email: string | null
          equipe_id_defaut: string | null
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
          auth_user_id?: string | null
          categories_permis?: string[] | null
          created_at?: string
          created_by?: string | null
          date_embauche?: string | null
          date_naissance?: string | null
          email?: string | null
          equipe_id_defaut?: string | null
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
          auth_user_id?: string | null
          categories_permis?: string[] | null
          created_at?: string
          created_by?: string | null
          date_embauche?: string | null
          date_naissance?: string | null
          email?: string | null
          equipe_id_defaut?: string | null
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
            foreignKeyName: "chauffeurs_equipe_id_defaut_fkey"
            columns: ["equipe_id_defaut"]
            isOneToOne: false
            referencedRelation: "equipes"
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
      checklist_items_config: {
        Row: {
          actif: boolean
          code: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          ordre: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          ordre?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          ordre?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_config_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_photos: {
        Row: {
          checklist_id: string
          created_at: string
          id: string
          photo_nom: string | null
          photo_url: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          checklist_id: string
          created_at?: string
          id?: string
          photo_nom?: string | null
          photo_url: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          checklist_id?: string
          created_at?: string
          id?: string
          photo_nom?: string | null
          photo_url?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_photos_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists_depart"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_photos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_responses: {
        Row: {
          checklist_id: string
          created_at: string
          etat: Database["public"]["Enums"]["checklist_item_etat"]
          id: string
          item_config_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          checklist_id: string
          created_at?: string
          etat?: Database["public"]["Enums"]["checklist_item_etat"]
          id?: string
          item_config_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          checklist_id?: string
          created_at?: string
          etat?: Database["public"]["Enums"]["checklist_item_etat"]
          id?: string
          item_config_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_responses_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists_depart"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_responses_item_config_id_fkey"
            columns: ["item_config_id"]
            isOneToOne: false
            referencedRelation: "checklist_items_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists_depart: {
        Row: {
          chauffeur_id: string
          created_at: string
          created_by: string | null
          date_depart: string
          designation_id: string
          heure_validation: string
          id: string
          materiel_roulant_id: string
          remarque: string | null
          statut_global: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          chauffeur_id: string
          created_at?: string
          created_by?: string | null
          date_depart?: string
          designation_id: string
          heure_validation?: string
          id?: string
          materiel_roulant_id: string
          remarque?: string | null
          statut_global?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          chauffeur_id?: string
          created_at?: string
          created_by?: string | null
          date_depart?: string
          designation_id?: string
          heure_validation?: string
          id?: string
          materiel_roulant_id?: string
          remarque?: string | null
          statut_global?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_depart_chauffeur_id_fkey"
            columns: ["chauffeur_id"]
            isOneToOne: false
            referencedRelation: "chauffeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_depart_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_depart_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: true
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_depart_materiel_roulant_id_fkey"
            columns: ["materiel_roulant_id"]
            isOneToOne: false
            referencedRelation: "materiel_roulant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_depart_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conteneurs: {
        Row: {
          aconier: string | null
          client: string | null
          created_at: string
          created_by: string | null
          date_badt: string | null
          date_do: string | null
          date_livraison_prevue: string | null
          date_livraison_reelle: string | null
          destination_id: string | null
          destination_libre: string | null
          flux_id: string | null
          id: string
          marchandise: string | null
          mode_livraison: string | null
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
          transporteur: string | null
          type_conteneur_id: string | null
          type_visite: string | null
          updated_at: string
        }
        Insert: {
          aconier?: string | null
          client?: string | null
          created_at?: string
          created_by?: string | null
          date_badt?: string | null
          date_do?: string | null
          date_livraison_prevue?: string | null
          date_livraison_reelle?: string | null
          destination_id?: string | null
          destination_libre?: string | null
          flux_id?: string | null
          id?: string
          marchandise?: string | null
          mode_livraison?: string | null
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
          transporteur?: string | null
          type_conteneur_id?: string | null
          type_visite?: string | null
          updated_at?: string
        }
        Update: {
          aconier?: string | null
          client?: string | null
          created_at?: string
          created_by?: string | null
          date_badt?: string | null
          date_do?: string | null
          date_livraison_prevue?: string | null
          date_livraison_reelle?: string | null
          destination_id?: string | null
          destination_libre?: string | null
          flux_id?: string | null
          id?: string
          marchandise?: string | null
          mode_livraison?: string | null
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
          transporteur?: string | null
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
            foreignKeyName: "conteneurs_flux_id_fkey"
            columns: ["flux_id"]
            isOneToOne: false
            referencedRelation: "flux"
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
      designations: {
        Row: {
          annulee_at: string | null
          annulee_motif: string | null
          chauffeur_id: string
          created_at: string
          created_by: string | null
          date_designation: string
          equipe_id: string | null
          id: string
          materiel_roulant_id: string
          notes: string | null
          poste: Database["public"]["Enums"]["designation_poste"]
          tenant_id: string
          updated_at: string
          validee_at: string | null
          whatsapp_attempts: number
          whatsapp_error: string | null
          whatsapp_sent_at: string | null
          whatsapp_statut: Database["public"]["Enums"]["designation_whatsapp_statut"]
        }
        Insert: {
          annulee_at?: string | null
          annulee_motif?: string | null
          chauffeur_id: string
          created_at?: string
          created_by?: string | null
          date_designation?: string
          equipe_id?: string | null
          id?: string
          materiel_roulant_id: string
          notes?: string | null
          poste?: Database["public"]["Enums"]["designation_poste"]
          tenant_id: string
          updated_at?: string
          validee_at?: string | null
          whatsapp_attempts?: number
          whatsapp_error?: string | null
          whatsapp_sent_at?: string | null
          whatsapp_statut?: Database["public"]["Enums"]["designation_whatsapp_statut"]
        }
        Update: {
          annulee_at?: string | null
          annulee_motif?: string | null
          chauffeur_id?: string
          created_at?: string
          created_by?: string | null
          date_designation?: string
          equipe_id?: string | null
          id?: string
          materiel_roulant_id?: string
          notes?: string | null
          poste?: Database["public"]["Enums"]["designation_poste"]
          tenant_id?: string
          updated_at?: string
          validee_at?: string | null
          whatsapp_attempts?: number
          whatsapp_error?: string | null
          whatsapp_sent_at?: string | null
          whatsapp_statut?: Database["public"]["Enums"]["designation_whatsapp_statut"]
        }
        Relationships: [
          {
            foreignKeyName: "designations_chauffeur_id_fkey"
            columns: ["chauffeur_id"]
            isOneToOne: false
            referencedRelation: "chauffeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designations_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designations_materiel_roulant_id_fkey"
            columns: ["materiel_roulant_id"]
            isOneToOne: false
            referencedRelation: "materiel_roulant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      eir_archives: {
        Row: {
          affectation_id: string | null
          chauffeur_id: string | null
          chauffeur_nom: string | null
          conteneur_id: string
          created_at: string
          date_livraison: string
          fichier_nom: string | null
          fichier_url: string
          id: string
          lieu_livraison: string | null
          mode_livraison:
            | Database["public"]["Enums"]["eir_mode_livraison"]
            | null
          remorque_id: string | null
          remorque_immat: string | null
          tenant_id: string
          tracteur_id: string | null
          tracteur_immat: string | null
          uploaded_by: string | null
          uploaded_by_email: string | null
        }
        Insert: {
          affectation_id?: string | null
          chauffeur_id?: string | null
          chauffeur_nom?: string | null
          conteneur_id: string
          created_at?: string
          date_livraison?: string
          fichier_nom?: string | null
          fichier_url: string
          id?: string
          lieu_livraison?: string | null
          mode_livraison?:
            | Database["public"]["Enums"]["eir_mode_livraison"]
            | null
          remorque_id?: string | null
          remorque_immat?: string | null
          tenant_id: string
          tracteur_id?: string | null
          tracteur_immat?: string | null
          uploaded_by?: string | null
          uploaded_by_email?: string | null
        }
        Update: {
          affectation_id?: string | null
          chauffeur_id?: string | null
          chauffeur_nom?: string | null
          conteneur_id?: string
          created_at?: string
          date_livraison?: string
          fichier_nom?: string | null
          fichier_url?: string
          id?: string
          lieu_livraison?: string | null
          mode_livraison?:
            | Database["public"]["Enums"]["eir_mode_livraison"]
            | null
          remorque_id?: string | null
          remorque_immat?: string | null
          tenant_id?: string
          tracteur_id?: string | null
          tracteur_immat?: string | null
          uploaded_by?: string | null
          uploaded_by_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eir_archives_affectation_id_fkey"
            columns: ["affectation_id"]
            isOneToOne: false
            referencedRelation: "affectations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eir_archives_chauffeur_id_fkey"
            columns: ["chauffeur_id"]
            isOneToOne: false
            referencedRelation: "chauffeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eir_archives_conteneur_id_fkey"
            columns: ["conteneur_id"]
            isOneToOne: false
            referencedRelation: "conteneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eir_archives_remorque_id_fkey"
            columns: ["remorque_id"]
            isOneToOne: false
            referencedRelation: "materiel_roulant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eir_archives_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eir_archives_tracteur_id_fkey"
            columns: ["tracteur_id"]
            isOneToOne: false
            referencedRelation: "materiel_roulant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eir_archives_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          actif: boolean
          code: string
          couleur: string
          created_at: string
          created_by: string | null
          heure_debut: string | null
          heure_fin: string | null
          id: string
          jours_travailles: number[]
          nom: string
          notes: string | null
          ordre: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          code: string
          couleur?: string
          created_at?: string
          created_by?: string | null
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          jours_travailles?: number[]
          nom: string
          notes?: string | null
          ordre?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          code?: string
          couleur?: string
          created_at?: string
          created_by?: string | null
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          jours_travailles?: number[]
          nom?: string
          notes?: string | null
          ordre?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      flux: {
        Row: {
          aconier: string
          created_at: string
          created_by: string | null
          date_import: string
          id: string
          nom_fichier: string
          nombre_doublons: number
          nombre_erreurs: number
          nombre_importes: number
          nombre_lignes: number
          statut: Database["public"]["Enums"]["flux_import_statut"]
          tenant_id: string
        }
        Insert: {
          aconier: string
          created_at?: string
          created_by?: string | null
          date_import?: string
          id?: string
          nom_fichier: string
          nombre_doublons?: number
          nombre_erreurs?: number
          nombre_importes?: number
          nombre_lignes?: number
          statut?: Database["public"]["Enums"]["flux_import_statut"]
          tenant_id: string
        }
        Update: {
          aconier?: string
          created_at?: string
          created_by?: string | null
          date_import?: string
          id?: string
          nom_fichier?: string
          nombre_doublons?: number
          nombre_erreurs?: number
          nombre_importes?: number
          nombre_lignes?: number
          statut?: Database["public"]["Enums"]["flux_import_statut"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flux_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flux_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      flux_mapping_profiles: {
        Row: {
          aconier: string
          created_at: string
          created_by: string | null
          id: string
          mapping: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          aconier: string
          created_at?: string
          created_by?: string | null
          id?: string
          mapping?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          aconier?: string
          created_at?: string
          created_by?: string | null
          id?: string
          mapping?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flux_mapping_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flux_mapping_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      infractions: {
        Row: {
          chauffeur_id: string
          created_at: string
          created_by: string | null
          date_infraction: string
          date_limite_paiement: string | null
          date_paiement: string | null
          description: string | null
          id: string
          imputation: Database["public"]["Enums"]["infraction_imputation"]
          lieu_infraction: string | null
          materiel_roulant_id: string | null
          montant_fcfa: number
          notes: string | null
          pv_nom: string | null
          pv_url: string | null
          recu_nom: string | null
          recu_url: string | null
          statut: Database["public"]["Enums"]["infraction_statut"]
          tenant_id: string
          type_infraction: string
          updated_at: string
        }
        Insert: {
          chauffeur_id: string
          created_at?: string
          created_by?: string | null
          date_infraction: string
          date_limite_paiement?: string | null
          date_paiement?: string | null
          description?: string | null
          id?: string
          imputation?: Database["public"]["Enums"]["infraction_imputation"]
          lieu_infraction?: string | null
          materiel_roulant_id?: string | null
          montant_fcfa: number
          notes?: string | null
          pv_nom?: string | null
          pv_url?: string | null
          recu_nom?: string | null
          recu_url?: string | null
          statut?: Database["public"]["Enums"]["infraction_statut"]
          tenant_id: string
          type_infraction: string
          updated_at?: string
        }
        Update: {
          chauffeur_id?: string
          created_at?: string
          created_by?: string | null
          date_infraction?: string
          date_limite_paiement?: string | null
          date_paiement?: string | null
          description?: string | null
          id?: string
          imputation?: Database["public"]["Enums"]["infraction_imputation"]
          lieu_infraction?: string | null
          materiel_roulant_id?: string | null
          montant_fcfa?: number
          notes?: string | null
          pv_nom?: string | null
          pv_url?: string | null
          recu_nom?: string | null
          recu_url?: string | null
          statut?: Database["public"]["Enums"]["infraction_statut"]
          tenant_id?: string
          type_infraction?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "infractions_chauffeur_id_fkey"
            columns: ["chauffeur_id"]
            isOneToOne: false
            referencedRelation: "chauffeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infractions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infractions_materiel_roulant_id_fkey"
            columns: ["materiel_roulant_id"]
            isOneToOne: false
            referencedRelation: "materiel_roulant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infractions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      materiel_roulant: {
        Row: {
          annee: number | null
          assurance_fin: string | null
          capacite_tonnes: number | null
          carte_stationnement_fin: string | null
          carte_transport_fin: string | null
          chrono: string | null
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
          visite_technique_fin: string | null
        }
        Insert: {
          annee?: number | null
          assurance_fin?: string | null
          capacite_tonnes?: number | null
          carte_stationnement_fin?: string | null
          carte_transport_fin?: string | null
          chrono?: string | null
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
          visite_technique_fin?: string | null
        }
        Update: {
          annee?: number | null
          assurance_fin?: string | null
          capacite_tonnes?: number | null
          carte_stationnement_fin?: string | null
          carte_transport_fin?: string | null
          chrono?: string | null
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
      modifications_historique: {
        Row: {
          champ: string
          champ_label: string
          created_at: string
          enregistrement_id: string
          id: string
          justificatif_nom: string | null
          justificatif_url: string
          motif: string
          table_cible: string
          tenant_id: string
          user_email: string | null
          user_id: string | null
          user_nom: string | null
          valeur_apres: string | null
          valeur_avant: string | null
        }
        Insert: {
          champ: string
          champ_label: string
          created_at?: string
          enregistrement_id: string
          id?: string
          justificatif_nom?: string | null
          justificatif_url: string
          motif: string
          table_cible: string
          tenant_id: string
          user_email?: string | null
          user_id?: string | null
          user_nom?: string | null
          valeur_apres?: string | null
          valeur_avant?: string | null
        }
        Update: {
          champ?: string
          champ_label?: string
          created_at?: string
          enregistrement_id?: string
          id?: string
          justificatif_nom?: string | null
          justificatif_url?: string
          motif?: string
          table_cible?: string
          tenant_id?: string
          user_email?: string | null
          user_id?: string | null
          user_nom?: string | null
          valeur_apres?: string | null
          valeur_avant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modifications_historique_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifications_historique_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pannes: {
        Row: {
          chauffeur_id: string | null
          cout_estime_fcfa: number | null
          cout_reel_fcfa: number | null
          created_at: string
          created_by: string | null
          date_debut_reparation: string | null
          date_declaration: string
          date_fin_reparation: string | null
          description: string
          facture_nom: string | null
          facture_url: string | null
          garage: string | null
          id: string
          materiel_roulant_id: string
          notes: string | null
          statut: Database["public"]["Enums"]["panne_statut"]
          tenant_id: string
          type_panne: string | null
          updated_at: string
        }
        Insert: {
          chauffeur_id?: string | null
          cout_estime_fcfa?: number | null
          cout_reel_fcfa?: number | null
          created_at?: string
          created_by?: string | null
          date_debut_reparation?: string | null
          date_declaration?: string
          date_fin_reparation?: string | null
          description: string
          facture_nom?: string | null
          facture_url?: string | null
          garage?: string | null
          id?: string
          materiel_roulant_id: string
          notes?: string | null
          statut?: Database["public"]["Enums"]["panne_statut"]
          tenant_id: string
          type_panne?: string | null
          updated_at?: string
        }
        Update: {
          chauffeur_id?: string | null
          cout_estime_fcfa?: number | null
          cout_reel_fcfa?: number | null
          created_at?: string
          created_by?: string | null
          date_debut_reparation?: string | null
          date_declaration?: string
          date_fin_reparation?: string | null
          description?: string
          facture_nom?: string | null
          facture_url?: string | null
          garage?: string | null
          id?: string
          materiel_roulant_id?: string
          notes?: string | null
          statut?: Database["public"]["Enums"]["panne_statut"]
          tenant_id?: string
          type_panne?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pannes_chauffeur_id_fkey"
            columns: ["chauffeur_id"]
            isOneToOne: false
            referencedRelation: "chauffeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pannes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pannes_materiel_roulant_id_fkey"
            columns: ["materiel_roulant_id"]
            isOneToOne: false
            referencedRelation: "materiel_roulant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pannes_tenant_id_fkey"
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
      recuperations: {
        Row: {
          chauffeur_id: string | null
          chauffeur_nom: string | null
          confirmed_by: string | null
          conteneur_id: string
          created_at: string
          created_by: string | null
          date_planifiee: string | null
          date_recuperation: string | null
          destination_lieu: string | null
          destination_type: string | null
          eir_nom: string | null
          eir_url: string | null
          id: string
          remorque_id: string | null
          remorque_immat: string | null
          statut: string
          tenant_id: string
          tracteur_id: string | null
          tracteur_immat: string | null
          updated_at: string
        }
        Insert: {
          chauffeur_id?: string | null
          chauffeur_nom?: string | null
          confirmed_by?: string | null
          conteneur_id: string
          created_at?: string
          created_by?: string | null
          date_planifiee?: string | null
          date_recuperation?: string | null
          destination_lieu?: string | null
          destination_type?: string | null
          eir_nom?: string | null
          eir_url?: string | null
          id?: string
          remorque_id?: string | null
          remorque_immat?: string | null
          statut?: string
          tenant_id: string
          tracteur_id?: string | null
          tracteur_immat?: string | null
          updated_at?: string
        }
        Update: {
          chauffeur_id?: string | null
          chauffeur_nom?: string | null
          confirmed_by?: string | null
          conteneur_id?: string
          created_at?: string
          created_by?: string | null
          date_planifiee?: string | null
          date_recuperation?: string | null
          destination_lieu?: string | null
          destination_type?: string | null
          eir_nom?: string | null
          eir_url?: string | null
          id?: string
          remorque_id?: string | null
          remorque_immat?: string | null
          statut?: string
          tenant_id?: string
          tracteur_id?: string | null
          tracteur_immat?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recuperations_chauffeur_id_fkey"
            columns: ["chauffeur_id"]
            isOneToOne: false
            referencedRelation: "chauffeurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recuperations_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recuperations_conteneur_id_fkey"
            columns: ["conteneur_id"]
            isOneToOne: false
            referencedRelation: "conteneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recuperations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recuperations_remorque_id_fkey"
            columns: ["remorque_id"]
            isOneToOne: false
            referencedRelation: "materiel_roulant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recuperations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recuperations_tracteur_id_fkey"
            columns: ["tracteur_id"]
            isOneToOne: false
            referencedRelation: "materiel_roulant"
            referencedColumns: ["id"]
          },
        ]
      }
      roulement_config: {
        Row: {
          created_at: string
          date_reference: string
          equipe_jour_id: string
          equipe_nuit_id: string
          equipe_repos_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          date_reference: string
          equipe_jour_id: string
          equipe_nuit_id: string
          equipe_repos_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          date_reference?: string
          equipe_jour_id?: string
          equipe_nuit_id?: string
          equipe_repos_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roulement_config_equipe_jour_id_fkey"
            columns: ["equipe_jour_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulement_config_equipe_nuit_id_fkey"
            columns: ["equipe_nuit_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulement_config_equipe_repos_id_fkey"
            columns: ["equipe_repos_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulement_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      current_chauffeur_equipe: { Args: never; Returns: string }
      current_chauffeur_id: { Args: never; Returns: string }
      current_chauffeur_tenant: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      immutable_unaccent: { Args: { input: string }; Returns: string }
      is_manager_of: { Args: { p_tenant_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      jwt_tenant_id: { Args: never; Returns: string }
      jwt_user_role: { Args: never; Returns: string }
      recompute_checklist_statut: {
        Args: { p_checklist_id: string }
        Returns: undefined
      }
      seed_checklist_items_for_tenant: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      storage_tenant_from_path: { Args: { file_name: string }; Returns: string }
      sync_materiel_etat_for_panne: {
        Args: { p_mr_id: string }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      absence_type:
        | "CONGE_PLANIFIE"
        | "ABSENCE_IMPREVUE"
        | "MALADIE"
        | "FORMATION"
        | "AUTRE"
      accident_statut: "DECLARE" | "EN_COURS_TRAITEMENT" | "CLOTURE"
      affectation_statut: "PLANIFIEE" | "EN_COURS" | "TERMINEE" | "ANNULEE"
      bot_consultation_statut:
        | "REPONDU"
        | "NON_AUTORISE"
        | "COMMANDE_INVALIDE"
        | "MATERIEL_INTROUVABLE"
        | "DOC_INTROUVABLE"
      chauffeur_statut: "ACTIF" | "EN_CONGE" | "SUSPENDU" | "INACTIF"
      checklist_item_etat: "OK" | "ANOMALIE"
      conteneur_statut: "EN_ATTENTE" | "EN_COURS" | "LIVRE" | "ANNULE"
      designation_poste: "JOUR" | "NUIT"
      designation_whatsapp_statut: "PENDING" | "SENT" | "FAILED" | "SKIPPED"
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
        | "CARTE_STATIONNEMENT"
        | "PATENTE_TRANSPORT"
        | "CARTE_TRANSPORT"
        | "AUTRE"
      eir_mode_livraison:
        | "REMORQUE_COUPEE"
        | "CLIENT_DECHARGE"
        | "AUTO_CHARGEUR"
      flux_import_statut: "TERMINE" | "PARTIEL" | "ECHEC"
      infraction_imputation: "ENTREPRISE" | "CHAUFFEUR"
      infraction_statut: "NON_PAYEE" | "PAYEE" | "CONTESTEE"
      materiel_etat:
        | "EN_SERVICE"
        | "EN_PANNE"
        | "EN_REPARATION"
        | "HORS_SERVICE"
        | "VENDU"
        | "INDISPONIBLE"
      materiel_type:
        | "TRACTEUR"
        | "REMORQUE"
        | "SEMI_REMORQUE"
        | "PORTE_CONTENEUR_20"
        | "PORTE_CONTENEUR_40"
        | "PORTE_CONTENEUR_MIXTE"
        | "REMORQUE_20"
        | "REMORQUE_40"
        | "AUTO_CHARGEUSE"
      panne_statut: "DECLAREE" | "EN_REPARATION" | "REPAREE" | "ANNULEE"
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
  public: {
    Enums: {
      absence_type: [
        "CONGE_PLANIFIE",
        "ABSENCE_IMPREVUE",
        "MALADIE",
        "FORMATION",
        "AUTRE",
      ],
      accident_statut: ["DECLARE", "EN_COURS_TRAITEMENT", "CLOTURE"],
      affectation_statut: ["PLANIFIEE", "EN_COURS", "TERMINEE", "ANNULEE"],
      bot_consultation_statut: [
        "REPONDU",
        "NON_AUTORISE",
        "COMMANDE_INVALIDE",
        "MATERIEL_INTROUVABLE",
        "DOC_INTROUVABLE",
      ],
      chauffeur_statut: ["ACTIF", "EN_CONGE", "SUSPENDU", "INACTIF"],
      checklist_item_etat: ["OK", "ANOMALIE"],
      conteneur_statut: ["EN_ATTENTE", "EN_COURS", "LIVRE", "ANNULE"],
      designation_poste: ["JOUR", "NUIT"],
      designation_whatsapp_statut: ["PENDING", "SENT", "FAILED", "SKIPPED"],
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
        "CARTE_STATIONNEMENT",
        "PATENTE_TRANSPORT",
        "CARTE_TRANSPORT",
        "AUTRE",
      ],
      eir_mode_livraison: [
        "REMORQUE_COUPEE",
        "CLIENT_DECHARGE",
        "AUTO_CHARGEUR",
      ],
      flux_import_statut: ["TERMINE", "PARTIEL", "ECHEC"],
      infraction_imputation: ["ENTREPRISE", "CHAUFFEUR"],
      infraction_statut: ["NON_PAYEE", "PAYEE", "CONTESTEE"],
      materiel_etat: [
        "EN_SERVICE",
        "EN_PANNE",
        "EN_REPARATION",
        "HORS_SERVICE",
        "VENDU",
        "INDISPONIBLE",
      ],
      materiel_type: [
        "TRACTEUR",
        "REMORQUE",
        "SEMI_REMORQUE",
        "PORTE_CONTENEUR_20",
        "PORTE_CONTENEUR_40",
        "PORTE_CONTENEUR_MIXTE",
        "REMORQUE_20",
        "REMORQUE_40",
        "AUTO_CHARGEUSE",
      ],
      panne_statut: ["DECLAREE", "EN_REPARATION", "REPAREE", "ANNULEE"],
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
