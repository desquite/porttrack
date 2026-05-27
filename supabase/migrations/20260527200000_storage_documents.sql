-- =============================================================================
-- PORTTRACK — Migration #5 : Storage Documents (scans PDF/images)
-- =============================================================================
-- Bucket `documents` privé qui héberge les scans des documents légaux
-- (permis, CNI, carte grise, assurance, etc.).
--
-- Convention de chemin :
--   <tenant_id>/<owner_type>/<owner_id>/<random>-<original-name>.<ext>
--   ex: 39597f07.../CHAUFFEUR/1894834e.../a1b2c3-permis-coulibaly.pdf
--
-- Ce nommage permet :
--   - une isolation tenant simple (premier segment = tenant_id)
--   - de lister tous les docs d'un chauffeur/véhicule en une requête
--   - d'éviter les collisions de noms via le préfixe random
--
-- RLS sur storage.objects : un user voit/édite uniquement les fichiers
-- dont le tenant_id (premier segment du nom) matche son JWT.
-- SUPER_ADMIN voit tout (cohérent avec le reste de la stack).
-- =============================================================================

-- =============================================================================
-- 1. Création du bucket (idempotent)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,                                -- privé : accès via signed URL uniquement
  10 * 1024 * 1024,                     -- 10 MB max par fichier
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- =============================================================================
-- 2. Helper : tenant_id depuis le chemin du fichier
-- =============================================================================
-- Le premier segment du `name` (avant le premier '/') est le tenant_id UUID.

create or replace function public.storage_tenant_from_path(file_name text)
returns uuid
language sql
immutable
parallel safe
as $$
  select nullif(split_part(file_name, '/', 1), '')::uuid;
$$;

comment on function public.storage_tenant_from_path(text) is
  'Extrait le tenant_id du chemin Supabase Storage (convention PORTTRACK)';

-- =============================================================================
-- 3. RLS storage.objects — bucket "documents"
-- =============================================================================
-- Note : storage.objects a déjà RLS activé par défaut sur Supabase Cloud.
-- On crée juste les policies pour notre bucket.

-- 3.1 SELECT : voir ses propres docs ou tous si SUPER_ADMIN
drop policy if exists "documents_select_own_tenant" on storage.objects;
create policy "documents_select_own_tenant"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or public.storage_tenant_from_path(name) = public.jwt_tenant_id()
    )
  );

-- 3.2 INSERT : uploader dans son tenant (ou n'importe où si SUPER_ADMIN)
drop policy if exists "documents_insert_own_tenant" on storage.objects;
create policy "documents_insert_own_tenant"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or public.storage_tenant_from_path(name) = public.jwt_tenant_id()
    )
  );

-- 3.3 UPDATE : déplacer/renommer ses propres docs (rare en pratique)
drop policy if exists "documents_update_own_tenant" on storage.objects;
create policy "documents_update_own_tenant"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or public.storage_tenant_from_path(name) = public.jwt_tenant_id()
    )
  )
  with check (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or public.storage_tenant_from_path(name) = public.jwt_tenant_id()
    )
  );

-- 3.4 DELETE : MANAGER + SUPER_ADMIN uniquement (cohérent avec la table documents)
drop policy if exists "documents_delete_manager_or_super" on storage.objects;
create policy "documents_delete_manager_or_super"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or (
        public.jwt_user_role() = 'MANAGER'
        and public.storage_tenant_from_path(name) = public.jwt_tenant_id()
      )
    )
  );
