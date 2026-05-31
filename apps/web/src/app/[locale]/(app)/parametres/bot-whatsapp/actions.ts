"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BotNumeroFormState =
  | { status: "idle" }
  | { status: "error"; formError: string; values?: Record<string, string> };

function normalizePhone(raw: string): string | null {
  const cleaned = (raw ?? "").replace(/[\s()-]/g, "");
  if (!/^\+?\d{8,15}$/.test(cleaned)) return null;
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

export async function addBotNumeroAction(
  _prev: BotNumeroFormState,
  formData: FormData,
): Promise<BotNumeroFormState> {
  const tenantId = String(formData.get("tenant_id") ?? "");
  const numeroRaw = String(formData.get("numero") ?? "");
  const label = String(formData.get("label") ?? "").trim() || null;
  const values = { numero: numeroRaw, label: label ?? "" };

  if (!tenantId) return { status: "error", formError: "Entreprise manquante.", values };

  const numero = normalizePhone(numeroRaw);
  if (!numero) {
    return { status: "error", formError: "Numéro invalide (8 à 15 chiffres, format international).", values };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", formError: "Session expirée.", values };

  const { error } = await supabase.from("bot_whatsapp_numeros").insert({
    tenant_id: tenantId,
    numero,
    label,
    created_by: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { status: "error", formError: "Ce numéro est déjà enregistré (éventuellement pour une autre entreprise).", values };
    }
    if (error.code === "42501" || error.message.includes("row-level security")) {
      return { status: "error", formError: "Réservé aux managers.", values };
    }
    return { status: "error", formError: `Erreur : ${error.message}`, values };
  }

  revalidatePath("/parametres/bot-whatsapp");
  redirect("/parametres/bot-whatsapp?created=1");
}

export async function toggleBotNumeroActifAction(id: string, actif: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("bot_whatsapp_numeros").update({ actif }).eq("id", id);
  if (error) redirect(`/parametres/bot-whatsapp?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/parametres/bot-whatsapp");
  redirect("/parametres/bot-whatsapp?updated=1");
}

export async function deleteBotNumeroAction(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("bot_whatsapp_numeros").delete().eq("id", id);
  if (error) redirect(`/parametres/bot-whatsapp?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/parametres/bot-whatsapp");
  redirect("/parametres/bot-whatsapp?deleted=1");
}
