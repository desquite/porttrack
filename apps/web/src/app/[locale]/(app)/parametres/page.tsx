import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Settings,
  Plus,
  ClipboardCheck,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  planAllowsFeature, minPlanForFeature, planUserLimit, planMaterielLimit,
  PLAN_LABELS, PLAN_FEATURE_LABELS,
  type PlanAbonnement, type PlanFeature,
} from "@porttrack/shared";
import { TenantForm } from "./_components/tenant-form";
import { UsersSection } from "./_components/users-section";

export default async function ParametresPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tenant?: string;
    updated?: string;
    userMsg?: string;
    userMsgType?: string;
    plan_feature?: string;
  }>;
}) {
  const { locale } = await params;
  const {
    tenant: tenantIdParam,
    updated,
    userMsg,
    userMsgType,
    plan_feature: planFeatureParam,
  } = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Récupère le profil pour connaître le rôle et le tenant_id de l'appelant
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user!.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  // Seuls SUPER_ADMIN et MANAGER peuvent administrer l'entreprise (éditer le
  // profil, gérer les membres). Les autres rôles voient la page en lecture seule.
  const canAdmin = isSuperAdmin || profile?.role === "MANAGER";

  // Détermine quel tenant on édite :
  //   - MANAGER (ou autre rôle avec tenant_id) → son tenant
  //   - SUPER_ADMIN → ?tenant=xxx, sinon affichage de la liste à choisir
  const tenantIdToEdit = isSuperAdmin
    ? tenantIdParam ?? null
    : profile?.tenant_id ?? null;

  // -------------------------------------------------------------------------
  // Cas A : SUPER_ADMIN sans tenant sélectionné → liste des tenants
  // -------------------------------------------------------------------------
  if (isSuperAdmin && !tenantIdToEdit) {
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, nom_entreprise, statut, plan, date_creation, telephone, email_manager")
      .order("nom_entreprise", { ascending: true });

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Paramètres — entreprises</h1>
            <p className="text-sm text-muted-foreground">
              En tant que SUPER_ADMIN, sélectionne une entreprise pour éditer ses
              paramètres (informations légales, contact, plan d'abonnement, statut).
            </p>
          </div>
          <Button asChild>
            <Link href="/parametres/nouveau">
              <Plus className="mr-2 size-4" />
              Nouvelle entreprise
            </Link>
          </Button>
        </div>

        {!tenants || tenants.length === 0 ? (
          <Card>
            <CardHeader className="text-center">
              <Building2 className="mx-auto size-8 text-muted-foreground" />
              <CardTitle className="text-base">Aucune entreprise</CardTitle>
              <CardDescription>
                Aucun tenant n'a encore été créé en base.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-3">
            {tenants.map((t) => (
              <Link
                key={t.id}
                href={`/parametres?tenant=${t.id}`}
                className="block"
              >
                <Card className="transition-colors hover:border-primary/30">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Building2 className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{t.nom_entreprise}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {t.plan}
                        </Badge>
                        <Badge
                          variant={
                            t.statut === "ACTIVE"
                              ? "success"
                              : t.statut === "TRIAL"
                                ? "info"
                                : t.statut === "SUSPENDED"
                                  ? "warning"
                                  : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {t.statut}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{t.email_manager}</span>
                        {t.telephone && <span>{t.telephone}</span>}
                        <span>
                          Créé le{" "}
                          {new Date(t.date_creation).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Cas B : pas de tenantId disponible (CUSTOM/USER sans rattachement)
  // -------------------------------------------------------------------------
  if (!tenantIdToEdit) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Aucune entreprise rattachée</AlertTitle>
          <AlertDescription>
            Ton compte n'est rattaché à aucune entreprise. Contacte ton manager
            ou l'équipe PORTTRACK pour t'attribuer une entreprise.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Cas C : on édite un tenant précis
  // -------------------------------------------------------------------------
  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tenantIdToEdit)
    .maybeSingle();

  if (!tenant) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Entreprise introuvable</AlertTitle>
          <AlertDescription>
            L'entreprise demandée n'existe pas ou tu n'as pas les droits pour y
            accéder.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Usage vs quotas du plan (V7 §15.2) — compté sur le tenant édité.
  const plan = (tenant.plan ?? null) as PlanAbonnement | null;
  const [{ count: usersCount }, { count: materielCount }] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    supabase.from("materiel_roulant").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
  ]);
  const usersLimit = planUserLimit(plan);
  const materielLimit = planMaterielLimit(plan);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        {isSuperAdmin && (
          <Link
            href="/parametres"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            ← Toutes les entreprises
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight">
          <Settings className="mr-2 inline size-5 text-primary" />
          {tenant.nom_entreprise}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSuperAdmin
            ? "Édite tous les paramètres incluant le plan d'abonnement et le statut."
            : canAdmin
              ? "Édite les informations de ton entreprise. Les champs marqués d'une ★ sont obligatoires."
              : "Consultation des informations de ton entreprise (lecture seule — la gestion est réservée au manager)."}
        </p>
      </div>

      {/* Flash : fonctionnalité réservée à un plan supérieur (redirection garde) */}
      {planFeatureParam && (() => {
        const feat = planFeatureParam as PlanFeature;
        const featLabel = PLAN_FEATURE_LABELS[feat] ?? planFeatureParam;
        const minPlan = minPlanForFeature(feat);
        return (
          <Alert className="border-amber-300 bg-amber-50/60 text-amber-900">
            <AlertTitle>Fonctionnalité non incluse dans votre plan</AlertTitle>
            <AlertDescription>
              <strong>{featLabel}</strong> nécessite le plan{" "}
              <strong>{minPlan ? PLAN_LABELS[minPlan] : "supérieur"}</strong> ou plus.
              {" "}Contacte l&apos;équipe PORTTRACK pour faire évoluer ton abonnement.
            </AlertDescription>
          </Alert>
        );
      })()}

      {/* Flash post-update */}
      {updated && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Modifications enregistrées</AlertTitle>
          <AlertDescription>
            Les paramètres de <strong>{updated}</strong> ont été mis à jour.
          </AlertDescription>
        </Alert>
      )}

      {/* Form profil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profil de l'entreprise</CardTitle>
          <CardDescription>
            Ces informations apparaissent sur les factures FNE et dans les
            communications avec tes chauffeurs et le PAA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantForm tenant={tenant} isSuperAdmin={isSuperAdmin} canEdit={canAdmin} />
        </CardContent>
      </Card>

      {/* Abonnement & usage (quotas du plan) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Abonnement & usage
            <Badge variant="secondary">{plan ? PLAN_LABELS[plan] : "—"}</Badge>
          </CardTitle>
          <CardDescription>
            Consommation par rapport aux limites de ton plan. Pour augmenter ces
            limites, contacte l&apos;équipe PORTTRACK.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <UsageRow label="Utilisateurs" used={usersCount ?? 0} limit={usersLimit} />
          <UsageRow label="Matériel roulant" used={materielCount ?? 0} limit={materielLimit} />
        </CardContent>
      </Card>

      {/* Section Membres */}
      <UsersSection
        tenantId={tenant.id}
        currentUserId={user!.id}
        canAdmin={canAdmin}
        userMsg={userMsg}
        userMsgType={
          userMsgType === "error" || userMsgType === "success"
            ? userMsgType
            : undefined
        }
      />

      {/* Section Items de check-list — accès direct au CRUD configuration */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="size-4 text-primary" />
              Items de check-list de départ
            </CardTitle>
            <CardDescription>
              Personnalise les items affichés aux chauffeurs (huile, pneus, freins, etc.).
              Par défaut, les 6 items sont configurés.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/parametres/checklist-items">
              Gérer<ChevronRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        </CardHeader>
      </Card>

      {/* Section Roulement du planning */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="size-4 text-primary" />
              Roulement du planning
            </CardTitle>
            <CardDescription>
              Règle le cycle des équipes (2 jours / 2 nuits / 2 repos) à partir d&apos;une date de
              référence. Le planning mensuel se calcule automatiquement.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/parametres/roulement">
              Régler<ChevronRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        </CardHeader>
      </Card>

      {/* Section Bot WhatsApp — consultation documents (fonctionnalité Business+) */}
      {(() => {
        const botAllowed = planAllowsFeature(
          (tenant.plan ?? null) as PlanAbonnement | null,
          "bot_whatsapp",
        );
        const minPlan = minPlanForFeature("bot_whatsapp");
        return (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="size-4 text-primary" />
                  Bot WhatsApp de consultation
                  {!botAllowed && (
                    <Badge variant="outline" className="ml-1 text-[10px]">
                      {minPlan ? PLAN_LABELS[minPlan] : "Business"}+
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {botAllowed
                    ? "Numéros autorisés à interroger le bot (CG/AS/VT…) et journal des consultations."
                    : `Fonctionnalité incluse à partir du plan ${minPlan ? PLAN_LABELS[minPlan] : "Business"}. Contacte PORTTRACK pour faire évoluer ton abonnement.`}
                </CardDescription>
              </div>
              {botAllowed ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/parametres/bot-whatsapp">
                    Gérer<ChevronRight className="ml-1 size-3.5" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Indisponible
                </Button>
              )}
            </CardHeader>
          </Card>
        );
      })()}
    </div>
  );
}

/** Ligne d'usage « X / Y » avec barre de remplissage. limit null = illimité. */
function UsageRow({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const unlimited = limit === null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const atLimit = !unlimited && used >= limit;
  const near = !unlimited && !atLimit && pct >= 80;
  const barColor = atLimit ? "bg-rose-500" : near ? "bg-amber-500" : "bg-primary";
  const textColor = atLimit ? "text-rose-600" : near ? "text-amber-600" : "text-foreground";

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${textColor}`}>
          {used} {unlimited ? "" : `/ ${limit}`}
          {unlimited && <span className="text-muted-foreground"> (illimité)</span>}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {atLimit && (
        <p className="text-xs text-rose-600">Limite atteinte — passe à un plan supérieur pour en ajouter.</p>
      )}
    </div>
  );
}
