"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Le chauffeur confirme avoir récupéré le vide et l'avoir déposé à destination.
 * Ferme le cycle import (statut CONFIRMEE). RLS : le chauffeur ne peut mettre à
 * jour que SES récupérations (policy recuperations_driver_update_own).
 */
export async function confirmDriverRecuperationAction(
  recuperationId: string,
): Promise<void> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("recuperations")
    .update({ statut: "CONFIRMEE", date_recuperation: today })
    .eq("id", recuperationId)
    .eq("statut", "PLANIFIEE");

  if (error) {
    redirect(`/chauffeur/recuperation?id=${recuperationId}&error=1`);
  }

  revalidatePath("/chauffeur");
  redirect("/chauffeur?recup=ok");
}
