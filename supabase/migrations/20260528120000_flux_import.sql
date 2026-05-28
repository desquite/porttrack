-- =============================================================================
-- PORTTRACK — Migration #8 : module Import de Flux Excel (cahier §4)
-- =============================================================================
-- Les sous-traitants reçoivent des fichiers Excel des aconiers (MEDLOG, AGL,
-- MAERSK…) listant les conteneurs à livrer. Ce module trace chaque import dans
-- une table `flux` (le lot) et relie les conteneurs créés à leur lot d'origine.
--
--   * flux                : un lot d'import (1 fichier uploadé = 1 ligne)
--   * conteneurs.flux_id  : conteneur issu d'un import (NULL = saisie manuelle)
--   * conteneurs.mode_livraison / transporteur : 2 champs MEDLOG sans colonne
--
-- Réf cahier : flux(id, tenant_id, aconier, date_import, nombre_conteneurs,
-- statut_import) — enrichi ici avec le détail des compteurs du rapport d'import.
-- =============================================================================

-- =============================================================================
-- 1. Enum statut d'import
-- =============================================================================

create type public.flux_import_statut as enum (
  'TERMINE',   -- toutes les lignes valides ont été importées
  'PARTIEL',   -- importé avec doublons ignorés et/ou lignes en erreur
  'ECHEC'      -- aucune ligne importée (erreur globale)
);

-- =============================================================================
-- 2. Table flux (lots d'import)
-- =============================================================================

create table public.flux (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete restrict,

  aconier            text not null,                 -- MEDLOG, AGL, MAERSK, AUTRE…
  nom_fichier        text not null,
  date_import        timestamptz not null default now(),

  -- Compteurs du rapport d'import (cahier §4.3)
  nombre_lignes      integer not null default 0,    -- lignes lues dans le fichier
  nombre_importes    integer not null default 0,    -- conteneurs créés
  nombre_doublons    integer not null default 0,    -- numéros déjà présents, ignorés
  nombre_erreurs     integer not null default 0,    -- lignes invalides (ex. numéro vide)

  statut             public.flux_import_statut not null default 'TERMINE',

  created_by         uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index flux_tenant_id_idx on public.flux (tenant_id);
create index flux_tenant_date_idx on public.flux (tenant_id, date_import desc);

comment on table public.flux is
  'Lots d''import Excel des aconiers. Un fichier uploadé = une ligne. Les conteneurs créés pointent vers leur flux via conteneurs.flux_id.';

-- =============================================================================
-- 3. Enrichissement de la table conteneurs
-- =============================================================================

alter table public.conteneurs
  add column flux_id        uuid references public.flux(id) on delete set null,
  add column mode_livraison text,   -- MEDLOG « MODE DE LIVRAISON » (CHASSIS, BENNE…)
  add column transporteur   text;   -- MEDLOG « AFFECT TRSPRT » (transporteur noté par l'aconier)

create index conteneurs_flux_id_idx on public.conteneurs (flux_id)
  where flux_id is not null;

comment on column public.conteneurs.flux_id is
  'Lot d''import d''origine (NULL si saisie manuelle).';

-- =============================================================================
-- 4. RLS — isolement tenant (mêmes helpers que les autres tables métier)
-- =============================================================================

alter table public.flux enable row level security;

create policy "flux_select_same_tenant_or_super"
  on public.flux for select
  to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

create policy "flux_insert_same_tenant"
  on public.flux for insert
  to authenticated
  with check (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

create policy "flux_update_same_tenant"
  on public.flux for update
  to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  )
  with check (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

create policy "flux_delete_manager_or_super"
  on public.flux for delete
  to authenticated
  using (
    public.is_super_admin()
    or (
      public.jwt_user_role() = 'MANAGER'
      and tenant_id = public.jwt_tenant_id()
    )
  );

-- =============================================================================
-- 5. Grants
-- =============================================================================

grant select, insert, update, delete on public.flux to authenticated;
