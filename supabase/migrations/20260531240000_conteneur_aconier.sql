-- =============================================================================
-- PORTTRACK — Migration #27 : aconier par conteneur (bilan par aconier)
-- =============================================================================
-- L'aconier (compagnie qui manutentionne au terminal : MEDLOG, AGL, MAERSK,
-- CMA CGM…) figure dans la colonne « NOM » des fichiers d'import. On le stocke
-- désormais sur chaque conteneur pour permettre un bilan / reporting par
-- aconier plus tard.
-- =============================================================================

alter table public.conteneurs
  add column aconier text;

create index conteneurs_tenant_aconier_idx
  on public.conteneurs (tenant_id, aconier)
  where aconier is not null;

comment on column public.conteneurs.aconier is
  'Aconier / compagnie de manutention (depuis la colonne NOM à l''import). Base du bilan par aconier.';
