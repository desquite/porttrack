import { redirect } from "next/navigation";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Anchor } from "lucide-react";

import { loadDriverContext, truckLabel } from "./_components/load-driver";
import { DriverHeaderMenu } from "./_components/driver-header-menu";
import { DriverBottomNav } from "./_components/driver-bottom-nav";

export default async function DriverAppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { user, chauffeur, designation } = await loadDriverContext();
  // Pas connecté OU compte non lié à un chauffeur → page de connexion
  if (!user || !chauffeur) redirect("/chauffeur/connexion");

  const name = `${chauffeur.prenoms} ${chauffeur.nom}`.trim();
  const truck = truckLabel(designation);

  return (
    <>
      {/* Header : logo + (nom + camion désigné) à droite */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">
        <Link href="/chauffeur" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Anchor className="size-4" />
          </span>
          <span className="text-sm">PORTTRACK</span>
        </Link>
        <DriverHeaderMenu name={name} truck={truck} />
      </header>

      <main className="flex-1 px-4 py-5">{children}</main>

      <DriverBottomNav />
    </>
  );
}
