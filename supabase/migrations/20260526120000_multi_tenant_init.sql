-- =============================================================================
-- PORTTRACK — Migration 0001 : Multi-tenant init
-- =============================================================================
-- Pose les fondations multi-tenant strictes (cahier des charges §2 et §3) :
--
--   * tenants                    : entreprises clientes (sous-traitants)
--   * users                      : utilisateurs métier, FK 1:1 vers auth.users
--   * RLS sur les deux tables    : isolation par tenant_id depuis le JWT
--   * trigger handle_new_user    : crée public.users à chaque signup
--   * custom_access_token_hook   : injecte tenant_id + user_role dans le JWT
--   * helpers jwt_tenant_id()    : utilisés par les RLS policies suivantes
--
-- À activer manuellement après application :
--   Dashboard → Authentication → Hooks → Custom Access Token
--   → choisir public.custom_access_token_hook
-- =============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- =============================================================================
-- 1. Types énumérés
-- =============================================================================

create type public.user_role as enum (
  'SUPER_ADMIN',  -- Porttrack (niveau 0, cahier §2.2)
  'MANAGER',      -- Admin entreprise (niveau 1)
  'DISPATCHER',   -- Gère flux & affectations
  'COMPTABLE',    -- Gère facturation & CA
  'CHEF_GARAGE',  -- Gère pannes & réparations
  'CUSTOM'        -- Permissions définies à la carte
);

create type public.tenant_status as enum (
  'TRIAL',        -- Période pilote (3 mois gratuits — cahier §15.3)
  'ACTIVE',       -- Abonnement payant en cours
  'SUSPENDED',    -- Compte suspendu (impayé, manquement…)
  'CANCELLED'     -- Résilié
);

create type public.plan_abonnement as enum (
  'STARTER',      -- 25 000 FCFA/mois — 1-5 camions
  'BUSINESS',     -- 55 000 FCFA/mois — 6-20 camions
  'PREMIUM'       -- 120 000 FCFA/mois — 20+ camions
);

-- =============================================================================
-- 2. Table tenants
-- =============================================================================

create table public.tenants (
  id              uuid primary key default gen_random_uuid(),
  nom_entreprise  text not null,
  rccm            text,
  email_manager   text not null,
  telephone       text,
  adresse         text,
  plan            public.plan_abonnement not null default 'STARTER',
  statut          public.tenant_status   not null default 'TRIAL',
  date_creation   timestamptz not null default now(),
  date_fin_essai  timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_tenants_email_manager on public.tenants (email_manager);
create index idx_tenants_statut         on public.tenants (statut);

comment on table public.tenants is
  'Chaque sous-traitant de transport portuaire (cahier §2.1)';

-- =============================================================================
-- 3. Table users (métier, FK 1:1 vers auth.users)
-- =============================================================================
-- tenant_id est nullable :
--   * NULL  → SUPER_ADMIN (accès trans-tenant)
--   * sinon → user lié à un tenant unique
-- =============================================================================

create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  tenant_id     uuid references public.tenants(id) on delete cascade,
  email         text not null,
  nom           text,
  prenoms       text,
  telephone     text,
  role          public.user_role not null default 'CUSTOM',
  permissions   jsonb not null default '{}'::jsonb,
  actif         boolean not null default true,
  derniere_connexion timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_users_tenant_id on public.users (tenant_id);
create index idx_users_email     on public.users (email);
create index idx_users_role      on public.users (role);

comment on table public.users is
  'Utilisateurs métier — voir cahier §3 (permissions granulaires)';
comment on column public.users.tenant_id is
  'NULL uniquement pour SUPER_ADMIN ; sinon FK vers tenants.id';

-- =============================================================================
-- 4. Trigger updated_at (réutilisé partout)
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 5. Trigger handle_new_user : sync auth.users → public.users
-- =============================================================================
-- À chaque INSERT sur auth.users (signup ou admin.createUser), on crée la
-- ligne correspondante dans public.users.
--
-- tenant_id et role sont lus depuis raw_app_meta_data (NON éditable par
-- l'utilisateur, seulement par service_role). On NE lit JAMAIS depuis
-- raw_user_meta_data pour ces champs critiques — un user malveillant
-- pourrait sinon s'auto-attribuer un tenant_id arbitraire.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_role      public.user_role;
begin
  v_tenant_id := nullif(new.raw_app_meta_data ->> 'tenant_id', '')::uuid;
  v_role := coalesce(
    (new.raw_app_meta_data ->> 'role')::public.user_role,
    'CUSTOM'
  );

  insert into public.users (id, tenant_id, email, role)
  values (new.id, v_tenant_id, new.email, v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Crée public.users à l''inscription. Lit tenant_id/role depuis raw_app_meta_data (sécurisé).';

-- =============================================================================
-- 6. Custom Access Token Hook : injection des claims dans le JWT
-- =============================================================================
-- Appelée par Supabase Auth à chaque émission de token. Ajoute :
--   * tenant_id  → UUID du tenant (chaîne vide si SUPER_ADMIN)
--   * user_role  → rôle métier
--
-- Cela évite une requête `select tenant_id from users where id = auth.uid()`
-- à chaque appel RLS — les claims sont déjà dans le JWT.
--
-- ⚠️ À activer dans le dashboard :
--    Authentication → Hooks → Custom Access Token → public.custom_access_token_hook
-- =============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_user_id     uuid;
  v_tenant_id   uuid;
  v_role        public.user_role;
  v_claims      jsonb;
begin
  v_user_id := (event ->> 'user_id')::uuid;

  select tenant_id, role
    into v_tenant_id, v_role
  from public.users
  where id = v_user_id;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_claims := jsonb_set(
    v_claims,
    '{tenant_id}',
    to_jsonb(coalesce(v_tenant_id::text, ''))
  );
  v_claims := jsonb_set(
    v_claims,
    '{user_role}',
    to_jsonb(coalesce(v_role::text, 'CUSTOM'))
  );

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- Permissions : seul supabase_auth_admin doit pouvoir exécuter le hook
grant usage on schema public to supabase_auth_admin;
grant select on public.users to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb)
  from authenticated, anon, public;

comment on function public.custom_access_token_hook(jsonb) is
  'Injecte tenant_id et user_role dans le JWT. À activer dans Auth Hooks.';

-- =============================================================================
-- 7. Helpers JWT — utilisés par toutes les RLS policies suivantes
-- =============================================================================

create or replace function public.jwt_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      auth.jwt() ->> 'tenant_id',
      auth.jwt() -> 'app_metadata' ->> 'tenant_id'
    ),
    ''
  )::uuid
