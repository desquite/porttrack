"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { DOCUMENT_TYPES, type DocumentOwnerType } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// Types d'état partagés avec le formulaire d'upload
// =============================================================================

export type DocumentUploadState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: string;
      fieldErrors?: Partial<Record<string, string[]>>;
    };

// Limites alignées avec le bucket Supabase (cf migration storage_documents)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

// =============================================================================
// Helpers
// =============================================================================

function sanitizeFilename(name: string): string {
  // Retire les caractères dangereux pour les paths/URLs, garde extension
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
}

// =============================================================================
// Server Action : upload d'un document
// =============================================================================

export async function uploadDocumentAction(
  ownerType: DocumentOwnerType,
  ownerId: string,
  tenantId: string,
  redirectPath: string,
  _prev: DocumentUploadState,
  formData: FormData,
): Promise<DocumentUploadState> {
  // -------- Validation des inputs --------
  const typeDoc = String(formData.get("type_document") ?? "");
  if (!(DOCUMENT_TYPES as readonly string[]).includes(typeDoc)) {
    return {
      status: "error",
      fieldErrors: { type_document: ["Type de document invalide"] },
    };
  }

  const numero = String(formData.get("numero") ?? "").trim() || null;
  const dateEmission = String(formData.get("date_emission") ?? "").trim() || null;
  const dateExpiration = String(formData.get("date_expiration") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  // Validation dates basique
  for (const [field, val] of [
    ["date_emission", dateEmission],
    ["date_expiration", dateExpiration],
  ] as const) {
    if (val && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return {
        status: "error",
        fieldErrors: { [field]: ["Format de date invalide"] },
      };
    }
  }
  if (dateEmission && dateExpiration && dateEmission > dateExpiration) {
    return {
      status: "error",
      fieldErrors: {
        date_expiration: ["L'expiration doit être postérieure à l'émission"],
      },
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      fieldErrors: { file: ["Fichier obligatoire"] },
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      status: "error",
      fieldErrors: {
        file: [`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB) — maximum 10 MB`],
      },
    };
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      status: "error",
      fieldErrors: {
        file: [`Type de fichier non autorisé (${file.type}). Accepté : PDF, JPEG, PNG, WEBP.`],
      },
    };
  }

  // -------- Vérifie session --------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", formError: "Session expirée. Reconnecte-toi." };
  }

  // -------- Upload sur Supabase Storage --------
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const baseName = sanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
  const objectPath = `${tenantId}/${ownerType}/${ownerId}/${randomUUID()}-${baseName}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[uploadDocumentAction] storage upload error:", uploadError);
    return {
      status: "error",
      formError: `Échec d'upload : ${uploadError.message}`,
    };
  }

  // -------- Insertion en DB --------
  const { error: dbError } = await supabase.from("documents").insert({
    tenant_id: tenantId,
    owner_type: ownerType,
    owner_id: ownerId,
    type_document: typeDoc as (typeof DOCUMENT_TYPES)[number],
    numero,
    date_emission: dateEmission,
    date_expiration: dateExpiration,
    fichier_url: objectPath,
    fichier_nom: file.name,
    fichier_taille: file.size,
    notes,
    uploaded_by: user.id,
  });

  if (dbError) {
    // Rollback : on essaie de supprimer le fichier qu'on vient d'uploader
    await supabase.storage.from("documents").remove([objectPath]);
    console.error("[uploadDocumentAction] db insert error:", dbError);
    return {
      status: "error",
      formError: `Erreur base de données : ${dbError.message}`,
    };
  }

  revalidatePath(redirectPath);
  return { status: "idle" };
}

// =============================================================================
// Server Action : suppression d'un document
// =============================================================================

export async function deleteDocumentAction(
  documentId: string,
  redirectPath: string,
): Promise<void> {
  const supabase = await createClient();

  // Récupère le path pour pouvoir supprimer le fichier ensuite (RLS filtre)
  const { data: doc } = await supabase
    .from("documents")
    .select("fichier_url")
    .eq("id", documentId)
    .maybeSingle();

  if (!doc) {
    redirect(`${redirectPath}?docError=${encodeURIComponent("Document introuvable ou droits insuffisants")}`);
  }

  // 1. Supprime la ligne DB (la RLS bloque les non-MANAGER)
  const { error: dbError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (dbError) {
    console.error("[deleteDocumentAction] db delete error:", dbError);
    redirect(
      `${redirectPath}?docError=${encodeURIComponent(
        dbError.code === "42501" || dbError.message.includes("row-level security")
          ? "Suppression réservée aux MANAGER."
          : `Erreur de suppression : ${dbError.message}`,
      )}`,
    );
  }

  // 2. Supprime le fichier du Storage (best-effort — la RLS bloque les non-MANAGER)
  if (doc?.fichier_url) {
    await supabase.storage.from("documents").remove([doc.fichier_url]);
  }

  revalidatePath(redirectPath);
}

// =============================================================================
// Server Action : générer une URL signée pour télécharger
// =============================================================================
// On ne renvoie pas l'URL directement au client (pas de retour JSON depuis
// une action invoquée via <form>) — on redirige le navigateur vers la signed
// URL Supabase. Validité 60 secondes (le temps de cliquer + télécharger).

export async function downloadDocumentAction(documentId: string): Promise<void> {
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("fichier_url, fichier_nom")
    .eq("id", documentId)
    .maybeSingle();

  if (!doc?.fichier_url) {
    redirect("/dashboard?error=" + encodeURIComponent("Document introuvable"));
  }

  const { data: signed, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc!.fichier_url, 60, {
      download: doc!.fichier_nom ?? undefined, // force le download attribute
    });

  if (error || !signed?.signedUrl) {
    console.error("[downloadDocumentAction]", error);
    redirect(
      "/dashboard?error=" +
        encodeURIComponent(`Impossible de générer le lien : ${error?.message ?? "erreur inconnue"}`),
    );
  }

  redirect(signed.signedUrl);
}
