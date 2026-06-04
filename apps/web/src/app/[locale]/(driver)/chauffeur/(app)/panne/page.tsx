import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, Truck, MinusCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { loadDriverContext } from "../_components/load-driver";
import { DeclarePanneForm } from "./_components/declare-panne-form";

export default async function DeclarePannePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { chauffeur, designation } = await loadDriverContext();
  if (!chauffeur) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mr = (designation as any)?.materiel as { immatriculation: string; chrono: string | null } | null;
  const truckTitle = mr ? (mr.chrono ? `${mr.chrono} (${mr.immatriculation})` : mr.immatriculation) : null;

  const back = (
    <Link href="/chauffeur/camion" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-3" />Retour
    </Link>
  );

  return (
    <div className="space-y-4">
      {back}
      <h1 className="text-xl font-bold tracking-tight">Déclarer une panne</h1>

      {!truckTitle ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <MinusCircle className="size-5" />
            Aucun camion ne t&apos;est désigné aujourd&apos;hui — impossible de déclarer une panne.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-2 p-3">
              <Truck className="size-5 text-primary" />
              <div>
                <div className="text-[11px] text-muted-foreground">Camion concerné</div>
                <div className="font-semibold">{truckTitle}</div>
              </div>
            </CardContent>
          </Card>
          <DeclarePanneForm />
        </>
      )}
    </div>
  );
}
