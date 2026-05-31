-- =============================================================================
-- PORTTRACK — Migration #26 : mode de livraison + remorque sur l'EIR
-- =============================================================================
-- À la confirmation de livraison, on capture désormais COMMENT le conteneur a
-- été livré et AVEC QUOI, pour préparer le futur volet « remorques / conteneurs
-- à récupérer » :
--   * mode_livraison : remorque coupée (laissée sur site) / client décharge
--     (la remorque repart) / auto-chargeur (déposé par terre, sans remorque)
--   * remorque utilisée (snapshot id + immatriculation)
--   * lieu_livraison : destination FIGÉE au moment de la livraison (pour savoir
--     où la remorque a été coupée même si la destination du conteneur change
--     plus tard via la traçabilité).
-- =============================================================================

create type public.eir_mode_livraison as enum (
  'REMORQUE_COUPEE',   -- la remorque (avec le conteneur) reste chez le client
  'CLIENT_DECHARGE',   -- le client décharge ; la remorque repart avec le chauffeur
  'AUTO_CHARGEUR'      -- déposé par terre par l'auto-chargeur (pas de remorque)
);

alter table public.eir_archives
  add column mode_livraison   public.eir_mode_livraison,
  add column remorque_id      uuid references public.materiel_roulant(id) on delete set null,
  add column remorque_immat   text,
  add column lieu_livraison   text;

comment on column public.eir_archives.mode_livraison is
  'Comment le conteneur a été livré (remorque coupée / client décharge / auto-chargeur).';
comment on column public.eir_archives.lieu_livraison is
  'Destination figée à la livraison — sert au futur suivi des remorques coupées à récupérer.';

-- Index pour le futur volet « remorques coupées à récupérer »
create index eir_archives_remorque_coupee_idx
  on public.eir_archives (tenant_id, remorque_id)
  where mode_livraison = 'REMORQUE_COUPEE';
