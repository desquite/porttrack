-- =============================================================================
-- PORTTRACK — Migration #2 : tables de référence partagées
-- =============================================================================
-- Trois tables consultables par TOUS les tenants (lecture publique pour les
-- utilisateurs authentifiés), modifiables uniquement par SUPER_ADMIN :
--
--   * shipping_lines  : compagnies maritimes (MSC, Maersk, CMA-CGM…)
--   * types_conteneur : types ISO 6346 (20'DV, 40'HC, 20'RF…)
--   * port_codes      : codes UN/LOCODE (origines imports + hinterland West Africa)
--
-- Ces données sont "partagées" car factuelles et stables — pas la peine de
-- les dupliquer par tenant. Une mise à jour par PORTTRACK profite à tous.
-- =============================================================================

-- =============================================================================
-- 1. Table : shipping_lines (compagnies maritimes)
-- =============================================================================
-- Le code SCAC (Standard Carrier Alpha Code) sert d'identifiant métier — il
-- apparaît dans le préfixe des numéros de conteneurs ISO 6346 (ex. MSCU1234567).
-- =============================================================================

create table public.shipping_lines (
  id              uuid primary key default gen_random_uuid(),
  code_scac       text not null unique,         -- "MSCU", "MAEU", "CMDU"…
  nom             text not null,                -- "Mediterranean Shipping Company"
  nom_court       text not null,                -- "MSC" — pour les listes UI
  pays_origine    text,                         -- ISO-2, "CH" pour MSC
  site_web        text,
  actif           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index shipping_lines_actif_idx on public.shipping_lines (actif)
  where actif = true;

comment on table public.shipping_lines is
  'Compagnies maritimes actives au Port d''Abidjan. Réf partagée multi-tenant.';

-- =============================================================================
-- 2. Table : types_conteneur (ISO 6346)
-- =============================================================================
-- Le code_iso suit la norme ISO 6346 (4 caractères : 2 chiffres pour la
-- taille/hauteur + 2 caractères pour le type). On garde aussi un code "trade"
-- plus parlant (20DV, 40HC…) pour l'UI et les imports Excel.
-- =============================================================================

create table public.types_conteneur (
  id              uuid primary key default gen_random_uuid(),
  code_iso        text not null unique,         -- "22G0", "42G1", "45G1"…
  code_trade      text not null unique,         -- "20DV", "40DV", "40HC"…
  taille_pieds    smallint not null check (taille_pieds in (20, 40, 45)),
  famille         text not null check (famille in (
    'DRY',        -- Dry van (conteneur sec standard)
    'REEFER',     -- Frigorifique
    'OPEN_TOP',   -- Toit ouvert
    'FLAT_RACK',  -- Plat à ridelles
    'TANK',       -- Citerne
    'HIGH_CUBE'   -- Hauteur +30cm (9'6'')
  )),
  description_fr  text not null,
  volume_m3       numeric(6, 2),
  charge_max_kg   numeric(8, 0),
  tare_kg         numeric(8, 0),
  actif           boolean not null default true,
  created_at      timestamptz not null default now()
);

comment on table public.types_conteneur is
  'Types ISO 6346 de conteneurs maritimes. Réf partagée multi-tenant.';

-- =============================================================================
-- 3. Table : port_codes (UN/LOCODE)
-- =============================================================================
-- UN/LOCODE : 5 caractères (2 ISO pays + 3 ville). Couvre les origines maritimes
-- (Chine, Europe, USA…) et l'hinterland West Africa (Burkina, Mali, Niger,
-- Sénégal, Ghana) qui constituent ~70% des destinations camion depuis le PAA.
-- =============================================================================

create type public.port_kind as enum (
  'PORT_MARITIME',     -- Port maritime (origines imports)
  'VILLE_HINTERLAND',  -- Ville intérieure (destinations camion)
  'PORT_SEC'           -- Terminal/port sec (dépôts conteneur intérieurs)
);

create table public.port_codes (
  id                       uuid primary key default gen_random_uuid(),
  code_unlocode            text not null unique,  -- "CIABJ", "BFOUA"…
  nom_lieu                 text not null,         -- "Abidjan", "Ouagadougou"
  pays_iso                 text not null,         -- "CI", "BF", "ML"…
  nom_pays                 text not null,         -- "Côte d'Ivoire"
  kind                     public.port_kind not null,
  est_destination_courante boolean not null default false,
  actif                    boolean not null default true,
  created_at               timestamptz not null default now()
);

create index port_codes_destination_courante_idx
  on public.port_codes (est_destination_courante)
  where est_destination_courante = true;

create index port_codes_pays_idx on public.port_codes (pays_iso);

comment on table public.port_codes is
  'UN/LOCODE des ports maritimes et villes hinterland West Africa. Réf partagée.';

-- =============================================================================
-- 4. Triggers updated_at (shipping_lines uniquement — les autres sont stables)
-- =============================================================================

create trigger shipping_lines_set_updated_at
  before update on public.shipping_lines
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 5. RLS — lecture pour tous les utilisateurs authentifiés, écriture SUPER_ADMIN
-- =============================================================================

alter table public.shipping_lines  enable row level security;
alter table public.types_conteneur enable row level security;
alter table public.port_codes      enable row level security;

-- SELECT : tout user authentifié peut lire les réfs partagées
create policy "shipping_lines_select_authenticated"
  on public.shipping_lines for select
  to authenticated
  using (true);

create policy "types_conteneur_select_authenticated"
  on public.types_conteneur for select
  to authenticated
  using (true);

create policy "port_codes_select_authenticated"
  on public.port_codes for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE : réservé SUPER_ADMIN (équipe PORTTRACK)
create policy "shipping_lines_write_super_only"
  on public.shipping_lines for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "types_conteneur_write_super_only"
  on public.types_conteneur for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "port_codes_write_super_only"
  on public.port_codes for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- =============================================================================
-- 6. SEED — Données initiales
-- =============================================================================

-- 6.1 Compagnies maritimes actives au PAA (top opérateurs)
insert into public.shipping_lines (code_scac, nom, nom_court, pays_origine, site_web) values
  ('MSCU', 'Mediterranean Shipping Company',         'MSC',         'CH', 'https://www.msc.com'),
  ('MAEU', 'A.P. Moller-Maersk',                     'Maersk',      'DK', 'https://www.maersk.com'),
  ('CMDU', 'CMA CGM',                                'CMA-CGM',     'FR', 'https://www.cma-cgm.com'),
  ('HLCU', 'Hapag-Lloyd',                            'Hapag-Lloyd', 'DE', 'https://www.hapag-lloyd.com'),
  ('ONEY', 'Ocean Network Express',                  'ONE',         'JP', 'https://www.one-line.com'),
  ('EGLV', 'Evergreen Line',                         'Evergreen',   'TW', 'https://www.evergreen-line.com'),
  ('COSU', 'COSCO Shipping Lines',                   'COSCO',       'CN', 'https://lines.coscoshipping.com'),
  ('PILU', 'Pacific International Lines',            'PIL',         'SG', 'https://www.pilship.com'),
  ('OOLU', 'Orient Overseas Container Line',         'OOCL',        'HK', 'https://www.oocl.com'),
  ('YMLU', 'Yang Ming Marine Transport',             'Yang Ming',   'TW', 'https://www.yangming.com'),
  ('ZIMU', 'ZIM Integrated Shipping Services',       'ZIM',         'IL', 'https://www.zim.com'),
  ('SUDU', 'Hamburg Süd',                            'Hamburg Süd', 'DE', 'https://www.hamburgsud-line.com'),
  ('GRIM', 'Grimaldi Group',                         'Grimaldi',    'IT', 'https://www.grimaldi.napoli.it'),
  ('SAFM', 'Safmarine',                              'Safmarine',   'ZA', 'https://www.safmarine.com'),
  ('DLBC', 'Delmas (CMA CGM Africa Lines)',          'Delmas',      'FR', 'https://www.cma-cgm.com');

-- 6.2 Types de conteneurs ISO 6346 (standards les plus rencontrés au PAA)
insert into public.types_conteneur
  (code_iso, code_trade, taille_pieds, famille, description_fr, volume_m3, charge_max_kg, tare_kg) values
  ('22G0', '20DV',  20, 'DRY',       'Dry Van 20 pieds (sec standard)',                 33.20, 28230, 2300),
  ('42G1', '40DV',  40, 'DRY',       'Dry Van 40 pieds (sec standard)',                 67.70, 28800, 3800),
  ('45G1', '40HC',  40, 'HIGH_CUBE', 'High Cube 40 pieds (sec, hauteur 9''6'''')',      76.30, 28560, 3940),
  ('L5G1', '45HC',  45, 'HIGH_CUBE', 'High Cube 45 pieds (sec, longueur étendue)',      86.00, 27700, 4800),
  ('22R0', '20RF',  20, 'REEFER',    'Reefer 20 pieds (frigorifique)',                  28.30, 27700, 3050),
  ('42R1', '40RF',  40, 'REEFER',    'Reefer 40 pieds (frigorifique)',                  59.30, 29150, 4630),
  ('45R1', '40RH',  40, 'REEFER',    'Reefer High Cube 40 pieds (frigo, +30cm hauteur)', 67.30, 29150, 4850),
  ('22U1', '20OT',  20, 'OPEN_TOP',  'Open Top 20 pieds (toit ouvert/bâché)',           32.00, 28080, 2450),
  ('42U1', '40OT',  40, 'OPEN_TOP',  'Open Top 40 pieds (toit ouvert/bâché)',           66.40, 28480, 4170),
  ('22P0', '20FR',  20, 'FLAT_RACK', 'Flat Rack 20 pieds (plat à ridelles)',             null, 27900, 2360),
  ('42P0', '40FR',  40, 'FLAT_RACK', 'Flat Rack 40 pieds (plat à ridelles)',             null, 45000, 5500),
  ('22T0', '20TK',  20, 'TANK',      'Tank 20 pieds (citerne pour liquides)',           26.00, 26680, 4000);

-- 6.3 UN/LOCODE — Port d'Abidjan + hinterland West Africa + grandes origines

-- 6.3.a Port d'Abidjan + origines maritimes majeures
insert into public.port_codes
  (code_unlocode, nom_lieu, pays_iso, nom_pays, kind, est_destination_courante) values
  -- Port de référence
  ('CIABJ', 'Abidjan',         'CI', 'Côte d''Ivoire',     'PORT_MARITIME', true),

  -- Autres ports CI (secondaires)
  ('CISPY', 'San-Pédro',       'CI', 'Côte d''Ivoire',     'PORT_MARITIME', false),

  -- Origines Asie (majoritaires en imports)
  ('CNSHA', 'Shanghai',        'CN', 'Chine',              'PORT_MARITIME', false),
  ('CNNGB', 'Ningbo',          'CN', 'Chine',              'PORT_MARITIME', false),
  ('CNSHK', 'Shekou',          'CN', 'Chine',              'PORT_MARITIME', false),
  ('CNTAO', 'Qingdao',         'CN', 'Chine',              'PORT_MARITIME', false),
  ('CNXMN', 'Xiamen',          'CN', 'Chine',              'PORT_MARITIME', false),
  ('HKHKG', 'Hong Kong',       'HK', 'Hong Kong',          'PORT_MARITIME', false),
  ('SGSIN', 'Singapour',       'SG', 'Singapour',          'PORT_MARITIME', false),
  ('KRPUS', 'Busan',           'KR', 'Corée du Sud',       'PORT_MARITIME', false),
  ('JPYOK', 'Yokohama',        'JP', 'Japon',              'PORT_MARITIME', false),
  ('INNSA', 'Nhava Sheva',     'IN', 'Inde',               'PORT_MARITIME', false),

  -- Origines Europe
  ('NLRTM', 'Rotterdam',       'NL', 'Pays-Bas',           'PORT_MARITIME', false),
  ('BEANR', 'Anvers',          'BE', 'Belgique',           'PORT_MARITIME', false),
  ('DEHAM', 'Hambourg',        'DE', 'Allemagne',          'PORT_MARITIME', false),
  ('FRLEH', 'Le Havre',        'FR', 'France',             'PORT_MARITIME', false),
  ('FRMRS', 'Marseille',       'FR', 'France',             'PORT_MARITIME', false),
  ('ESALG', 'Algésiras',       'ES', 'Espagne',            'PORT_MARITIME', false),
  ('ITGOA', 'Gênes',           'IT', 'Italie',             'PORT_MARITIME', false),

  -- Origines Moyen-Orient / Méditerranée
  ('AEJEA', 'Jebel Ali',       'AE', 'Émirats arabes unis', 'PORT_MARITIME', false),
  ('MAPTM', 'Tanger Med',      'MA', 'Maroc',              'PORT_MARITIME', false),

  -- Origines Amérique
  ('USNYC', 'New York',        'US', 'États-Unis',         'PORT_MARITIME', false),
  ('BRSSZ', 'Santos',          'BR', 'Brésil',             'PORT_MARITIME', false);

-- 6.3.b Villes hinterland West Africa (destinations camion depuis Abidjan)
insert into public.port_codes
  (code_unlocode, nom_lieu, pays_iso, nom_pays, kind, est_destination_courante) values
  -- Burkina Faso (1er pays de destination hinterland)
  ('BFOUA', 'Ouagadougou',     'BF', 'Burkina Faso',       'VILLE_HINTERLAND', true),
  ('BFBOY', 'Bobo-Dioulasso',  'BF', 'Burkina Faso',       'VILLE_HINTERLAND', true),
  ('BFKOU', 'Koudougou',       'BF', 'Burkina Faso',       'VILLE_HINTERLAND', false),

  -- Mali
  ('MLBKO', 'Bamako',          'ML', 'Mali',               'VILLE_HINTERLAND', true),
  ('MLSIK', 'Sikasso',         'ML', 'Mali',               'VILLE_HINTERLAND', false),

  -- Niger
  ('NENIM', 'Niamey',          'NE', 'Niger',              'VILLE_HINTERLAND', true),

  -- Côte d'Ivoire — destinations intérieures courantes
  ('CIYAM', 'Yamoussoukro',    'CI', 'Côte d''Ivoire',     'VILLE_HINTERLAND', true),
  ('CIBOA', 'Bouaké',          'CI', 'Côte d''Ivoire',     'VILLE_HINTERLAND', true),
  ('CIDLA', 'Daloa',           'CI', 'Côte d''Ivoire',     'VILLE_HINTERLAND', false),
  ('CIKHS', 'Korhogo',         'CI', 'Côte d''Ivoire',     'VILLE_HINTERLAND', false),
  ('CIMAN', 'Man',             'CI', 'Côte d''Ivoire',     'VILLE_HINTERLAND', false),
  ('CIABO', 'Aboisso',         'CI', 'Côte d''Ivoire',     'VILLE_HINTERLAND', false),

  -- Ghana, Togo, Bénin (corridors transversaux occasionnels)
  ('GHACC', 'Accra',           'GH', 'Ghana',              'VILLE_HINTERLAND', false),
  ('GHKMS', 'Kumasi',          'GH', 'Ghana',              'VILLE_HINTERLAND', false),
  ('TGLFW', 'Lomé',            'TG', 'Togo',               'VILLE_HINTERLAND', false),
  ('BJCOO', 'Cotonou',         'BJ', 'Bénin',              'VILLE_HINTERLAND', false);

-- =============================================================================
-- 7. Grants
-- =============================================================================
-- Lecture pour le rôle authenticated (toutes les UI authentifiées)
grant select on public.shipping_lines  to authenticated;
grant select on public.types_conteneur to authenticated;
grant select on public.port_codes      to authenticated;

-- Lecture aussi pour anon (catalogues parfois utilisés sur landing/marketing
-- public — au pire on resserrera plus tard si pas nécessaire)
grant select on public.shipping_lines  to anon;
grant select on public.types_conteneur to anon;
grant select on public.port_codes      to anon;
