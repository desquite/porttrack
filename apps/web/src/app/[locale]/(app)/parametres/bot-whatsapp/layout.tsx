import { requirePlanFeature } from "@/lib/auth/plan";

/**
 * Garde de plan : le bot WhatsApp est une fonctionnalité Business+ (V7 §15.2).
 * Un tenant Starter (ou accès direct par URL) est redirigé vers /parametres
 * avec un message d'upsell.
 */
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requirePlanFeature("bot_whatsapp", locale);
  return <>{children}</>;
}
