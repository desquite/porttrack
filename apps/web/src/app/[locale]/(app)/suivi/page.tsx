import { setRequestLocale } from "next-intl/server";
import { MapPin } from "lucide-react";

import { SuiviMap } from "./_components/suivi-map";

export default async function SuiviPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MapPin className="size-6 text-primary" />
          Suivi temps réel
        </h1>
        <p className="text-sm text-muted-foreground">
          Position des chauffeurs en ligne (app ouverte). La carte se rafraîchit automatiquement.
        </p>
      </div>

      <SuiviMap />
    </div>
  );
}