$$;

create or replace function public.jwt_user_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() ->> 'user_role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    'CUSTOM'
  )
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select public.jwt_user_role() = 'SUPER_ADMIN'
$$;

create or replace function public.is_manager_of(p_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select public.jwt_user_role() = 'MANAGER'
    and public.jwt_tenant_id() = p_tenant_id
$$;

comment on function public.jwt_tenant_id() is
  'Extrait le tenant_id du JWT (claim custom injecté par le auth hook)';

-- =============================================================================
-- 8. RLS — tenants
-- =============================================================================

alter table public.tenants enable row level security;

create policy "tenants_select_self_or_super"
  on public.tenants for select
  to authenticated
  using (
    public.is_super_admin()
    or id = public.jwt_tenant_id()
  );

create policy "tenants_insert_super_only"
  on public.tenants for insert
  to authenticated
  with check (public.is_super_admin());

create policy "tenants_update_manager_or_super"
  on public.tenants for update
  to authenticated
  using (
    public.is_super_admin()
    or public.is_manager_of(id)
  )
  with check (
    public.is_super_admin()
    or public.is_manager_of(id)
  );

create policy "tenants_delete_super_only"
  on public.tenants for delete
  to authenticated
  using (public.is_super_admin());

-- =============================================================================
-- 9. RLS — users
-- =============================================================================

alter table public.users enable row level security;

create policy "users_select_same_tenant_or_super"
  on public.users for select
  to authenticated
  using (
    public.is_super_admin()
    or id = auth.uid()                          -- toujours sa propre fiche
    or tenant_id = public.jwt_tenant_id()       -- collègues du même tenant
  );

create policy "users_insert_manager_or_super"
  on public.users for insert
  to authenticated
  with check (
    public.is_super_admin()
    or (
      public.jwt_user_role() = 'MANAGER'
      and tenant_id = public.jwt_tenant_id()
    )
  );

create policy "users_update_manager_or_self"
  on public.users for update
  to authenticated
  using (
    public.is_super_admin()
    or id = auth.uid()
    or (
      public.jwt_user_role() = 'MANAGER'
      and tenant_id = public.jwt_tenant_id()
    )
  )
  with check (
    public.is_super_admin()
    or id = auth.uid()
    or (
      public.jwt_user_role() = 'MANAGER'
      and tenant_id = public.jwt_tenant_id()
    )
  );

create policy "users_delete_manager_or_super"
  on public.users for delete
  to authenticated
  using (
    public.is_super_admin()
    or (
      public.jwt_user_role() = 'MANAGER'
      and tenant_id = public.jwt_tenant_id()
      and id <> auth.uid()                      -- pas se supprimer soi-même
    )
  );
