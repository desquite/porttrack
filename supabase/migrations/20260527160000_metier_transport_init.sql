-- =============================================================================
-- PORTTRACK — Migration #3 : tables métier transport (chauffeurs + matériel)
-- =============================================================================
-- Cœur opérationnel du SaaS. Trois tables tenant-scoped :
--
--   * chauffeurs        : conducteurs employés par un transporteur
--   * materiel_roulant  : tracteurs + remorques + porte-conteneurs
--   * documents         : table polymorphique pour scans PDF (Supabase Storage)
--
-- Choix d'architecture clés :
--
--   1. Dénormalisation volontaire des dates d'expiration critiques
--      (permis, visite médicale, assurance, VT, vignette, patente, DGTTC)
--      dans les tables principales. Permet des requêtes d'alertes en O(1)
--      sans JOIN sur documents. Trade-off : maintenir la synchro avec la
--      table documents (futur trigger).
--
--   2. Documents polymorphique (owner_type + owner_id) plutôt que 2 tables
--      séparées documents_chauffeur/documents_materiel. Plus extensible
--      (on pourra ajouter owner_type='TENANT' pour les docs entreprise).
--
--   3. RLS strictement tenant-scoped via les helpers jwt_tenant_id() et
--      is_super_admin() définis dans la migration multi_tenant_init.
-- =============================================================================

-- =============================================================================
-- 1. Types énumérés
-- =============================================================================

create type public.chauffeur_statut as enum (
  'ACTIF',       -- En poste, disponible
  'EN_CONGE',    -- Congé annuel, maladie
  'SUSPENDU',    -- Mesure disciplinaire / docs expirés
  'INACTIF'      -- A quitté l'entreprise
);

create type public.sexe as enum ('M', 'F');

create type public.materiel_type as enum (
  'TRACTEUR',              -- Tracteur routier (cab)
  'REMORQUE',              -- Remorque standard
  'SEMI_REMORQUE',         -- Semi-remorque plateau / fourgon
  'PORTE_CONTENEUR_20',    -- Châssis dédié conteneur 20'
  'PORTE_CONTENEUR_40',    -- Châssis dédié conteneur 40'
  'PORTE_CONTENEUR_MIXTE'  -- Châssis adaptable 20'/40'
);

create type public.materiel_etat as enum (
  'EN_SERVICE',     -- Opérationnel
  'EN_PANNE',       -- Immobilisé en attente de réparation
  'EN_REPARATION',  -- Au garage
  'HORS_SERVICE',   -- Définitivement immobilisé
  'VENDU'           -- Cédé / réformé
);

create type public.document_owner_type as enum (
  'CHAUFFEUR',
  'MATERIEL'
);

create type public.document_type as enum (
  -- Documents chauffeur
  'CNI',
  'PERMIS_CONDUIRE',
  'VISITE_MEDICALE',
  'ATTESTATION_CNPS',
  'CONTRAT_TRAVAIL',
  'PHOTO_IDENTITE',
  -- Documents matériel
  'CARTE_GRISE',
  'ASSURANCE',
  'VISITE_TECHNIQUE',
  'VIGNETTE',
  'PATENTE_TRANSPORT',
  'AUTORISATION_DGTTC',
  -- Divers
  'AUTRE'
);

-- =============================================================================
-- 2. Table chauffeurs
-- =============================================================================

