"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ROLES, type Role } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// =============================================================================
// État partagé pour le formulaire d'invitation
// =============================================================================

export type InviteUserState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<"email" | "role", string[]>>;
      values?: { email?: string; role?: string };
    }
  | {
      status: "success";
      email: string;
      magicLink: string | null;
    };

// =============================================================================
// Helpers : vérification droits du caller
// =============================================================================

/**
 * Vérifie que l'utilisateur courant peut administrer le tenant cible :
 *   - SUPER_ADMIN : oui sur tous les tenants
 *   - MANAGER     : oui sur SON propre tenant uniquement
 *   - autre rôle  : non
 *
 * Retourne le profile (role, tenant_id) pour usage ultérieur.
 */
async function ensureCanAdminTenant(tenantId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Session expirée");

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id, id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) throw new Error("Profil utilisateur introuvable");

  const isSuperAdmin = profile.role === "SUPER_ADMIN";
  const isManagerOfTenant =
    profile.role === "MANAGER" && profile.tenant_id === tenantId;

  if (!isSuperAdmin && !isManagerOfTenant) {
    throw new Error("Tu n'as pas les droits pour administrer cette entreprise");
  }

  return { user, profile, isSuperAdmin };
}

// =============================================================================
// Action : inviter un nouvel utilisateur dans un tenant
// =============================================================================

export async function inviteUserAction(
  tenantId: string,
  _prev: InviteUserState,
  formData: FormData,
): Promise<InviteUserState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "").trim();

  // -------- Validation --------
  const fieldErrors: NonNullable<
    Extract<InviteUserState, { status: "error" }>["fieldErrors"]
  > = {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = ["Adresse email invalide"];
  }
  if (!role || !(ROLES as readonly string[]).includes(role)) {
    fieldErrors.role = ["Rôle invalide"];
  }
  // On interdit la création d'un SUPER_ADMIN via cette UI — uniquement via SQL
  if (role === "SUPER_ADMIN") {
    fieldErrors.role = [
      "L'élévation en SUPER_ADMIN doit être faite via SQL par l'équipe PORTTRACK",
    ];
  }
  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      formError: "Le formulaire contient des erreurs.",
      fieldErrors,
      values: { email, role },
    };
  }

  // -------- Vérification droits --------
  try {
    await ensureCanAdminTenant(tenantId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur de droits";
    return { status: "error", formError: msg, values: { email, role } };
  }

  // -------- Création du user via service_role --------
  const admin = createAdminClient();

  // Vérifie d'abord si l'email existe déjà (auth.admin.createUser ne donne
  // pas un message net en cas de duplicate)
  const { data: existingByEmail } = await admin.auth.admin.listUsers();
  const alreadyExists = existingByEmail?.users.some(
    (u) => u.email?.toLowerCase() === email,
  );
  if (alreadyExists) {
    return {
      status: "error",
      fieldErrors: {
        email: ["Un compte avec cet email existe déjà dans Supabase"],
      },
      values: { email, role },
    };
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true, // pas besoin d'email de validation — on le considère vérifié
    app_metadata: {
      tenant_id: tenantId,
      role,
    },
  });

  if (createErr || !created?.user) {
    console.error("[inviteUserAction] createUser:", createErr);
    return {
      status: "error",
      formError: `Échec de création : ${createErr?.message ?? "erreur inconnue"}`,
      values: { email, role },
    };
  }

  // Le trigger handle_new_user a créé public.users avec tenant_id + role
  // (lus depuis raw_app_meta_data).

  // -------- Génération d'un magic link --------
  // On déduit l'origin de la requête pour construire l'URL de redirection
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink(
    {
      type: "magiclink",
      email,
      options: {
        redirectTo: `${origin}/api/auth/callback`,
      },
    },
  );

  if (linkErr) {
    console.error("[inviteUserAction] generateLink:", linkErr);
    // On retourne quand même un success — le user est créé, il pourra se
    // connecter via /login normalement. Le magic link n'est qu'un bonus.
  }

  revalidatePath("/parametres");

  return {
    status: "success",
    email,
    magicLink: linkData?.properties?.action_link ?? null,
  };
}

// =============================================================================
// Action : changer le rôle d'un user existant
// =============================================================================
// Reste sur le mode "redirect avec ?userMsg=" pour le feedback — le composant
// UserRow appelle cette action depuis un Server Action via <form>.

export async function updateUserRoleAction(
  userId: string,
  tenantId: string,
  formData: FormData,
): Promise<void> {
  const newRole = String(formData.get("role") ?? "").trim();
  if (!(ROLES as readonly string[]).includes(newRole)) {
    redirect(
      `/parametres?tenant=${tenantId}&userMsg=${encodeURIComponent(
        "Rôle invalide",
      )}&userMsgType=error`,
    );
  }
  if (newRole === "SUPER_ADMIN") {
    redirect(
      `/parametres?tenant=${tenantId}&userMsg=${encodeURIComponent(
        "Élévation SUPER_ADMIN réservée à SQL",
      )}&userMsgType=error`,
    );
  }

  try {
    await ensureCanAdminTenant(tenantId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur de droits";
    redirect(
      `/parametres?tenant=${tenantId}&userMsg=${encodeURIComponent(msg)}&userMsgType=error`,
    );
  }

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("users")
    .update({ role: newRole as Role })
    .eq("id", userId)
    .eq("tenant_id", tenantId) // double-check : on ne touche que ce tenant
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("[updateUserRoleAction]", error);
    redirect(
      `/parametres?tenant=${tenantId}&userMsg=${encodeURIComponent(
        error?.message ?? "Utilisateur introuvable",
      )}&userMsgType=error`,
    );
  }

  revalidatePath("/parametres");
  redirect(
    `/parametres?tenant=${tenantId}&userMsg=${encodeURIComponent(
      "Rôle mis à jour",
    )}&userMsgType=success`,
  );
}

// =============================================================================
// Action : activer/désactiver un user
// =============================================================================

export async function toggleUserActiveAction(
  userId: string,
  tenantId: string,
  currentActif: boolean,
): Promise<void> {
  try {
    const { user: caller } = await ensureCanAdminTenant(tenantId);
    if (caller.id === userId) {
      redirect(
        `/parametres?tenant=${tenantId}&userMsg=${encodeURIComponent(
          "Tu ne peux pas désactiver ton propre compte",
        )}&userMsgType=error`,
      );
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur de droits";
    redirect(
      `/parametres?tenant=${tenantId}&userMsg=${encodeURIComponent(msg)}&userMsgType=error`,
    );
  }

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("users")
    .update({ actif: !currentActif })
    .eq("id", userId)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("[toggleUserActiveAction]", error);
    redirect(
      `/parametres?tenant=${tenantId}&userMsg=${encodeURIComponent(
        error?.message ?? "Utilisateur introuvable",
      )}&userMsgType=error`,
    );
  }

  revalidatePath("/parametres");
  redirect(
    `/parametres?tenant=${tenantId}&userMsg=${encodeURIComponent(
      currentActif ? "Utilisateur désactivé" : "Utilisateur réactivé",
    )}&userMsgType=success`,
  );
}
