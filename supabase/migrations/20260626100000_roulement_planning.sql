-- =============================================================================
-- Migration #34 — Planning chauffeurs en roulement (3 équipes 2J/2N/2repos)
-- =============================================================================
-- Remplace l'ancien planning hebdomadaire (dérivé de equipes.jours_travailles)
-- par un ROULEMENT calculé : chaque équipe enchaîne 2 jours JOUR, 2 jours NUIT,
-- 2 jours REPOS (cycle individuel de 6 jours), les 3 équipes étant décalées de
-- 2 jours pour qu'à tout instant 1 équipe soit en JOUR, 1 en NUIT, 1 en REPOS.
--
-- Le cycle est entièrement déterminé par 2 réglages (table roulement_config) :
--   * une DATE DE RÉFÉRENCE = 1er jour d'un bloc de 2 jours (jour 1 du poste) ;
--   * l'affectation des 3 équipes aux 3 postes à cette date.
-- À partir de là, le poste de n'importe quelle équipe à n'importe quelle date
-- se calcule côté code (packages/shared/src/roulement.ts). Recalable à volonté.
--
-- La DÉSIGNATION (chauffeur ↔ camion) gagne un POSTE (JOUR/NUIT) : le planning
-- filtre les chauffeurs désignables (ceux en poste ce jour-là), et un même
-- chauffeur/camion peut être désigné 2 fois le même jour calendaire (1 jour +
-- 1 nuit) sans violer l'unicité.
-- =============================================================================

-- 1. Poste d'une désignation (jour / nuit). Le repos n'est jamais désigné.
do $$ begin
  create type public.designation_poste as enum ('JOUR', 'NUIT');
exception when duplicate_object then null; end $$;

alter table public.designations
  add column if not exists poste public.designation_poste not null default 'JOUR';

comment on column public.designations.poste is
  'Poste de la désignation (JOUR/NUIT). Permet 2 désignations le même jour calendaire (1 jour + 1 nuit). Migration #34.';

-- 2. Les contraintes UNIQUE actives intègrent le poste : un chauffeur (resp. un
--    camion) ne peut être désigné qu'une fois par (jour, poste).
drop index if exists public.designations_chauffeur_unique_actif;
drop index if exists public.designations_materiel_unique_actif;

create unique index if not exists designations_chauffeur_unique_actif
  on public.designations (tenant_id, chauffeur_id, date_designation, poste)
  where annulee_at is null;

create unique index if not exists designations_materiel_unique_actif
  on public.designations (tenant_id, materiel_roulant_id, date_designation, poste)
  where annulee_at is null;

-- 3. Réglage du roulement : une ligne par tenant.
create table if not exists public.roulement_config (
  tenant_id        uuid primary key references public.tenants(id) on delete cascade,
  date_reference   date not null,
  equipe_jour_id   uuid not null references public.equipes(id) on delete restrict,
  equipe_nuit_id   uuid not null references public.equipes(id) on delete restrict,
  equipe_repos_id  uuid not null references public.equipes(id) on delete restrict,
  updated_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint roulement_equipes_distinctes check (
    equipe_jour_id <> equipe_nuit_id
    and equipe_jour_id <> equipe_repos_id
    and equipe_nuit_id <> equipe_repos_id
  )
);

comment on table public.roulement_config is
  'Réglage du planning en roulement : date de référence (jour 1) + équipe sur chaque poste à cette date. Le reste du cycle 2J/2N/2repos est calculé côté code. Migration #34.';

create trigger set_roulement_config_updated_at
  before update on public.roulement_config
  for each row execute function public.set_updated_at();

alter table public.roulement_config enable row level security;

create policy "roulement_config_select_same_tenant_or_super"
  on public.roulement_config for select
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "roulement_config_insert_manager_or_super"
  on public.roulement_config for insert
  with check (
    public.is_super_admin()
    or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id())
  );

create policy "roulement_config_update_manager_or_super"
  on public.roulement_config for update
  using (
    public.is_super_admin()
    or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id())
  )
  with check (
    public.is_super_admin()
    or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id())
  );

create policy "roulement_config_delete_manager_or_super"
  on public.roulement_config for delete
  using (
    public.is_super_admin()
    or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id())
  );
