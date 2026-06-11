import { requireAccess } from "@/lib/auth/guard";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAccess("operations.recherche", locale);
  return <>{children}</>;
}
