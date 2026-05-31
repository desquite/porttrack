-- =============================================================================
-- PORTTRACK — Migration #21 : Archivage des EIR (cahier v7 §10)
-- =============================================================================
-- L'EIR (Equipment Interchange Receipt) est le document remis au chauffeur à
-- la prise en charge / restitution d'un conteneur. Il fait foi en cas de
-- litige. PORTTRACK en constitue une archive numérique.
--
-- Processus (§9.2) : à la confirmation de livraison, l'upload de l'EIR est
-- EXIGÉ avant de clôturer. On enregistre : fichier, date/heure, utilisateur,
-- camion, chauffeur. Le conteneur passe alors en statut LIVRE.
--
-- Conservation (§9.4) :
--   * durée minimale 5 ans (obligation légale transport)
--   * un EIR ne peut JAMAIS être supprimé par un utilisateur, même MANAGER
--   * seul le SUPER_ADMIN peut supprimer (raison légale documentée)
-- =============================================================================

create table public.eir_archives (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete restrict,

  conteneur_id       uuid not null references public.conteneurs(id) on delete restrict,
  -- Affectation qui a réalisé la livraison (peut être absente si livraison
  -- saisie sans affectation préalable).
  affectation_id     uuid references public.affectations(id) on delete set null,

  -- Snapshots au moment de la livraison (restent lisibles même si le chauffeur
  -- ou le matériel est supprimé plus tard).
  chauffeur_id       uuid references public.chauffeurs(id) on delete set null,
  chauffeur_nom      text,
  tracteur_id        uuid references public.materiel_roulant(id) on delete set null,
  tracteur_immat     text,

  -- Le fichier EIR (photo smartphone acceptée)
  fichier_url        text not null,
  fichier_nom        text,

  date_livraison     date not null default current_date,

  uploaded_by        uuid references public.users(id) on delete set null,
  uploaded_by_email  text,
  created_at         timestamptz not null default now()
);

create index eir_archives_tenant_date_idx   on public.eir_archives (tenant_id, date_livraison desc);
create index eir_archives_conteneur_idx      on public.eir_archives (conteneur_id);
create index eir_archives_chauffeur_idx      on public.eir_archives (chauffeur_id) where chauffeur_id is not null;

comment on table public.eir_archives is
  'Archive numérique des EIR (cahier v7 §10). Conservation 5 ans, suppression réservée au SUPER_ADMIN.';

-- =============================================================================
-- RLS — lecture + insertion par le tenant ; suppression réservée SUPER_ADMIN.
-- Pas de policy UPDATE (un EIR archivé ne se modifie pas).
-- =============================================================================

alter table public.eir_archives enable row level security;

create policy "eir_archives_select_same_tenant_or_super"
  on public.eir_archives for select to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "eir_archives_insert_same_tenant"
  on public.eir_archives for insert to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

-- Suppression : SUPER_ADMIN uniquement (cahier §9.4)
create policy "eir_archives_delete_super_admin_only"
  on public.eir_archives for delete to authenticated
  using (public.is_super_admin());

grant select, insert, delete on public.eir_archives to authenticated;
