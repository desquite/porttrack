import { setRequestLocale } from "next-intl/server";
import { Users, Phone, MessageCircle, User } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { loadDriverContext } from "../_components/load-driver";

/** Numéro au format WhatsApp (wa.me) : chiffres only, sans +. */
function waNumber(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("225") ? d : `225${d.replace(/^0+/, "")}`;
}

export default async function DriverTeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { chauffeur } = await loadDriverContext();
  if (!chauffeur) return null;

  const supabase = await createClient();
  // RLS limite déjà aux collègues de la même équipe ; on exclut soi-même.
  const { data: collegues } = await supabase
    .from("chauffeurs")
    .select("id, nom, prenoms, telephone, statut")
    .eq("statut", "ACTIF")
    .neq("id", chauffeur.id)
    .order("nom", { ascending: true });

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <Users className="size-5 text-primary" />Mon équipe
      </h1>

      {!collegues || collegues.length === 0 ? (
        <p className="rounded-md border bg-background px-3 py-4 text-sm text-muted-foreground">
          Aucun collègue dans ton équipe pour le moment.
        </p>
      ) : (
        <div className="space-y-2">
          {collegues.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <User className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.prenoms} {c.nom}</div>
                  {c.telephone && <div className="text-xs text-muted-foreground">{c.telephone}</div>}
                </div>
                {c.telephone && (
                  <div className="flex items-center gap-1">
                    <a href={`tel:${c.telephone.replace(/\s/g, "")}`} className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary" aria-label="Appeler">
                      <Phone className="size-4" />
                    </a>
                    <a href={`https://wa.me/${waNumber(c.telephone)}`} target="_blank" rel="noopener noreferrer" className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-label="WhatsApp">
                      <MessageCircle className="size-4" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
