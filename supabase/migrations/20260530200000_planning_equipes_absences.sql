-- =============================================================================
-- PORTTRACK — Migration #15 : Équipes & Absences (cahier v7 §7.2 / §7.4)
-- =============================================================================
-- Première brique du module Planning chauffeurs :
--   * Le manager configure ses équipes (Jour, Nuit, Repos…) avec horaires et
--     jours travaillés.
--   * Chaque chauffeur est rattaché à une équipe par défaut.
--   * Les absences (congés, maladie, absences imprévues…) viennent en
--     surcouche du planning par défaut.
--
-- La grille planning hebdomadaire (§7.2) est calculée en lecture à partir de
-- ces trois sources : équipe par défaut du chauffeur + jours travaillés de
-- l'équipe + absences sur la période.
-- =============================================================================

-- 1. Enum type d'absence
create type public.absence_type as enum (
  'CONGE_PLANIFIE',     -- Congé prévu
  'ABSENCE_IMPREVUE',   -- Absence déclarée le matin
  'MALADIE',
  'FORMATION',
  'AUTRE'
);

-- 2. Table équipes
-- jours_travailles : smallint[] avec valeurs 0..6 (0 = dimanche, 1 = lundi…
-- 6 = samedi — conforme à Date.prototype.getDay() côté JS).
create table public.equipes (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete restrict,
  nom              text not null,
  code             text not null,                              -- 1-3 caractères affichés dans la grille (ex. "J", "N", "R")
  heure_debut      time,                                       -- nullable pour Repos
  heure_fin        time,
  jours_travailles smallint[] not null default '{1,2,3,4,5}',  -- défaut Lun-Ven
  couleur          text not null default '#3b82f6',            -- couleur hex (cellule)
  ordre            smallint not null default 0,                -- ordre d'affichage dans la liste
  actif            boolean not null default true,
  notes            text,
  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint equipes_jours_valid check (
    jours_travailles <@ '{0,1,2,3,4,5,6}'::smallint[]
  ),
  constraint equipes_code_short check (char_length(code) between 1 and 3)
);

-- Code unique par tenant pour les équipes actives (évite 2 équipes "J" en même temps)
create unique index equipes_tenant_code_unique
  on public.equipes (tenant_id, upper(code))
  where actif = true;

create index equipes_tenant_idx on public.equipes (tenant_id);
create index equipes_tenant_ordre_idx on public.equipes (tenant_id, ordre);

comment on table public.equipes is
  'Équipes de rotation chauffeurs (Jour, Nuit, Repos…) configurables par tenant.';
comment on column public.equipes.jours_travailles is
  'Jours travaillés (0=dimanche..6=samedi, conforme Date.getDay() JS).';

create trigger equipes_set_updated_at
  before update on public.equipes
  for each row execute function public.set_updated_at();

-- 3. Lier les chauffeurs à une équipe par défaut
alter table public.chauffeurs
  add column equipe_id_defaut uuid references public.equipes(id) on delete set null;

create index chauffeurs_equipe_idx
  on public.chauffeurs (equipe_id_defaut)
  where equipe_id_defaut is not null;

comment on column public.chauffeurs.equipe_id_defaut is
  'Équipe par défaut du chauffeur (sert au calcul de la grille planning).';

-- 4. Table absences
create table public.absences (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete restrict,
  chauffeur_id     uuid not null references public.chauffeurs(id) on delete restrict,

  type             public.absence_type not null,
  date_debut       date not null,
  date_fin         date not null,
  motif            text,

  -- Pièce justificative optionnelle (arrêt maladie, attestation…)
  justificatif_url text,
  justificatif_nom text,

  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint absences_dates_ordre check (date_fin >= date_debut)
);

create index absences_tenant_idx       on public.absences (tenant_id);
create index absences_chauffeur_idx    on public.absences (chauffeur_id);
create index absences_tenant_periode_idx on public.absences (tenant_id, date_debut, date_fin);

comment on table public.absences is
  'Absences chauffeurs (congé planifié, absence imprévue, maladie…). Override du planning par défaut sur la période [date_debut, date_fin].';

create trigger absences_set_updated_at
  before update on public.absences
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 5. RLS
-- =============================================================================

alter table public.equipes  enable row level security;
alter table public.absences enable row level security;

-- équipes
create policy "equipes_select_same_tenant_or_super"
  on public.equipes for select to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "equipes_insert_same_tenant"
  on public.equipes for insert to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "equipes_update_same_tenant"
  on public.equipes for update to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id())
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "equipes_delete_manager_or_super"
  on public.equipes for delete to authenticated
  using (
    public.is_super_admin()
    or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id())
  );

-- absences
create policy "absences_select_same_tenant_or_super"
  on public.absences for select to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "absences_insert_same_tenant"
  on public.absences for insert to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "absences_update_same_tenant"
  on public.absences for update to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id())
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "absences_delete_same_tenant"
  on public.absences for delete to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

grant select, insert, update, delete on public.equipes  to authenticated;
grant select, insert, update, delete on public.absences to authenticated;
