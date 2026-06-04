import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, IdCard, Stethoscope, Info } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { classifyExpiry, EXPIRY_BADGE_VARIANT, formatExpiryLabel, formatDateFR } from "@/lib/utils/dates";
import { loadDriverContext } from "../_components/load-driver";

export default async function MaConformitePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { chauffeur } = await loadDriverContext();
  if (!chauffeur) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = chauffeur as any;
  const docs = [
    { label: "Permis de conduire", icon: IdCard, date: c.permis_expiration as string | null },
    { label: "Visite médicale", icon: Stethoscope, date: c.visite_medicale_expiration as string | null },
  ];

  return (
    <div className="space-y-4">
      <Link href="/chauffeur" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" />Retour
      </Link>
      <h1 className="text-xl font-bold tracking-tight">Ma conformité</h1>

      <Card>
        <CardContent className="divide-y p-0">
          {docs.map((d) => {
            const Icon = d.icon;
            const status = d.date ? classifyExpiry(d.date) : null;
            return (
              <div key={d.label} className="flex items-center gap-3 p-3">
                <Icon className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{d.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.date ? `Expire le ${formatDateFR(d.date)}` : "Non renseigné"}
                  </div>
                </div>
                {d.date && status && (
                  <Badge variant={EXPIRY_BADGE_VARIANT[status]} className="text-[10px]">
                    {formatExpiryLabel(d.date)}
                  </Badge>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 rounded-md border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        En cas de document expiré ou bientôt expiré, contacte ton entreprise pour le renouveler.
      </p>
    </div>
  );
}
