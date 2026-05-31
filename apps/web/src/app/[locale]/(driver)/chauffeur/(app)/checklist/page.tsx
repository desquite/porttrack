import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, ClipboardCheck, CheckCircle2, AlertTriangle, Truck, Camera } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadDriverContext, truckLabel } from "../_components/load-driver";
import { DriverChecklistForm, type ChecklistItem } from "./_components/driver-checklist-form";

export default async function DriverChecklistPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ designation?: string; id?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const { chauffeur, designation } = await loadDriverContext();
  if (!chauffeur) return null;

  const supabase = await createClient();

  // ----- Cas 1 : check-list déjà faite (lecture seule) -----
  if (sp.id) {
    const { data: cl } = await supabase
      .from("checklists_depart")
      .select("id, statut_global, heure_validation, remarque, materiel:materiel_roulant ( chrono, immatriculation )")
      .eq("id", sp.id)
      .maybeSingle();
    if (!cl) notFound();

    const [{ data: responses }, { count: photoCount }] = await Promise.all([
      supabase
        .from("checklist_responses")
        .select("etat, item:checklist_items_config ( label, ordre )")
        .eq("checklist_id", cl.id),
      supabase.from("checklist_photos").select("*", { count: "exact", head: true }).eq("checklist_id", cl.id),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (responses ?? []) as any[];
    rows.sort((a, b) => (a.item?.ordre ?? 0) - (b.item?.ordre ?? 0));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mr = (cl as any).materiel;
    const mrLabel = mr ? (mr.chrono ?? mr.immatriculation) : null;
    const heure = new Date(cl.heure_validation).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const faite = cl.statut_global === "FAITE";

    return (
      <div className="space-y-5">
        <Header mrLabel={mrLabel} />
        <Card className={faite ? "border-emerald-300 bg-emerald-50/50" : "border-amber-300 bg-amber-50/50"}>
          <CardContent className="flex items-center gap-3 p-4">
            {faite ? <CheckCircle2 className="size-6 text-emerald-600" /> : <AlertTriangle className="size-6 text-amber-600" />}
            <div>
              <div className="font-semibold">{faite ? "Check-list faite" : "Check-list avec remarque"}</div>
              <div className="text-xs text-muted-foreground">Validée à {heure}</div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {rows.map((r, i) => {
            const ok = r.etat === "OK";
            return (
              <div key={i} className="flex items-center gap-3 rounded-md border bg-background px-3 py-2.5 text-sm">
                {ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-amber-600" />}
                <span className="flex-1">{r.item?.label ?? "—"}</span>
                <Badge variant={ok ? "success" : "warning"} className="text-[10px]">{ok ? "OK" : "Anomalie"}</Badge>
              </div>
            );
          })}
        </div>

        {cl.remarque && (
          <div className="rounded-md border bg-background p-3 text-sm">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Remarque</div>
            <p className="whitespace-pre-wrap">{cl.remarque}</p>
          </div>
        )}
        {!!photoCount && photoCount > 0 && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Camera className="size-4" />{photoCount} photo(s) jointe(s)</p>
        )}

        <Link href="/chauffeur" className="block text-center text-sm text-primary">← Retour à ma journée</Link>
      </div>
    );
  }

  // ----- Cas 2 : nouvelle check-list pour une désignation -----
  const designationId = sp.designation;
  if (!designationId) redirect("/chauffeur");

  const { data: des } = await supabase
    .from("designations")
    .select("id, chauffeur_id, materiel:materiel_roulant ( chrono, immatriculation )")
    .eq("id", designationId)
    .maybeSingle();
  if (!des || des.chauffeur_id !== chauffeur.id) notFound();

  // Déjà faite ? → bascule en lecture seule
  const { data: existing } = await supabase
    .from("checklists_depart")
    .select("id")
    .eq("designation_id", designationId)
    .maybeSingle();
  if (existing) redirect(`/chauffeur/checklist?id=${existing.id}`);

  // Items actifs du tenant
  const { data: itemsConfig } = await supabase
    .from("checklist_items_config")
    .select("id, label, ordre")
    .eq("tenant_id", chauffeur.tenant_id)
    .eq("actif", true)
    .order("ordre", { ascending: true })
    .order("label", { ascending: true });

  const items: ChecklistItem[] = (itemsConfig ?? []).map((it) => ({ id: it.id, label: it.label }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mr = (des as any).materiel;
  const mrLabel = mr ? (mr.chrono ?? mr.immatriculation) : truckLabel(designation);

  return (
    <div className="space-y-5">
      <Header mrLabel={mrLabel} />
      <p className="text-sm text-muted-foreground">
        Vérifie chaque point avant de partir. Coche <strong>OK</strong> ou <strong>Anomalie</strong> pour chacun.
      </p>
      {items.length === 0 ? (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Aucun item de check-list configuré pour ton entreprise.</CardContent></Card>
      ) : (
        <DriverChecklistForm designationId={designationId} items={items} />
      )}
    </div>
  );
}

function Header({ mrLabel }: { mrLabel: string | null }) {
  return (
    <div className="space-y-1">
      <Link href="/chauffeur" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" />Ma journée
      </Link>
      <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <ClipboardCheck className="size-5 text-primary" />Check-list de départ
      </h1>
      {mrLabel && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Truck className="size-4" />{mrLabel}
        </p>
      )}
    </div>
  );
}
