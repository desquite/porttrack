"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ROLES, type Role } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email-resend";
import type { NotificationMessage } from "@/lib/notifications/types";

// =============================================================================
// État partagé pour le formulaire d'invitation
// =============================================================================

type InviteFieldErrorKey = "email" | "role" | "prenoms" | "nom" | "telephone";
type InviteValues = {
  email?: string;
  role?: string;
  prenoms?: string;
  nom?: string;
  telephone?: string;
};

export type InviteUserState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<InviteFieldErrorKey, string[]>>;
      values?: InviteValues;
    }
  | {
      status: "success";
      email: string;
      magicLink: string | null;
      /** true si l'email d'invitation a bien été expédié via Resend */
      emailSent: boolean;
    };

const PHONE_RE = /^[+0-9 ()-]{8,30}$/;

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
  const prenoms = String(formData.get("prenoms") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim();
  const values: InviteValues = { email, role, prenoms, nom, telephone };

  // -------- Validation --------
  const fieldErrors: NonNullable<
    Extract<InviteUserState, { status: "error" }>["fieldErrors"]
  > = {};
  if (!prenoms) {
    fieldErrors.prenoms = ["Prénoms obligatoires"];
  }
  if (!nom) {
    fieldErrors.nom = ["Nom obligatoire"];
  }
  if (telephone && !PHONE_RE.test(telephone)) {
    fieldErrors.telephone = ["Numéro de téléphone invalide"];
  }
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
      values,
    };
  }

  // -------- Vérification droits --------
  try {
    await ensureCanAdminTenant(tenantId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur de droits";
    return { status: "error", formError: msg, values };
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
      values,
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
      values,
    };
  }

  // Le trigger handle_new_user a créé la ligne public.users — MAIS
  // admin.createUser écrit app_metadata (tenant_id/role) APRÈS l'insert
  // d'auth.users, donc le trigger les voit vides et met les valeurs par défaut
  // (CUSTOM / tenant_id null). On force donc explicitement les bonnes valeurs
  // via service_role, ce qui est déterministe et insensible à ce timing.
  const { error: syncErr } = await admin
    .from("users")
    .update({
      tenant_id: tenantId,
      role: role as Role,
      prenoms,
      nom,
      telephone: telephone || null,
    })
    .eq("id", created.user.id);

  if (syncErr) {
    console.error("[inviteUserAction] sync public.users:", syncErr);
    return {
      status: "error",
      formError: `Compte créé mais le rattachement à l'entreprise a échoué : ${syncErr.message}. Corrige le rôle/l'entreprise depuis la liste des utilisateurs.`,
      values,
    };
  }

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

  const magicLink = linkData?.properties?.action_link ?? null;

  // -------- Envoi automatique de l'invitation par email (Resend) --------
  // Best-effort : si Resend n'est pas configuré (RESEND_API_KEY absent) ou
  // échoue, on retourne quand même un succès avec le lien à copier/envoyer.
  let emailSent = false;
  if (magicLink) {
    const result = await sendEmail(
      email,
      buildInviteEmail({
        magicLink,
        loginUrl: `${origin}/login`,
        roleLabel: ROLE_LABELS_FR[role as Role] ?? role,
      }),
    );
    emailSent = result.ok === true;
    if (!result.ok) {
      console.error("[inviteUserAction] sendEmail:", result.error);
    }
  }

  revalidatePath("/parametres");

  return {
    status: "success",
    email,
    magicLink,
    emailSent,
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
// Action : mettre à jour l'identité d'un membre (prénoms / nom / téléphone)
// =============================================================================
// Permet de compléter les comptes créés avant la capture du nom, ou de
// corriger une faute. Réservé aux administrateurs du tenant.

export async function updateUserProfileAction(
  userId: string,
  tenantId: string,
  formData: FormData,
): Promise<void> {
  const prenoms = String(formData.get("prenoms") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim();

  const fail = (msg: string) =>
    redirect(
      `/parametres?tenant=${tenantId}&userMsg=${encodeURIComponent(msg)}&userMsgType=error`,
    );

  if (!prenoms || !nom) fail("Le prénom et le nom sont obligatoires.");
  if (telephone && !PHONE_RE.test(telephone)) fail("Numéro de téléphone invalide.");

  try {
    await ensureCanAdminTenant(tenantId);
  } catch (e: unknown) {
    fail(e instanceof Error ? e.message : "Erreur de droits");
  }

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("users")
    .update({ prenoms, nom, telephone: telephone || null })
    .eq("id", userId)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("[updateUserProfileAction]", error);
    fail(error?.message ?? "Utilisateur introuvable");
  }

  revalidatePath("/parametres");
  redirect(
    `/parametres?tenant=${tenantId}&userMsg=${encodeURIComponent(
      "Identité mise à jour",
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

// =============================================================================
// Email d'invitation (envoyé via Resend)
// =============================================================================

const ROLE_LABELS_FR: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGER:     "Manager",
  DISPATCHER:  "Dispatcher",
  COMPTABLE:   "Comptable",
  CHEF_GARAGE: "Chef de garage",
  CUSTOM:      "Utilisateur",
};

function buildInviteEmail({
  magicLink,
  loginUrl,
  roleLabel,
}: {
  magicLink: string;
  loginUrl: string;
  roleLabel: string;
}): NotificationMessage {
  const subject = "Invitation à PORTTRACK";

  const textBody = [
    "Bonjour,",
    "",
    `Tu as été invité(e) à rejoindre PORTTRACK en tant que ${roleLabel}.`,
    "",
    "Connecte-toi en cliquant sur ce lien (valable environ 1 heure) :",
    magicLink,
    "",
    `Si le lien a expiré, va sur ${loginUrl} et saisis cette adresse email : tu recevras un code de connexion à 6 chiffres.`,
    "",
    "— L'équipe PORTTRACK",
  ].join("\n");

  const htmlBody = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
    <h2 style="margin:0 0 4px">PORTTRACK</h2>
    <p style="color:#475569;margin:0 0 20px">Suivi de flotte & logistique portuaire</p>
    <p>Bonjour,</p>
    <p>Tu as été invité(e) à rejoindre <strong>PORTTRACK</strong> en tant que <strong>${roleLabel}</strong>.</p>
    <p style="margin:24px 0">
      <a href="${magicLink}" style="background:#0f172a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">
        Me connecter à PORTTRACK
      </a>
    </p>
    <p style="color:#64748b;font-size:13px">Ce lien est valable environ 1 heure.</p>
    <p style="color:#64748b;font-size:13px">
      S'il a expiré, rends-toi sur <a href="${loginUrl}">${loginUrl}</a> et saisis cette adresse email :
      tu recevras un code de connexion à 6 chiffres.
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="color:#94a3b8;font-size:12px">— L'équipe PORTTRACK</p>
  </div>`;

  return { subject, textBody, htmlBody };
}
