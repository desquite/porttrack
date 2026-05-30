-- =============================================================================
-- PORTTRACK — Migration #14 : module Infractions & Amendes (cahier v7 §5.3)
-- =============================================================================
-- Enregistrement des infractions routières (excès vitesse, stationnement,
-- défaut document…) avec suivi du paiement et imputation entreprise / chauffeur.
-- Tableau de bord : top chauffeurs infractionnaires, montant total des amendes,
-- amendes en attente de paiement.
-- =============================================================================

-- 1. Enums
create type public.infraction_statut as enum (
  'NON_PAYEE',
  'PAYEE',
  'CONTESTEE'
);

create type public.infraction_imputation as enum (
  'ENTREPRISE',
  'CHAUFFEUR'
);

-- 2. Table infractions
create table public.infractions (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete restrict,
  chauffeur_id          uuid not null references public.chauffeurs(id) on delete restrict,
  materiel_roulant_id   uuid references public.materiel_roulant(id) on delete set null,

  date_infraction       date not null,
  lieu_infraction       text,
  type_infraction       text not null,
  description           text,
  montant_fcfa          numeric(12, 0) not null,

  -- Documents
  pv_url                text,
  pv_nom                text,
  recu_url              text,
  recu_nom              text,

  -- Paiement
  date_limite_paiement  date,
  date_paiement         date,

  statut                public.infraction_statut not null default 'NON_PAYEE',
  imputation            public.infraction_imputation not null default 'ENTREPRISE',

  notes                 text,
  created_by            uuid references public.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index infractions_tenant_idx          on public.infractions (tenant_id);
create index infractions_tenant_statut_idx   on public.infractions (tenant_id, statut);
create index infractions_chauffeur_idx       on public.infractions (chauffeur_id);
create index infractions_materiel_idx        on public.infractions (materiel_roulant_id) where materiel_roulant_id is not null;
create index infractions_tenant_date_idx     on public.infractions (tenant_id, date_infraction desc);

comment on table public.infractions is
  'Infractions routières + amendes par chauffeur (cahier §5.3). Statut paiement, imputation entreprise/chauffeur, contestation.';

-- 3. Trigger updated_at
create trigger infractions_set_updated_at
  before update on public.infractions
  for each row execute function public.set_updated_at();

-- 4. RLS
alter table public.infractions enable row level security;

create policy "infractions_select_same_tenant_or_super"
  on public.infractions for select to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "infractions_insert_same_tenant"
  on public.infractions for insert to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "infractions_update_same_tenant"
  on public.infractions for update to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id())
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "infractions_delete_manager_or_super"
  on public.infractions for delete to authenticated
  using (
    public.is_super_admin()
    or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id())
  );

grant select, insert, update, delete on public.infractions to authenticated;
