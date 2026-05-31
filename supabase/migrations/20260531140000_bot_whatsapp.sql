-- =============================================================================
-- PORTTRACK — Migration #22 : Bot WhatsApp de consultation de documents (§7.5)
-- =============================================================================
-- Un bot WhatsApp permet d'obtenir instantanément la photo d'un document
-- matériel en envoyant une commande simple (ex. « CG AA-1234-CI »).
--
-- Sécurité (§7.5) :
--   * Seuls les numéros enregistrés peuvent interroger le bot
--   * Chaque numéro est lié à UN tenant → isolation stricte des documents
--   * Numéro inconnu / non autorisé : aucune réponse
--   * Chaque consultation est journalisée (date, heure, numéro, document)
-- =============================================================================

-- 1. Liste blanche des numéros autorisés (un numéro = un tenant)
create table public.bot_whatsapp_numeros (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  -- Numéro normalisé E.164 (ex. +2250700000000)
  numero       text not null check (numero ~ '^\+?\d{8,15}$'),
  label        text,            -- ex. « Dispatcher Kouassi », « Chauffeur Adou »
  actif        boolean not null default true,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Un numéro ne peut appartenir qu'à un seul tenant (isolation)
  constraint bot_whatsapp_numeros_unique unique (numero)
);

create index bot_whatsapp_numeros_tenant_idx on public.bot_whatsapp_numeros (tenant_id, actif);

comment on table public.bot_whatsapp_numeros is
  'Numéros WhatsApp autorisés à interroger le bot de consultation documents (cahier §7.5). Un numéro = un tenant.';

create trigger bot_whatsapp_numeros_set_updated_at
  before update on public.bot_whatsapp_numeros
  for each row execute function public.set_updated_at();

-- 2. Journal des consultations (toutes, autorisées ou non)
create type public.bot_consultation_statut as enum (
  'REPONDU',              -- document trouvé et envoyé
  'NON_AUTORISE',         -- numéro inconnu / inactif
  'COMMANDE_INVALIDE',    -- texte non reconnu
  'MATERIEL_INTROUVABLE', -- immatriculation inconnue dans le tenant
  'DOC_INTROUVABLE'       -- matériel ok mais document absent
);

create table public.bot_consultations (
  id              uuid primary key default gen_random_uuid(),
  -- tenant_id nullable : un numéro inconnu n'est rattaché à aucun tenant
  tenant_id       uuid references public.tenants(id) on delete set null,
  numero_demandeur text not null,
  commande_brute  text not null,             -- texte reçu tel quel
  code            text,                       -- ex. CG / DOCS
  immatriculation text,
  document_type   text,
  materiel_id     uuid references public.materiel_roulant(id) on delete set null,
  statut          public.bot_consultation_statut not null,
  details         text,                       -- message libre (nb docs envoyés, raison d'échec)
  created_at      timestamptz not null default now()
);

create index bot_consultations_tenant_date_idx on public.bot_consultations (tenant_id, created_at desc);
create index bot_consultations_numero_idx      on public.bot_consultations (numero_demandeur, created_at desc);

comment on table public.bot_consultations is
  'Journal immuable des consultations du bot WhatsApp (cahier §7.5). Alimenté côté serveur (service_role) par le webhook.';

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.bot_whatsapp_numeros enable row level security;
alter table public.bot_consultations    enable row level security;

-- Allowlist : lecture tenant, écriture MANAGER + SUPER_ADMIN
create policy "bot_numeros_select_same_tenant_or_super"
  on public.bot_whatsapp_numeros for select to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "bot_numeros_insert_manager_or_super"
  on public.bot_whatsapp_numeros for insert to authenticated
  with check (public.is_super_admin() or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id()));
create policy "bot_numeros_update_manager_or_super"
  on public.bot_whatsapp_numeros for update to authenticated
  using (public.is_super_admin() or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id()))
  with check (public.is_super_admin() or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id()));
create policy "bot_numeros_delete_manager_or_super"
  on public.bot_whatsapp_numeros for delete to authenticated
  using (public.is_super_admin() or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id()));

-- Journal : lecture seule pour le tenant (les rangs sans tenant = SUPER_ADMIN
-- uniquement). L'insertion se fait via service_role (webhook) qui bypasse RLS.
create policy "bot_consultations_select_same_tenant_or_super"
  on public.bot_consultations for select to authenticated
  using (public.is_super_admin() or (tenant_id is not null and tenant_id = public.jwt_tenant_id()));

grant select, insert, update, delete on public.bot_whatsapp_numeros to authenticated;
grant select on public.bot_consultations to authenticated;
