/**
 * Generated Supabase types — placeholder.
 *
 * Once the database schema is in place, regenerate this file with:
 *
 *   pnpm dlx supabase gen types typescript --project-id <id> \
 *     > packages/shared/src/database.types.ts
 *
 * For now we expose a minimal `Database` shape so downstream code
 * can import it without errors.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
