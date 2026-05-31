import { setRequestLocale } from "next-intl/server";

/**
 * Layout racine de la PWA chauffeur. Conteneur mobile centré (max-w-md),
 * pensé téléphone. L'authentification et la coquille (header + barre du bas)
 * sont gérées par le layout (app) interne — la page de connexion reste hors
 * de cette coquille.
 */
export default async function DriverRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-muted/20">
      {children}
    </div>
  );
}
