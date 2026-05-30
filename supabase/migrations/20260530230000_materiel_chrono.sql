-- =============================================================================
-- PORTTRACK — Migration #17 : ajout colonne `chrono` au matériel roulant
-- =============================================================================
-- Le cahier (§7.3 / §8.1) prévoit un « Chrono (nom interne) » facultatif sur
-- chaque matériel roulant — ex. "TIGER 01", "LION 02" — affiché à côté de
-- l'immatriculation dans toute l'app et dans le message WhatsApp de désignation.
-- La colonne n'avait pas été créée à l'origine.
-- =============================================================================

alter table public.materiel_roulant
  add column chrono text;

create index materiel_chrono_idx
  on public.materiel_roulant (tenant_id, chrono)
  where chrono is not null;

comment on column public.materiel_roulant.chrono is
  'Nom interne facultatif du matériel (ex. TIGER 01) affiché à côté de l''immatriculation.';
