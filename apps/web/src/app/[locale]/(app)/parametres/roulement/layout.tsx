import { requirePlanFeature } from "@/lib/auth/plan";
import { requireAccess } from "@/lib/auth/guard";

/**
 * Réglage du roulement = fonctionnalité Business+ (comme le planning) + droit
 * Exploitation/Planning. La page elle-même restreint l'écriture au manager.
 */
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requirePlanFeature("planning", locale);
  await requireAccess("exploitation.planning", locale);
  return <>{children}</>;
}
