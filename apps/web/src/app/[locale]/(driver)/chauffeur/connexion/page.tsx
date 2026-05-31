import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Anchor } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { DriverLoginForm } from "./_components/driver-login-form";

export default async function DriverLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Déjà connecté ET lié à un chauffeur → on entre directement dans l'app.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: chauffeur } = await supabase
      .from("chauffeurs")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (chauffeur) redirect("/chauffeur");
  }

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Anchor className="size-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">PORTTRACK Chauffeur</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connecte-toi avec ton numéro de téléphone.</p>
      </div>

      <DriverLoginForm />

      <p className="mt-8 text-center text-[11px] text-muted-foreground">
        Réservé aux chauffeurs enregistrés par leur entreprise.
      </p>
    </div>
  );
}
