import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  Users,
  Truck,
  AlertTriangle,
  Package,
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  Wrench,
  ShieldAlert,
  Gavel,
} from "lucide-react";

import { firstAllowedHref, parsePermissions, type Role } from "@porttrack/shared";
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
  formatDateFR,
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

  // Le tableau de bord est réservé au Manager/Super Admin. Un autre
  // profil est redirigé vers sa 1re page autorisée.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: me } = await supabase
      .from("users")
      .select("role, permissions")
      .eq("id", user.id)
      .maybeSingle();
    const role = (me?.role ?? "CUSTOM") as Role;
    if (role !== "MANAGER" && role !== "SUPER_ADMIN") {
      redirect(`/${locale}${firstAllowedHref(role, parsePermissions(me?.permissions))}`);
    }
  }

  // Compteurs simples (count exact via head:true pour ne pas tirer les lignes)
  const [
    { count: chauffeursActifs },
    { count: chauffeursTotal },
    { count: materielEnService },
    { count: materielTotal },
    { count: conteneursEnCours },
    { count: conteneursTotal },
    { count: affectationsActives },
  ] = await Promise.all([
    supabase.from("chauffeurs").select("*", { count: "exact", head: true }).eq("statut", "ACTIF"),
    supabase.from("chauffeurs").select("*", { count: "exact", head: true }),
    supabase.from("materiel_roulant").select("*", { count: "exact", head: true }).eq("etat", "EN_SERVICE"),
    supabase.from("materiel_roulant").select("*", { count: "exact", head: true }),
    supabase.from("conteneurs").select("*", { count: "exact", head: true }).in("statut", ["EN_ATTENTE", "EN_COURS"]),
    supabase.from("conteneurs").select("*", { count: "exact", head: true }),
    supabase.from("affectations").select("*", { count: "exact", head: true }).in("statut", ["PLANIFIEE", "EN_COURS"]),
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
    .select("id, immatriculation, marque, modele, type, assurance_fin, visite_technique_fin, carte_transport_fin, carte_stationnement_fin, patente_fin")
    .eq("etat", "EN_SERVICE")
    .or(
      [
        `assurance_fin.lte.${horizonIso}`,
        `visite_technique_fin.lte.${horizonIso}`,
        `carte_transport_fin.lte.${horizonIso}`,
        `carte_stationnement_fin.lte.${horizonIso}`,
        `patente_fin.lte.${horizonIso}`,
      ].join(","),
    )
    .order("assurance_fin", { ascending: true, nullsFirst: false })
    .limit(5);

  // Alertes BADT : conteneurs ouverts dont la BADT approche (J+7) ou est dépassée.
  // La BADT (Bon À Délivrer Transitaire) est le jalon critique du PAA.
  const badtHorizon = new Date();
  badtHorizon.setDate(badtHorizon.getDate() + 7);
  const { data: conteneursAlertes } = await supabase
    .from("conteneurs")
    .select("id, numero, client, date_badt, statut")
    .in("statut", ["EN_ATTENTE", "EN_COURS"])
    .not("date_badt", "is", null)
    .lte("date_badt", badtHorizon.toISOString())
    .order("date_badt", { ascending: true })
    .limit(5);

  const totalAlertes =
    (chauffeursAlertes?.length ?? 0) +
    (materielAlertes?.length ?? 0) +
    (conteneursAlertes?.length ?? 0);

  // Pannes : nombre d'interventions ouvertes + coût réel du mois en cours
  const { count: pannesOuvertes } = await supabase
    .from("pannes")
    .select("*", { count: "exact", head: true })
    .in("statut", ["DECLAREE", "EN_REPARATION"]);

  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);
  const { data: pannesMois } = await supabase
    .from("pannes")
    .select("cout_reel_fcfa")
    .gte("date_declaration", debutMois.toISOString().slice(0, 10))
    .not("cout_reel_fcfa", "is", null);
  const coutPannesMois = (pannesMois ?? []).reduce(
    (acc, p) => acc + Number(p.cout_reel_fcfa ?? 0),
    0,
  );

  // Accidents ouverts (Déclaré ou En cours)
  const { count: accidentsOuverts } = await supabase
    .from("accidents")
    .select("*", { count: "exact", head: true })
    .in("statut", ["DECLARE", "EN_COURS_TRAITEMENT"]);

  // Amendes dues (non payées)
  const { data: amendesNonPayees } = await supabase
    .from("infractions")
    .select("montant_fcfa")
    .eq("statut", "NON_PAYEE");
  const totalAmendesDues = (amendesNonPayees ?? []).reduce(
    (acc, i) => acc + Number(i.montant_fcfa ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          Vue d'ensemble de votre activité — chauffeurs, flotte, conteneurs, affectations et alertes.
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
        />
        <KpiCard
          title="Conteneurs en cours"
          value={conteneursEnCours ?? 0}
          subtitle={`sur ${conteneursTotal ?? 0} au total`}
          icon={<Package className="size-4 text-primary" />}
          href="/conteneurs"
        />
        <KpiCard
          title="Affectations actives"
          value={affectationsActives ?? 0}
          subtitle="Planifiées ou en cours"
          icon={<ClipboardList className="size-4 text-primary" />}
          href="/affectations"
        />
        <KpiCard
          title="Alertes ouvertes"
          value={totalAlertes}
          subtitle="Documents & BADT"
          icon={<AlertTriangle className="size-4 text-amber-600" />}
          highlight
        />
        <KpiCard
          title="Pannes ouvertes"
          value={pannesOuvertes ?? 0}
          subtitle={`Coût mois : ${coutPannesMois.toLocaleString("fr-FR")} FCFA`}
          icon={<Wrench className="size-4 text-primary" />}
          href="/pannes"
        />
        <KpiCard
          title="Accidents ouverts"
          value={accidentsOuverts ?? 0}
          subtitle="Déclarés ou en traitement"
          icon={<ShieldAlert className="size-4 text-rose-600" />}
          href="/accidents"
        />
        <KpiCard
          title="Amendes dues"
          value={totalAmendesDues.toLocaleString("fr-FR")}
          subtitle="FCFA non payés"
          icon={<Gavel className="size-4 text-amber-700" />}
          href="/infractions"
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
              Assurance, visite technique, carte de transport, carte de stationnement, patente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!materielAlertes || materielAlertes.length === 0 ? (
              <EmptyState message="Aucune alerte — toute la flotte est en règle." />
            ) : (
              <ul className="space-y-3">
                {materielAlertes.map((m) => {
                  type DocKey = "assurance_fin" | "visite_technique_fin" | "carte_transport_fin" | "carte_stationnement_fin" | "patente_fin";
                  const docs: Array<{ key: DocKey; label: string }> = [
                    { key: "assurance_fin",           label: "Assurance" },
                    { key: "visite_technique_fin",    label: "VT" },
                    { key: "carte_transport_fin",     label: "Carte transport" },
                    { key: "carte_stationnement_fin", label: "Carte stationnement" },
                    { key: "patente_fin",             label: "Patente" },
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

      {/* Alertes BADT — jalon critique PAA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="size-4 text-primary" />
            BADT à surveiller
          </CardTitle>
          <CardDescription>
            Conteneurs ouverts dont le Bon À Délivrer Transitaire approche (≤ 7 jours) ou est dépassé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!conteneursAlertes || conteneursAlertes.length === 0 ? (
            <EmptyState message="Aucune BADT urgente — tous les conteneurs sont sous contrôle." />
          ) : (
            <ul className="space-y-3">
              {conteneursAlertes.map((c) => {
                const dateOnly = c.date_badt ? c.date_badt.slice(0, 10) : null;
                const status = classifyExpiry(dateOnly, 7);
                return (
                  <li
                    key={c.id}
                    className="flex items-start justify-between gap-3 rounded-md border p-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium">{c.numero}</span>
                        {c.client && (
                          <span className="text-xs text-muted-foreground">{c.client}</span>
                        )}
                      </div>
                      <div className="mt-1">
                        <Badge variant={EXPIRY_BADGE_VARIANT[status]}>
                          BADT {formatDateFR(dateOnly)} — {formatExpiryLabel(dateOnly)}
                        </Badge>
                      </div>
                    </div>
                    <Link
                      href={`/conteneurs/${c.id}`}
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
  value: number | string;
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
