import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  ClipboardCheck, CheckCircle2, XCircle, Plus, ArrowLeft, Eye, EyeOff, Pencil,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toggleChecklistItemActifAction } from "./actions";
import { DeleteChecklistItemButton } from "./_components/delete-checklist-item-button";

export default async function ChecklistItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ created?: string; updated?: string; deleted?: string; error?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user!.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  const canEdit = isSuperAdmin || profile?.role === "MANAGER";
  const tenantId = profile?.tenant_id ?? null;

  if (!tenantId && !isSuperAdmin) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Aucune entreprise rattachée</AlertTitle>
        <AlertDescription>Ton compte n&apos;est rattaché à aucune entreprise.</AlertDescription>
      </Alert>
    );
  }

  // SUPER_ADMIN sans filtre → on prend son tenant cible via search params plus tard ;
  // pour cette première version on liste tous les items du tenant courant.
  // (Côté SUPER_ADMIN, ils verront les items de tous les tenants confondus via RLS.)
  let query = supabase
    .from("checklist_items_config")
    .select("id, tenant_id, code, label, ordre, actif, created_at")
    .order("ordre", { ascending: true })
    .order("label", { ascending: true });
  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data: items } = await query;

  // Compteur d'utilisation par item (combien de check-lists référencent chaque item)
  const usageMap = new Map<string, number>();
  if (items && items.length > 0) {
    const { data: usage } = await supabase
      .from("checklist_responses")
      .select("item_config_id")
      .in("item_config_id", items.map((i) => i.id));
    for (const u of usage ?? []) {
      usageMap.set(u.item_config_id, (usageMap.get(u.item_config_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/parametres" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour aux paramètres
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <ClipboardCheck className="size-6 text-primary" />
              Items de check-list
            </h1>
            <p className="text-sm text-muted-foreground">
              Liste des items affichés aux chauffeurs et dispatchers lors de la saisie de la check-list de départ (cahier §7.3).
              Personnalise-les selon les besoins de ton entreprise.
            </p>
          </div>
          {canEdit && (
            <Button asChild>
              <Link href="/parametres/checklist-items/new"><Plus className="mr-2 size-4" />Ajouter un item</Link>
            </Button>
          )}
        </div>
      </div>

      {sp.created && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Item créé</AlertTitle></Alert>}
      {sp.updated && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Item mis à jour</AlertTitle></Alert>}
      {sp.deleted && <Alert className="border-rose-200 bg-rose-50/60 text-rose-900"><CheckCircle2 className="size-4" /><AlertTitle>Item supprimé</AlertTitle></Alert>}
      {sp.error && <Alert variant="destructive"><XCircle className="size-4" /><AlertTitle>Erreur</AlertTitle><AlertDescription>{sp.error}</AlertDescription></Alert>}

      {!items || items.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <ClipboardCheck className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Aucun item configuré</CardTitle>
            <CardDescription>
              {canEdit ? "Ajoute un premier item pour permettre la saisie des check-lists." : "Aucun item — demande à un manager d'en ajouter."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {items.map((it) => {
                const usage = usageMap.get(it.id) ?? 0;
                return (
                  <li key={it.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="w-10 shrink-0 text-center font-mono text-xs text-muted-foreground">{it.ordre}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{it.label}</span>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{it.code}</code>
                        {!it.actif && <Badge variant="secondary" className="text-[10px]">Désactivé</Badge>}
                        {usage > 0 && (
                          <span className="text-[11px] text-muted-foreground">— utilisé sur {usage} check-list{usage > 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-1">
                        <form action={toggleChecklistItemActifAction.bind(null, it.id, !it.actif)}>
                          <Button type="submit" variant="ghost" size="sm" className="h-8 px-2" title={it.actif ? "Désactiver" : "Réactiver"}>
                            {it.actif ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          </Button>
                        </form>
                        <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                          <Link href={`/parametres/checklist-items/${it.id}`} title="Éditer">
                            <Pencil className="size-3.5" />
                          </Link>
                        </Button>
                        <DeleteChecklistItemButton itemId={it.id} label={it.label} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
