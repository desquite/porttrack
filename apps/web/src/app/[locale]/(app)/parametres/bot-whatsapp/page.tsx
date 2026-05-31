import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  MessageSquare, CheckCircle2, XCircle, ArrowLeft, Eye, EyeOff, Phone,
  ShieldCheck, AlertTriangle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AddNumeroForm } from "./_components/add-numero-form";
import { DeleteNumeroButton } from "./_components/delete-numero-button";
import { toggleBotNumeroActifAction } from "./actions";

const COMMANDES = [
  { code: "CG", label: "Carte grise" },
  { code: "AS", label: "Assurance" },
  { code: "VT", label: "Visite technique" },
  { code: "CT", label: "Carte de transport" },
  { code: "CS", label: "Carte de stationnement" },
  { code: "PT", label: "Patente" },
  { code: "DOCS", label: "Tous les documents" },
];

const STATUT_LABEL: Record<string, string> = {
  REPONDU: "Répondu",
  NON_AUTORISE: "Non autorisé",
  COMMANDE_INVALIDE: "Commande invalide",
  MATERIEL_INTROUVABLE: "Matériel introuvable",
  DOC_INTROUVABLE: "Document absent",
};
const STATUT_VARIANT: Record<string, "success" | "secondary" | "warning" | "danger"> = {
  REPONDU: "success",
  NON_AUTORISE: "danger",
  COMMANDE_INVALIDE: "warning",
  MATERIEL_INTROUVABLE: "warning",
  DOC_INTROUVABLE: "warning",
};

export default async function BotWhatsappPage({
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

  const [{ data: numeros }, { data: consultations }] = await Promise.all([
    supabase
      .from("bot_whatsapp_numeros")
      .select("id, numero, label, actif, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("bot_consultations")
      .select("id, numero_demandeur, commande_brute, statut, details, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  // État de la configuration (env) — visible côté serveur
  const wasenderOk = !!process.env.WASENDER_API_KEY && !!process.env.WASENDER_SESSION_ID;
  const verifyOk = !!process.env.WHATSAPP_VERIFY_TOKEN;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/parametres" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour aux paramètres
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageSquare className="size-6 text-primary" />
          Bot WhatsApp — consultation documents
        </h1>
        <p className="text-sm text-muted-foreground">
          Le bot renvoie la photo d&apos;un document matériel sur simple commande WhatsApp (cahier §7.5).
        </p>
      </div>

      {sp.created && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Numéro ajouté</AlertTitle></Alert>}
      {sp.updated && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Mis à jour</AlertTitle></Alert>}
      {sp.deleted && <Alert className="border-rose-200 bg-rose-50/60 text-rose-900"><CheckCircle2 className="size-4" /><AlertTitle>Numéro retiré</AlertTitle></Alert>}
      {sp.error && <Alert variant="destructive"><XCircle className="size-4" /><AlertTitle>Erreur</AlertTitle><AlertDescription>{sp.error}</AlertDescription></Alert>}

      {/* État de la configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">État de la configuration</CardTitle>
          <CardDescription>Le bot répond uniquement si l&apos;intégration WhatsApp est configurée côté serveur.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ConfigLine ok={wasenderOk} label="Envoi WhatsApp (WASENDER_API_KEY + WASENDER_SESSION_ID)" />
          <ConfigLine ok={verifyOk} label="Vérification webhook (WHATSAPP_VERIFY_TOKEN)" />
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            URL du webhook à déclarer chez le fournisseur WhatsApp :
            <code className="ml-1 rounded bg-background px-1.5 py-0.5">/api/whatsapp/webhook</code>
          </div>
        </CardContent>
      </Card>

      {/* Référence des commandes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commandes disponibles</CardTitle>
          <CardDescription>Format : <code className="rounded bg-muted px-1 py-0.5">CODE IMMATRICULATION</code> — ex. <code className="rounded bg-muted px-1 py-0.5">CG AA-1234-CI</code></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {COMMANDES.map((c) => (
              <span key={c.code} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                <code className="font-semibold text-primary">{c.code}</code>
                <span className="text-muted-foreground">{c.label}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Numéros autorisés */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" />
            Numéros autorisés
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{numeros?.length ?? 0}</span>
          </CardTitle>
          <CardDescription>
            Seuls ces numéros peuvent interroger le bot. Un numéro inconnu ne reçoit aucune réponse (cahier §7.5).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit && tenantId && <AddNumeroForm tenantId={tenantId} />}

          {!numeros || numeros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun numéro autorisé pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {numeros.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <Phone className="size-4 text-muted-foreground" />
                  <span className="font-mono font-medium">{n.numero}</span>
                  {n.label && <span className="text-xs text-muted-foreground">{n.label}</span>}
                  {!n.actif && <Badge variant="secondary" className="text-[10px]">Désactivé</Badge>}
                  {canEdit && (
                    <div className="ml-auto flex items-center gap-1">
                      <form action={toggleBotNumeroActifAction.bind(null, n.id, !n.actif)}>
                        <Button type="submit" variant="ghost" size="sm" className="h-8 px-2" title={n.actif ? "Désactiver" : "Réactiver"}>
                          {n.actif ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </Button>
                      </form>
                      <DeleteNumeroButton id={n.id} numero={n.numero} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Journal des consultations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Journal des consultations</CardTitle>
          <CardDescription>30 dernières interrogations du bot (toutes, y compris non autorisées).</CardDescription>
        </CardHeader>
        <CardContent>
          {!consultations || consultations.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="size-4" />Aucune consultation enregistrée.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {consultations.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <Badge variant={STATUT_VARIANT[c.statut] ?? "secondary"} className="text-[10px]">
                    {STATUT_LABEL[c.statut] ?? c.statut}
                  </Badge>
                  <span className="font-mono text-xs">{c.numero_demandeur}</span>
                  <span className="text-xs text-muted-foreground">« {c.commande_brute} »</span>
                  {c.details && <span className="text-[11px] text-muted-foreground">— {c.details}</span>}
                  <span className="ml-auto text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString("fr-FR")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-rose-500" />}
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
      <Badge variant={ok ? "success" : "secondary"} className="ml-auto text-[10px]">{ok ? "Configuré" : "Manquant"}</Badge>
    </div>
  );
}