create table public.chauffeurs (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete restrict,

  -- Identité
  prenoms                     text not null,
  nom                         text not null,
  date_naissance              date,
  sexe                        public.sexe,
  numero_cni                  text,            -- Carte Nationale d'Identité CI
  photo_url                   text,

  -- Contact
  telephone                   text not null,   -- Indispensable pour WhatsApp OTP futur
  telephone_secondaire        text,
  email                       text,
  adresse                     text,

  -- Permis de conduire
  numero_permis               text,
  categories_permis           text[],          -- ["C", "CE"] — un chauffeur peut cumuler
  permis_obtention            date,
  permis_expiration           date,            -- Critique : alimente les alertes

  -- Visite médicale obligatoire (annuelle pour PL en CI)
  visite_medicale_expiration  date,            -- Critique : alimente les alertes

  -- Sécurité sociale
  numero_cnps                 text,            -- Caisse Nationale Prévoyance Sociale

  -- Emploi
  date_embauche               date,
  statut                      public.chauffeur_statut not null default 'ACTIF',

  -- Métadonnées
  notes                       text,
  created_by                  uuid references public.users(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  -- Unicité tenant-scoped
  constraint chauffeurs_cni_unique_per_tenant
    unique nulls not distinct (tenant_id, numero_cni),
  constraint chauffeurs_permis_unique_per_tenant
    unique nulls not distinct (tenant_id, numero_permis)
);

-- Index pour RLS (toutes les policies filtrent sur tenant_id)
create index chauffeurs_tenant_id_idx on public.chauffeurs (tenant_id);

-- Index pour les requêtes d'alertes (dashboard "documents expirent bientôt")
create index chauffeurs_permis_expiration_idx
  on public.chauffeurs (tenant_id, permis_expiration)
  where statut = 'ACTIF';

create index chauffeurs_visite_medicale_expiration_idx
  on public.chauffeurs (tenant_id, visite_medicale_expiration)
  where statut = 'ACTIF';

-- Index pour le filtrage de liste par statut
create index chauffeurs_tenant_statut_idx
  on public.chauffeurs (tenant_id, statut);

comment on table public.chauffeurs is
  'Conducteurs employés par un tenant. Permis & visite médicale dénormalisés pour les alertes.';

-- =============================================================================
-- 3. Table materiel_roulant
-- =============================================================================

create table public.materiel_roulant (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete restrict,

  -- Identification
  type                     public.materiel_type not null,
  immatriculation          text not null,
  marque                   text,
  modele                   text,
  annee                    smallint check (annee is null or (annee between 1990 and extract(year from now())::int + 1)),

  -- Caractéristiques techniques
  capacite_tonnes          numeric(6, 2),
  kilometrage_actuel       numeric(10, 0),

  -- Dates clés (dénormalisées depuis documents pour les alertes)
  assurance_fin            date,
  visite_technique_fin     date,
  vignette_fin             date,
  patente_fin              date,
  autorisation_dgttc_fin   date,

  -- État opérationnel
  etat                     public.materiel_etat not null default 'EN_SERVICE',

  -- Acquisition
  date_acquisition         date,
  prix_acquisition_fcfa    numeric(12, 0),

  -- Métadonnées
  notes                    text,
  created_by               uuid references public.users(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  -- Unicité de l'immatriculation par tenant
  constraint materiel_immatriculation_unique_per_tenant
    unique (tenant_id, immatriculation)
);

-- Index pour RLS
create index materiel_tenant_id_idx on public.materiel_roulant (tenant_id);

-- Index pour les alertes (4 dates × index partiel sur EN_SERVICE)
create index materiel_assurance_fin_idx
  on public.materiel_roulant (tenant_id, assurance_fin)
  where etat = 'EN_SERVICE';

create index materiel_visite_technique_fin_idx
  on public.materiel_roulant (tenant_id, visite_technique_fin)
  where etat = 'EN_SERVICE';

create index materiel_vignette_fin_idx
  on public.materiel_roulant (tenant_id, vignette_fin)
  where etat = 'EN_SERVICE';

create index materiel_patente_fin_idx
  on public.materiel_roulant (tenant_id, patente_fin)
  where etat = 'EN_SERVICE';

-- Index pour le filtrage liste
create index materiel_tenant_type_etat_idx
  on public.materiel_roulant (tenant_id, type, etat);

comment on table public.materiel_roulant is
  'Tracteurs, remorques et porte-conteneurs. Dates docs dénormalisées pour alertes.';

-- =============================================================================
-- 4. Table documents (polymorphique : chauffeur OU matériel)
-- =============================================================================

create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete restrict,

  -- FK polymorphique
  owner_type      public.document_owner_type not null,
  owner_id        uuid not null,   -- chauffeurs.id OU materiel_roulant.id

  -- Métadonnées document
  type_document   public.document_type not null,
  numero          text,
  date_emission   date,
  date_expiration date,            -- null pour les docs qui n'expirent pas

  -- Fichier scanné (URL Supabase Storage)
  fichier_url     text,
  fichier_nom     text,            -- Pour l'affichage UI : "Permis_Adou.pdf"
  fichier_taille  bigint,          -- Octets — pour le quota futur

  -- Métadonnées d'upload
  notes           text,
  uploaded_by     uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index pour le lookup polymorphique (cas le plus fréquent : "docs de ce chauffeur")
create index documents_owner_idx
  on public.documents (tenant_id, owner_type, owner_id);

-- Index pour les alertes globales d'expiration (toutes catégories confondues)
create index documents_expiration_idx
  on public.documents (tenant_id, date_expiration)
  where date_expiration is not null;

-- Index pour filtrer par type de document
create index documents_type_idx
  on public.documents (tenant_id, type_document);

comment on table public.documents is
  'Scans PDF des documents légaux. FK polymorphique vers chauffeurs ou materiel_roulant.';

-- =============================================================================
-- 5. Triggers updated_at
-- =============================================================================

create trigger chauffeurs_set_updated_at
  before update on public.chauffeurs
  for each row execute function public.set_updated_at();

create trigger materiel_roulant_set_updated_at
  before update on public.materiel_roulant
  for each row execute function public.set_updated_at();

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 6. RLS — isolement strict par tenant
-- =============================================================================

alter table public.chauffeurs       enable row level security;
alter table public.materiel_roulant enable row level security;
alter table public.documents        enable row level security;

-- -----------------------------------------------------------------------------
-- 6.1 chauffeurs
-- -----------------------------------------------------------------------------

create policy "chauffeurs_select_same_tenant_or_super"
  on public.chauffeurs for select
  to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

create policy "chauffeurs_insert_same_tenant"
  on public.chauffeurs for insert
  to authenticated
  with check (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

create policy "chauffeurs_update_same_tenant"
  on public.chauffeurs for update
  to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  )
  with check (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

-- DELETE plus restrictif : MANAGER du tenant uniquement (irréversible)
create policy "chauffeurs_delete_manager_or_super"
  on public.chauffeurs for delete
  to authenticated
  using (
    public.is_super_admin()
    or (
      public.jwt_user_role() = 'MANAGER'
      and tenant_id = public.jwt_tenant_id()
    )
  );

-- -----------------------------------------------------------------------------
-- 6.2 materiel_roulant
-- -----------------------------------------------------------------------------

create policy "materiel_select_same_tenant_or_super"
  on public.materiel_roulant for select
  to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

create policy "materiel_insert_same_tenant"
  on public.materiel_roulant for insert
  to authenticated
  with check (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

create policy "materiel_update_same_tenant"
  on public.materiel_roulant for update
  to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  )
  with check (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

create policy "materiel_delete_manager_or_super"
  on public.materiel_roulant for delete
  to authenticated
  using (
    public.is_super_admin()
    or (
      public.jwt_user_role() = 'MANAGER'
      and tenant_id = public.jwt_tenant_id()
    )
  );

-- -----------------------------------------------------------------------------
-- 6.3 documents
-- -----------------------------------------------------------------------------

create policy "documents_select_same_tenant_or_super"
  on public.documents for select
  to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

create policy "documents_insert_same_tenant"
  on public.documents for insert
  to authenticated
  with check (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

create policy "documents_update_same_tenant"
  on public.documents for update
  to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  )
  with check (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

create policy "documents_delete_manager_or_super"
  on public.documents for delete
  to authenticated
  using (
    public.is_super_admin()
    or (
      public.jwt_user_role() = 'MANAGER'
      and tenant_id = public.jwt_tenant_id()
    )
  );

-- =============================================================================
-- 7. Grants
-- =============================================================================

grant select, insert, update, delete on public.chauffeurs       to authenticated;
grant select, insert, update, delete on public.materiel_roulant to authenticated;
grant select, insert, update, delete on public.documents        to authenticated;
