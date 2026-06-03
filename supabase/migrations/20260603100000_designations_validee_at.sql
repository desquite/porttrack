-- =============================================================================
-- Migration #30 — designations : état brouillon / validé (cahier v8 §6.2)
-- =============================================================================
-- Le nouvel écran de désignation à 2 panneaux fonctionne en deux temps :
--   * BROUILLON : la paire chauffeur↔camion est créée et auto-sauvée, mais
--     AUCUN WhatsApp n'est envoyé et elle n'est visible que des Ressources
--     d'Exploitation (invisible aux Opérations / chauffeur / check-lists).
--   * VALIDÉE   : au clic « VALIDER TOUT », validee_at est rempli, le WhatsApp
--     groupé part, et la désignation devient visible en aval.
--
-- On matérialise cet état par une seule colonne nullable `validee_at` :
--   NULL          → brouillon
--   timestamptz   → validée (date/heure de la validation)
--
-- Le VERROUILLAGE (date passée = immuable) reste DÉRIVÉ de date_designation
-- côté code, pas stocké.
--
-- Backfill : les désignations existantes ont été créées sous l'ancien modèle
-- (live + WhatsApp à la création). On les considère donc VALIDÉES pour ne pas
-- les faire disparaître des vues aval. validee_at = whatsapp_sent_at si connu,
-- sinon created_at.
-- =============================================================================

alter table public.designations
  add column if not exists validee_at timestamptz;

update public.designations
  set validee_at = coalesce(whatsapp_sent_at, created_at)
  where validee_at is null;

-- Index partiel : accès rapide aux désignations VALIDÉES d'une journée
-- (tableau de bord Opérations, affectation, PWA chauffeur, check-lists).
create index if not exists designations_validees_tenant_date_idx
  on public.designations (tenant_id, date_designation)
  where validee_at is not null;

comment on column public.designations.validee_at is
  'NULL = brouillon (visible Exploitation seulement, pas de WhatsApp). Rempli = validée via VALIDER TOUT (WhatsApp envoyé, visible en aval). Cahier v8 §6.2.';
