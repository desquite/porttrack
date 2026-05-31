"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  tenantUpdateSchema,
  tenantCreateSchema,
  type TenantUpdateInput,
  type TenantCreateInput,
} from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

// =============================================================================
// État + Server Action : création d'un tenant (SUPER_ADMIN uniquement)
// =============================================================================

export type TenantCreateState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<keyof TenantCreateInput, string[]>>;
      values?: Partial<Record<string, string>>;
    };

export async function createTenantAction(
  _prev: TenantCreateState,
  formData: FormData,
): Promise<TenantCreateState> {
  const values = readFormValues(formData);

  // 1. Validation Zod
  const parsed = tenantCreateSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof TenantCreateInput, string[]>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof TenantCreateInput | undefined;
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

  // 2. Vérifie que l'appelant est SUPER_ADMIN
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", formError: "Session expirée. Reconnecte-toi.", values };
  }
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "SUPER_ADMIN") {
    return {
      status: "error",
      formError: "Seul un SUPER_ADMIN peut créer une entreprise.",
      values,
    };
  }

  // 3. Insertion du tenant (RLS tenants_insert_super_only valide is_super_admin)
  const { data: tenant, error: insertErr } = await supabase
    .from("tenants")
    .insert({
      nom_entreprise: parsed.data.nom_entreprise,
      rccm: parsed.data.rccm,
      email_manager: parsed.data.email_manager,
      telephone: parsed.data.telephone,
      adresse: parsed.data.adresse,
      plan: parsed.data.plan,
      statut: parsed.data.statut,
    })
    .select("id, nom_entreprise")
    .single();

  if (insertErr || !tenant) {
    console.error("[createTenantAction] insert:", insertErr);
    if (insertErr?.code === "23505") {
      return {
        status: "error",
        fieldErrors: { rccm: ["Un tenant avec ce RCCM existe déjà"] },
        values,
      };
    }
    return {
      status: "error",
      formError: `Erreur base de données : ${insertErr?.message ?? "inconnue"}`,
      values,
    };
  }

  // 4. Invitation optionnelle du premier MANAGER
  if (parsed.data.manager_email) {
    const admin = createAdminClient();

    // Vérifie unicité de l'email
    const { data: existing } = await admin.auth.admin.listUsers();
    const alreadyExists = existing?.users.some(
      (u) => u.email?.toLowerCase() === parsed.data.manager_email!.toLowerCase(),
    );

    if (alreadyExists) {
      // Tenant créé mais manager pas invité — on remonte un message non-bloquant
      revalidatePath("/parametres");
      redirect(
        `/parametres?tenant=${tenant.id}&updated=${encodeURIComponent(
          tenant.nom_entreprise,
        )}&userMsg=${encodeURIComponent(
          "Entreprise créée. Le manager n'a pas été invité : un compte avec cet email existe déjà.",
        )}&userMsgType=error`,
      );
    }

    const { data: createdUser, error: createUserErr } = await admin.auth.admin.createUser({
      email: parsed.data.manager_email,
      email_confirm: true,
      app_metadata: { tenant_id: tenant.id, role: "MANAGER" },
    });

    if (createUserErr) {
      console.error("[createTenantAction] createUser:", createUserErr);
      revalidatePath("/parametres");
      redirect(
        `/parametres?tenant=${tenant.id}&updated=${encodeURIComponent(
          tenant.nom_entreprise,
        )}&userMsg=${encodeURIComponent(
          `Entreprise créée. Échec invitation manager : ${createUserErr.message}`,
        )}&userMsgType=error`,
      );
    }

    // IMPORTANT : admin.createUser pose app_metadata, mais le trigger
    // handle_new_user crée la ligne public.users AVANT/indépendamment et la
    // laisse en role=CUSTOM / tenant_id=null (race connue — cf. memory).
    // On FORCE donc la ligne public.users de façon déterministe, sinon le
    // manager voit « Aucune entreprise rattachée » (bug observé sur
    // TRANSPORT DU SUD). Même correctif que inviteUserAction (c426f24).
    if (createdUser?.user?.id) {
      const { error: forceErr } = await admin
        .from("users")
        .update({ tenant_id: tenant.id, role: "MANAGER" })
        .eq("id", createdUser.user.id);
      if (forceErr) {
        console.error("[createTenantAction] force public.users:", forceErr);
      }
    }

    // Magic link bonus
    const host = (await headers()).get("host") ?? "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: parsed.data.manager_email,
      options: { redirectTo: `${protocol}://${host}/api/auth/callback` },
    });
  }

  // 5. Succès — redirige vers la page du tenant créé
  revalidatePath("/parametres");
  revalidatePath("/dashboard");
  redirect(
    `/parametres?tenant=${tenant.id}&updated=${encodeURIComponent(tenant.nom_entreprise)}`,
  );
}
