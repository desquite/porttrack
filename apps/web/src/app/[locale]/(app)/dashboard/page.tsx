import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  Users,
  Truck,
  AlertTriangle,
  Calendar,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  classifyExpiry,
  EXPIRY_BADGE_VARIANT,
  formatExpiryLabel,
} from "@/lib/utils/dates";

/**
 * Dashboard principal : compteurs clés + alertes d'expiration.
 *
 * Pour un MANAGER : ne voit que les données de son tenant (filtre RLS auto)
 * Pour un SUPER_ADMIN : voit l'agrégé tous tenants confondus (bypass RLS via
 *                       is_super_admin() dans les policies)
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();

  // Compteurs simples (count exact via head:true pour ne pas tirer les lignes)
  const [
    { count: chauffeursActifs },
    { count: chauffeursTotal },
    { count: materielEnService },
    { count: materielTotal },
  ] = await Promise.all([
    supabase.from("chauffeurs").select("*", { count: "exact", head: true }).eq("statut", "ACTIF"),
    supabase.from("chauffeurs").select("*", { count: "exact", head: true }),
    supabase.from("materiel_roulant").select("*", { count: "exact", head: true }).eq("etat", "EN_SERVICE"),
    supabase.from("materiel_roulant").select("*", { count: "exact", head: true }),
  ]);

  // Alertes : on tire les chauffeurs/matériels avec dates d'expiration < J+30
  // (incluant les déjà expirés). On les triera côté client par criticité.
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const { data: chauffeursAlertes } = await supabase
    .from("chauffeurs")
    .select("id, prenoms, nom, permis_expiration, visite_medicale_expiration, tenant_id")
    .eq("statut", "ACTIF")
    .or(`permis_expiration.lte.${horizonIso},visite_medicale_expiration.lte.${horizonIso}`)
    .order("permis_expiration", { ascending: true, nullsFirst: false })
    .limit(5);

  const { data: materielAlertes } = await supabase
    .from("materiel_roulant")
    .select("id, immatriculation, marque, modele, type, assurance_fin, visite_technique_fin, vignette_fin, patente_fin, autorisation_dgttc_fin")
    .eq("etat", "EN_SERVICE")
    .or(
      [
        `assurance_fin.lte.${horizonIso}`,
        `visite_technique_fin.lte.${horizonIso}`,
        `vignette_fin.lte.${horizonIso}`,
        `patente_fin.lte.${horizonIso}`,
        `autorisation_dgttc_fin.lte.${horizonIso}`,
      ].join(","),
    )
    .order("assurance_fin", { ascending: true, nullsFirst: false })
    .limit(5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          Vue d'ensemble de votre activité — chauffeurs, flotte, alertes documents.
        </p>
      </div>

      {/* Compteurs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Chauffeurs actifs"
          value={chauffeursActifs ?? 0}
          subtitle={`sur ${chauffeursTotal ?? 0} au total`}
          icon={<Users className="size-4 text-primary" />}
          href="/chauffeurs"
        />
        <KpiCard
          title="Matériel en service"
          value={materielEnService ?? 0}
          subtitle={`sur ${materielTotal ?? 0} au total`}
          icon={<Truck className="size-4 text-primary" />}
          href="/flotte"
          disabled
        />
        <KpiCard
          title="Conteneurs en cours"
          value={0}
          subtitle="Module non activé"
          icon={<Calendar className="size-4 text-muted-foreground" />}
          disabled
        />
        <KpiCard
          title="Alertes ouvertes"
          value={(chauffeursAlertes?.length ?? 0) + (materielAlertes?.length ?? 0)}
          subtitle="Documents à renouveler"
          icon={<AlertTriangle className="size-4 text-amber-600" />}
          highlight
        />
      </div>

      {/* Alertes chauffeurs */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" />
              Documents chauffeurs à surveiller
            </CardTitle>
            <CardDescription>
              Permis et visites médicales qui expirent (ou ont expiré).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!chauffeursAlertes || chauffeursAlertes.length === 0 ? (
              <EmptyState message="Aucune alerte — tous les chauffeurs sont à jour." />
            ) : (
              <ul className="space-y-3">
                {chauffeursAlertes.map((c) => {
                  const permisStatus = classifyExpiry(c.permis_expiration);
                  const visiteStatus = classifyExpiry(c.visite_medicale_expiration);
                  return (
                    <li
                      key={c.id}
                      className="flex items-start justify-between gap-3 rounded-md border p-3"
                    >
                      <div>
                        <div className="font-medium text-sm">
                          {c.prenoms} {c.nom}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {permisStatus !== "ok" && (
                            <Badge variant={EXPIRY_BADGE_VARIANT[permisStatus]}>
                              Permis — {formatExpiryLabel(c.permis_expiration)}
                            </Badge>
                          )}
                          {visiteStatus !== "ok" && (
                            <Badge variant={EXPIRY_BADGE_VARIANT[visiteStatus]}>
                              Visite méd. — {formatExpiryLabel(c.visite_medicale_expiration)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/chauffeurs/${c.id}`}
                        className="text-xs text-primary hover:underline whitespace-nowrap pt-1"
                      >
                        Voir →
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="size-4 text-primary" />
              Documents matériel à surveiller
            </CardTitle>
            <CardDescription>
              Assurance, visite technique, vignette, patente, autorisation DGTTC.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!materielAlertes || materielAlertes.length === 0 ? (
              <EmptyState message="Aucune alerte — toute la flotte est en règle." />
            ) : (
              <ul className="space-y-3">
                {materielAlertes.map((m) => {
                  type DocKey = "assurance_fin" | "visite_technique_fin" | "vignette_fin" | "patente_fin" | "autorisation_dgttc_fin";
                  const docs: Array<{ key: DocKey; label: string }> = [
                    { key: "assurance_fin",           label: "Assurance" },
                    { key: "visite_technique_fin",    label: "VT" },
                    { key: "vignette_fin",            label: "Vignette" },
                    { key: "patente_fin",             label: "Patente" },
                    { key: "autorisation_dgttc_fin",  label: "DGTTC" },
                  ];
                  const alertes = docs
                    .map((d) => ({ ...d, status: classifyExpiry(m[d.key]), date: m[d.key] }))
                    .filter((d) => d.status === "expired" || d.status === "soon");

                  return (
                    <li
                      key={m.id}
                      className="flex items-start justify-between gap-3 rounded-md border p-3"
                    >
                      <div>
                        <div className="font-medium text-sm">
                          {m.immatriculation} — {m.marque} {m.modele}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {alertes.map((a) => (
                            <Badge key={a.key} variant={EXPIRY_BADGE_VARIANT[a.status]}>
                              {a.label} — {formatExpiryLabel(a.date)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  href,
  disabled,
  highlight,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  href?: string;
  disabled?: boolean;
  highlight?: boolean;
}) {
  const inner = (
    <Card
      className={
        "transition-colors " +
        (highlight ? "border-amber-300 bg-amber-50/40 " : "") +
        (disabled ? "opacity-60" : href ? "hover:border-primary/40 hover:shadow-sm" : "")
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {href && !disabled && (
            <ArrowRight className="size-4 text-muted-foreground" />
          )}
        </div>
      </CardContent>
    </Card>
  );

  return href && !disabled ? <Link href={href}>{inner}</Link> : inner;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-4 text-sm text-emerald-800">
      <CheckCircle2 className="size-4" />
      {message}
    </div>
  );
}
