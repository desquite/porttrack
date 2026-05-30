-- =============================================================================
-- PORTTRACK — Migration #16 : Désignations matinales (cahier v7 §7.3)
-- =============================================================================
-- Chaque matin, les Ressources d'Exploitation désignent les chauffeurs
-- disponibles sur leur matériel roulant pour la journée. Un WhatsApp
-- automatique est envoyé au chauffeur avec son affectation du jour.
--
-- Règles métier :
--   * 1 chauffeur ne peut être désigné que sur 1 seul matériel par jour
--   * 1 matériel ne peut être désigné qu'à 1 seul chauffeur par jour
--   * Le statut WhatsApp est tracé (envoyé / échec / non envoyé / skipped)
-- =============================================================================

-- 1. Enum statut d'envoi WhatsApp
create type public.designation_whatsapp_statut as enum (
  'PENDING',   -- Désignation créée, WhatsApp pas encore envoyé
  'SENT',      -- Envoyé avec succès
  'FAILED',    -- L'envoi a échoué (cf. whatsapp_error)
  'SKIPPED'    -- Volontairement non envoyé (provider non configuré)
);

-- 2. Table designations
create table public.designations (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete restrict,
  chauffeur_id          uuid not null references public.chauffeurs(id) on delete restrict,
  materiel_roulant_id   uuid not null references public.materiel_roulant(id) on delete restrict,
  date_designation      date not null default current_date,

  -- Snapshot de l'équipe au moment de la désignation (pour le message)
  equipe_id             uuid references public.equipes(id) on delete set null,

  notes                 text,

  -- Suivi de l'envoi WhatsApp
  whatsapp_statut       public.designation_whatsapp_statut not null default 'PENDING',
  whatsapp_sent_at      timestamptz,
  whatsapp_error        text,
  whatsapp_attempts     smallint not null default 0,

  created_by            uuid references public.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- 1 chauffeur = 1 désignation par jour, 1 MR = 1 désignation par jour
  constraint designations_chauffeur_unique_par_jour unique (tenant_id, chauffeur_id, date_designation),
  constraint designations_materiel_unique_par_jour unique (tenant_id, materiel_roulant_id, date_designation)
);

create index designations_tenant_date_idx        on public.designations (tenant_id, date_designation desc);
create index designations_chauffeur_idx          on public.designations (chauffeur_id, date_designation desc);
create index designations_materiel_idx           on public.designations (materiel_roulant_id, date_designation desc);
create index designations_tenant_whatsapp_idx    on public.designations (tenant_id, whatsapp_statut);

comment on table public.designations is
  'Désignation matinale chauffeur ↔ matériel pour une journée. Déclenche un WhatsApp auto au chauffeur.';

-- 3. Trigger updated_at
create trigger designations_set_updated_at
  before update on public.designations
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 4. RLS — isolement tenant (pattern habituel)
-- =============================================================================

alter table public.designations enable row level security;

create policy "designations_select_same_tenant_or_super"
  on public.designations for select to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "designations_insert_same_tenant"
  on public.designations for insert to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "designations_update_same_tenant"
  on public.designations for update to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id())
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "designations_delete_same_tenant"
  on public.designations for delete to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

grant select, insert, update, delete on public.designations to authenticated;
