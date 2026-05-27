"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { tenantUpdateSchema, type TenantUpdateInput } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// État partagé avec le composant client
// =============================================================================

export type TenantFormState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<keyof TenantUpdateInput, string[]>>;
      values?: Partial<Record<string, string>>;
    };

// =============================================================================
// Helpers
// =============================================================================

function readFormValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    out[key] = String(value ?? "");
  }
  return out;
}

// =============================================================================
// Server Action : mise à jour d'un tenant
// =============================================================================
// Le tenantId est bindé côté client (cf form). Les champs réservés
// (plan, statut, date_fin_essai) ne sont pris en compte que si l'appelant
// est SUPER_ADMIN — sinon ils sont silencieusement ignorés.
// =============================================================================

export async function updateTenantAction(
  tenantId: string,
  _prev: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const values = readFormValues(formData);

  // 1. Validation Zod
  const parsed = tenantUpdateSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof TenantUpdateInput, string[]>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof TenantUpdateInput | undefined;
      if (!field) continue;
      const existing = fieldErrors[field] ?? [];
      existing.push(issue.message);
      fieldErrors[field] = existing;
    }
    return {
      status: "error",
      formError: "Le formulaire contient des erreurs. Corrige les champs en rouge.",
      fieldErrors,
      values,
    };
  }

  // 2. Récupère le user + son rôle pour gater les champs admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", formError: "Session expirée. Reconnecte-toi.", values };
  }
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";

  // 3. Filtre les champs envoyés selon le rôle
  //    - MANAGER peut éditer SON tenant : on retire plan/statut/date_fin_essai
  //    - SUPER_ADMIN peut tout éditer sur n'importe quel tenant
  const baseFields = {
    nom_entreprise: parsed.data.nom_entreprise,
    rccm:           parsed.data.rccm,
    email_manager:  parsed.data.email_manager,
    telephone:      parsed.data.telephone,
    adresse:        parsed.data.adresse,
  };
  const adminFields = isSuperAdmin
    ? {
        plan:           parsed.data.plan,
        statut:         parsed.data.statut,
        date_fin_essai: parsed.data.date_fin_essai,
      }
    : {};

  const updates = { ...baseFields, ...adminFields };

  // 4. Update avec RLS qui sert de filet de sécurité (si un MANAGER tente
  //    de tamper le tenantId via l'URL, la policy update_manager_or_super
  //    bloquera : update sur un id != jwt_tenant_id retournera 0 ligne)
  const { error, data } = await supabase
    .from("tenants")
    .update(updates)
    .eq("id", tenantId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[updateTenantAction]", error);
    if (error.code === "42501" || error.message.includes("row-level security")) {
      return {
        status: "error",
        formError: "Tu n'as pas les droits pour modifier cette entreprise.",
        values,
      };
    }
    return {
      status: "error",
      formError: `Erreur base de données : ${error.message}`,
      values,
    };
  }

  if (!data) {
    return {
      status: "error",
      formError: "Entreprise introuvable ou droits insuffisants.",
      values,
    };
  }

  // 5. Succès
  revalidatePath("/parametres");
  revalidatePath("/dashboard");
  const baseUrl = isSuperAdmin
    ? `/parametres?tenant=${tenantId}`
    : "/parametres";
  redirect(
    `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}updated=${encodeURIComponent(parsed.data.nom_entreprise)}`,
  );
}
