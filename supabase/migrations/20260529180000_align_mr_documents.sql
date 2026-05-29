-- =============================================================================
-- PORTTRACK — Migration #11 : aligner les documents du Matériel Roulant (cahier v7 §8)
-- =============================================================================
-- Le cahier (v6 et v7) liste pour un tracteur 5 documents : Carte Grise,
-- Assurance, Visite Technique, **Carte de Transport**, **Carte de Stationnement**
-- (+ Patente pour la semi-remorque). Le build initial utilisait à la place
-- « Vignette » et « Autorisation DGTTC ». On réaligne sur le vocabulaire métier.
--
-- On ajoute aussi l'état INDISPONIBLE (matériel immobilisé suite à un accident),
-- distinct de EN_PANNE (panne mécanique) — requis par le module Accidents (§5.2).
-- =============================================================================

-- 1. Renommage des colonnes de dates d'expiration
alter table public.materiel_roulant
  rename column autorisation_dgttc_fin to carte_transport_fin;

alter table public.materiel_roulant
  rename column vignette_fin to carte_stationnement_fin;

-- 2. Renommage de l'index associé (suit automatiquement la colonne, on aligne le nom)
alter index if exists materiel_vignette_fin_idx
  rename to materiel_carte_stationnement_fin_idx;

-- 3. Renommage des valeurs de l'enum document_type (met à jour les lignes existantes)
alter type public.document_type rename value 'AUTORISATION_DGTTC' to 'CARTE_TRANSPORT';
alter type public.document_type rename value 'VIGNETTE' to 'CARTE_STATIONNEMENT';

-- 4. Nouvel état matériel : INDISPONIBLE (accident)
alter type public.materiel_etat add value if not exists 'INDISPONIBLE';

comment on column public.materiel_roulant.carte_transport_fin is
  'Date d''expiration de la Carte de Transport (ex-autorisation DGTTC).';
comment on column public.materiel_roulant.carte_stationnement_fin is
  'Date d''expiration de la Carte de Stationnement (ex-vignette).';
