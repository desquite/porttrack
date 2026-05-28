-- =============================================================================
-- PORTTRACK — Migration #9 : profils de mapping par aconier (cahier §4.4)
-- =============================================================================
-- « Un profil de mapping est sauvegardé par aconier — une seule configuration
-- suffit pour tous les imports futurs. »
--
-- Une ligne par (tenant, aconier) : le mapping champ standard → en-tête est
-- mémorisé après un import réussi, puis réappliqué automatiquement aux fichiers
-- suivants du même aconier. Le matching par alias/contenu reste le repli.
-- =============================================================================

create table public.flux_mapping_profiles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  aconier     text not null,
  mapping     jsonb not null default '{}'::jsonb,  -- { champ_standard: "en-tête fichier" }
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint flux_mapping_profiles_unique unique (tenant_id, aconier)
);

create index flux_mapping_profiles_tenant_idx on public.flux_mapping_profiles (tenant_id);

comment on table public.flux_mapping_profiles is
  'Mapping colonne→champ mémorisé par (tenant, aconier) pour les imports Excel.';

-- Trigger updated_at
create trigger flux_mapping_profiles_set_updated_at
  before update on public.flux_mapping_profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS — isolement tenant
-- =============================================================================

alter table public.flux_mapping_profiles enable row level security;

create policy "flux_mapping_profiles_select_same_tenant_or_super"
  on public.flux_mapping_profiles for select
  to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "flux_mapping_profiles_insert_same_tenant"
  on public.flux_mapping_profiles for insert
  to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "flux_mapping_profiles_update_same_tenant"
  on public.flux_mapping_profiles for update
  to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id())
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "flux_mapping_profiles_delete_same_tenant"
  on public.flux_mapping_profiles for delete
  to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

-- =============================================================================
-- Grants
-- =============================================================================

grant select, insert, update, delete on public.flux_mapping_profiles to authenticated;
