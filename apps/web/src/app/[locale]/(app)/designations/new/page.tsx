import { redirect } from "next/navigation";

/**
 * L'ancien formulaire de désignation unitaire est remplacé par l'écran de
 * désignation à 2 panneaux (cahier v8 §6.2). On redirige toute arrivée sur
 * /designations/new vers l'écran principal, en conservant la date éventuelle.
 */
export default async function NewDesignationRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? `?date=${sp.date}` : "";
  redirect(`/${locale}/designations${date}`);
}
