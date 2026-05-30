-- =============================================================================
-- PORTTRACK — Migration #18 : Check-list de départ chauffeur (cahier v7 §7.3)
-- =============================================================================
-- Après réception du message de désignation, le chauffeur effectue sa
-- check-list avant le départ. 6 items figés :
--   1. Niveau d'huile
--   2. État visuel des pneus
--   3. Feux avant et arrière
--   4. Freins
--   5. Rétroviseurs
--   6. Documents à bord (permis, carte grise…)
--
-- Chaque item est noté OK ou ANOMALIE. Une remarque libre et des photos
-- optionnelles peuvent être ajoutées.
--
-- Règles métier :
--   * 1 check-list au plus par désignation (UNIQUE designation_id).
--   * Statut global dérivé : FAITE si tous items OK et pas de remarque,
--     sinon REMARQUE.
--   * Pas de rappel WhatsApp auto si check-list non faite (§7.3).
--   * En version V3c, la check-list est saisie côté web par les Ressources
--     d'Exploitation (le chauffeur la fera lui-même en Phase 5 / mobile).
-- =============================================================================

-- 1. Enum statut d'un item
create type public.checklist_item_etat as enum (
  'OK',
  'ANOMALIE'
);

-- 2. Table checklists_depart
create table public.checklists_depart (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete restrict,

  -- Une check-list est associée à une désignation (chauffeur + MR + date).
  -- La cascade : si on supprime la désignation, la check-list disparaît.
  designation_id        uuid not null references public.designations(id) on delete cascade,

  -- Dénormalisés pour requêtes/historique rapides (chauffeur + MR + date)
  chauffeur_id          uuid not null references public.chauffeurs(id) on delete restrict,
  materiel_roulant_id   uuid not null references public.materiel_roulant(id) on delete restrict,
  date_depart           date not null default current_date,

  -- 6 items de check-list (cahier §7.3)
  item_huile            public.checklist_item_etat not null default 'OK',
  item_pneus            public.checklist_item_etat not null default 'OK',
  item_feux             public.checklist_item_etat not null default 'OK',
  item_freins           public.checklist_item_etat not null default 'OK',
  item_retros           public.checklist_item_etat not null default 'OK',
  item_documents        public.checklist_item_etat not null default 'OK',

  remarque              text,

  -- Horodatage automatique de la validation (cahier §7.3)
  heure_validation      timestamptz not null default now(),

  -- Statut global dérivé : FAITE / REMARQUE
  -- (la 3e valeur NON_FAITE n'existe pas en DB — elle est calculée côté UI
  --  par absence de ligne pour une désignation du jour)
  statut_global         text generated always as (
    case
      when item_huile     = 'ANOMALIE'
        or item_pneus     = 'ANOMALIE'
        or item_feux      = 'ANOMALIE'
        or item_freins    = 'ANOMALIE'
        or item_retros    = 'ANOMALIE'
        or item_documents = 'ANOMALIE'
        or (remarque is not null and length(trim(remarque)) > 0)
      then 'REMARQUE'
      else 'FAITE'
    end
  ) stored,

  created_by            uuid references public.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- 1 seule check-list par désignation
  constraint checklists_depart_designation_unique unique (designation_id)
);

create index checklists_depart_tenant_date_idx     on public.checklists_depart (tenant_id, date_depart desc);
create index checklists_depart_chauffeur_idx       on public.checklists_depart (chauffeur_id, date_depart desc);
create index checklists_depart_materiel_idx        on public.checklists_depart (materiel_roulant_id, date_depart desc);
create index checklists_depart_tenant_statut_idx   on public.checklists_depart (tenant_id, statut_global);

comment on table public.checklists_depart is
  'Check-list de départ avant prise de service (cahier v7 §7.3) — 6 items figés + remarque + photos.';
comment on column public.checklists_depart.statut_global is
  'FAITE ou REMARQUE (dérivé). NON_FAITE = absence de ligne pour la désignation du jour.';

-- 3. Trigger updated_at
create trigger checklists_depart_set_updated_at
  before update on public.checklists_depart
  for each row execute function public.set_updated_at();

-- 4. Table checklist_photos (photos optionnelles d'anomalie)
create table public.checklist_photos (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete restrict,
  checklist_id          uuid not null references public.checklists_depart(id) on delete cascade,
  photo_url             text not null,
  photo_nom             text,
  uploaded_by           uuid references public.users(id) on delete set null,
  created_at            timestamptz not null default now()
);

create index checklist_photos_checklist_idx on public.checklist_photos (checklist_id);
create index checklist_photos_tenant_idx    on public.checklist_photos (tenant_id);

-- =============================================================================
-- 5. RLS — isolement tenant (pattern habituel)
-- =============================================================================

alter table public.checklists_depart enable row level security;
alter table public.checklist_photos  enable row level security;

-- checklists_depart
create policy "checklists_depart_select_same_tenant_or_super"
  on public.checklists_depart for select to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "checklists_depart_insert_same_tenant"
  on public.checklists_depart for insert to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "checklists_depart_update_same_tenant"
  on public.checklists_depart for update to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id())
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "checklists_depart_delete_same_tenant"
  on public.checklists_depart for delete to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

-- checklist_photos
create policy "checklist_photos_select_same_tenant_or_super"
  on public.checklist_photos for select to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "checklist_photos_insert_same_tenant"
  on public.checklist_photos for insert to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "checklist_photos_delete_same_tenant"
  on public.checklist_photos for delete to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

grant select, insert, update, delete on public.checklists_depart to authenticated;
grant select, insert, delete         on public.checklist_photos  to authenticated;
