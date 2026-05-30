import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Wrench,
  ClipboardCheck,
  MinusCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MaterielForm } from "../_components/materiel-form";
import { DeleteMaterielButton } from "../_components/delete-materiel-button";
import { DocumentsSection } from "../../_documents/documents-section";

export default async function EditMaterielPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ updated?: string; error?: string; docError?: string }>;
}) {
  const { locale, id } = await params;
  const { updated, error, docError } = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Charge le matériel — RLS auto
  const { data: materiel } = await supabase
    .from("materiel_roulant")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!materiel) {
    notFound();
  }

  // 2. Profil → droits
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user!.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  const canDelete = isSuperAdmin || profile?.role === "MANAGER";

  // Pannes pour ce matériel (compte par statut, 3 dernières)
  const { count: pannesOuvertes } = await supabase
    .from("pannes")
    .select("*", { count: "exact", head: true })
    .eq("materiel_roulant_id", materiel.id)
    .in("statut", ["DECLAREE", "EN_REPARATION"]);
  const { data: pannesRecentes } = await supabase
    .from("pannes")
    .select("id, date_declaration, description, statut")
    .eq("materiel_roulant_id", materiel.id)
    .order("date_declaration", { ascending: false })
    .limit(3);

  // Check-lists de départ liées à ce matériel (5 dernières + compteur)
  const [{ count: checklistsTotal }, { data: checklistsRecentes }] = await Promise.all([
    supabase
      .from("checklists_depart")
      .select("*", { count: "exact", head: true })
      .eq("materiel_roulant_id", materiel.id),
    supabase
      .from("checklists_depart")
      .select("id, date_depart, statut_global, heure_validation, remarque")
      .eq("materiel_roulant_id", materiel.id)
      .order("date_depart", { ascending: false })
      .limit(5),
  ]);

  // 3. Nom du tenant pour l'affichage en sous-titre
  let tenantName: string | null = null;
  if (materiel.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("nom_entreprise")
      .eq("id", materiel.tenant_id)
      .maybeSingle();
    tenantName = tenant?.nom_entreprise ?? null;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + titre */}
      <div className="space-y-1">
        <Link
          href="/flotte"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Retour à la flotte
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="font-mono">{materiel.immatriculation}</span>
          {materiel.marque || materiel.modele ? (
            <span className="ml-2 text-base font-normal text-muted-foreground">
              — {materiel.marque ?? ""} {materiel.modele ?? ""}
            </span>
          ) : null}
        </h1>
        <p className="text-sm text-muted-foreground">
          {tenantName ? <>Entreprise : <strong>{tenantName}</strong> · </> : null}
          Édite les informations du véhicule. Les modifications de dates documents
          mettent à jour les alertes du dashboard.
        </p>
      </div>

      {/* Flash de confirmation après update */}
      {updated && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Modifications enregistrées</AlertTitle>
          <AlertDescription>
            Le véhicule <strong className="font-mono">{updated}</strong> a été mis à jour.
          </AlertDescription>
        </Alert>
      )}

      {/* Erreur de suppression remontée par l'URL */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Formulaire */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations véhicule</CardTitle>
          <CardDescription>
            Le tenant est verrouillé en édition. Pour réaffecter le véhicule,
            supprime-le et recrée-le sous l'autre entreprise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MaterielForm
            mode="update"
            materielId={materiel.id}
            isSuperAdmin={isSuperAdmin}
            tenants={[]}
            defaultTenantId={materiel.tenant_id}
            defaultValues={materiel}
          />
        </CardContent>
      </Card>

      {/* Section Documents */}
      {materiel.tenant_id && (
        <DocumentsSection
          ownerType="MATERIEL"
          ownerId={materiel.id}
          tenantId={materiel.tenant_id}
          redirectPath={`/flotte/${materiel.id}`}
          errorMessage={docError}
        />
      )}

      {/* Section Pannes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-4 text-primary" />
            Pannes & réparations
            {pannesOuvertes! > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                {pannesOuvertes} ouverte{pannesOuvertes! > 1 ? "s" : ""}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Quand une panne est ouverte, le matériel est automatiquement marqué
            « En panne » et retiré des listes d&apos;affectation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pannesRecentes && pannesRecentes.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {pannesRecentes.map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-3 text-sm">
                  <span className="flex-1 truncate">{p.description}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.date_declaration ? new Date(p.date_declaration).toLocaleDateString("fr-FR") : ""}
                  </span>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/pannes/${p.id}`}>Voir</Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune panne enregistrée pour ce matériel.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/pannes/new?materiel=${materiel.id}`}>
                <Wrench className="mr-2 size-4" />
                Déclarer une panne
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pannes">Voir toutes les pannes</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section Check-lists de départ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="size-4 text-primary" />
            Check-lists de départ
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {checklistsTotal ?? 0}
            </span>
          </CardTitle>
          <CardDescription>
            Historique des inspections avant départ effectuées sur ce matériel (cahier v7 §7.3).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checklistsRecentes && checklistsRecentes.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {checklistsRecentes.map((c) => {
                const isFaite = c.statut_global === "FAITE";
                const Icon = isFaite ? CheckCircle2 : AlertTriangle;
                const heure = new Date(c.heure_validation).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                return (
                  <li key={c.id} className="flex items-center gap-3 p-3 text-sm">
                    <Icon className={isFaite ? "size-4 text-emerald-600" : "size-4 text-amber-600"} />
                    <span className="font-medium">{new Date(c.date_depart + "T12:00:00").toLocaleDateString("fr-FR")}</span>
                    <span className="text-xs text-muted-foreground">{heure}</span>
                    {c.remarque && <span className="ml-2 flex-1 truncate text-xs italic text-muted-foreground">— {c.remarque}</span>}
                    <Button asChild variant="ghost" size="sm" className="ml-auto">
                      <Link href={`/checklists/${c.id}`}>Voir</Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MinusCircle className="size-4" />
              Aucune check-list enregistrée pour ce matériel.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Zone de danger */}
      {canDelete && (
        <Card className="border-rose-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-rose-700">
              <ShieldAlert className="size-4" />
              Zone de danger
            </CardTitle>
            <CardDescription>
              La suppression est définitive. Les affectations passées et les
              documents associés à ce véhicule perdront leur référence
              (champ owner_id orphelin dans documents).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteMaterielButton
              materielId={materiel.id}
              materielLabel={`${materiel.immatriculation} — ${materiel.marque ?? ""} ${materiel.modele ?? ""}`.trim()}
            />
          </CardContent>
        </Card>
      )}

      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/flotte">
            <ArrowLeft className="mr-2 size-4" />
            Revenir à la flotte
          </Link>
        </Button>
      </div>
    </div>
  );
}
