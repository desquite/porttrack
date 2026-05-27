/**
 * Normalise une chaîne pour matcher la colonne `search_text` stockée en DB
 * (générée par lower + unaccent côté PostgreSQL).
 *
 * Exemples :
 *   "Touré"   → "toure"
 *   "MARIAM"  → "mariam"
 *   "ÉLÈVE"   → "eleve"
 *
 * Doit rester ALIGNÉ avec la fonction `immutable_unaccent(lower(...))`
 * définie dans la migration search_normalize. Si on change l'un, changer
 * l'autre.
 */
export function normalizeForSearch(input: string): string {
  return input
    .normalize("NFD")                       // décompose les caractères accentués (é → e + ◌́)
    .replace(/\p{Diacritic}/gu, "")          // supprime les marques diacritiques
    .toLowerCase()
    .trim();
}
