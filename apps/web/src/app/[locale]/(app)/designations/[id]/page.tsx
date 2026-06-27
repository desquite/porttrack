import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  ArrowLeft, Megaphone, CheckCircle2, XCircle, Send, Truck, User, MessageSquare,
  MessageSquareWarning, MessageSquareOff, ClipboardCheck, AlertTriangle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateFR } from "@/lib/utils/dates";
import { ROULEMENT_POSTE_HORAIRES, ROULEMENT_POSTE_LABEL, type Database } from "@porttrack/shared";
import { DeleteDesignationButton } from "../_components/delete-designation-button";
import { resendWhatsappAction } from "../actions";

type WhatsappStatut = Database["public"]["Enums"]["designation_whatsapp_statut"];
type DesignationPoste = Database["public"]["Enums"]["designation_poste"];

const WA_LABEL: Record<WhatsappStatut, string> = {
  PENDING: "En attente", SENT: "Envoyé", FAILED: "Échec", SKIPPED: "Non envoyé",
};
const WA_VARIANT: Record<WhatsappStatut, "secondary" | "success" | "danger" | "warning"> = {
  PENDING: "warning", SENT: "success", FAILED: "danger", SKIPPED: "secondary",
};
const WA_ICON: Record<WhatsappStatut, typeof MessageSquare> = {
  PENDING: MessageSquare, SENT: MessageSquare, FAILED: MessageSquareWarning, SKIPPED: MessageSquareOff,
};

export default async function DesignationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ created?: string; resent?: string; error?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: d } = await supabase
    .from("designations")
    .select(`
      *,
      chauffeur:chauffeurs ( id, nom, prenoms, telephone ),
      materiel:materiel_roulant ( id, immatriculation, chrono, marque, modele ),
      equipe:equipes ( id, nom, code, couleur )
    `)
    .eq("id", id)
    .maybeSingle();
  if (!d) notFound();

  // Check-list associée éventuelle (UNIQUE designation_id ⇒ au plus 1)
  const { data: checklist } = await supabase
    .from("checklists_depart")
    .select("id, statut_global, heure_validation")
    .eq("designation_id", d.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ch = (d as any).chauffeur as { id: string; nom: string; prenoms: string; telephone: string | null } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mr = (d as any).materiel as { id: string; immatriculation: string; chrono: string | null; marque: string | null; modele: string | null } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eq = (d as any).equipe as { id: string; nom: string; code: string; couleur: string | null } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poste = ((d as any).poste as DesignationPoste) ?? "JOUR";
  const wa = d.whatsapp_statut as WhatsappStatut;
  const WaIcon = WA_ICON[wa];

  const mrLabel = mr
    ? mr.chrono
      ? `${mr.chrono} (${mr.immatriculation})`
      : mr.immatriculation
    : "—";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/designations?date=${d.date_designation}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour aux désignations
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Megaphone className="size-6 text-primary" />Désignation
          </h1>
          <Badge variant={WA_VARIANT[wa]} className="gap-1 text-xs">
            <WaIcon className="size-3.5" />
            WhatsApp {WA_LABEL[wa]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{formatDateFR(d.date_designation)}</p>
      </div>

      {sp.created && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Désignation créée</AlertTitle></Alert>}
      {sp.resent && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>WhatsApp renvoyé</AlertTitle></Alert>}
      {sp.error && <Alert variant="destructive"><XCircle className="size-4" /><AlertTitle>Erreur</AlertTitle><AlertDescription>{sp.error}</AlertDescription></Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Chauffeur */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <User className="size-4 text-primary" />Chauffeur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {ch ? (
              <>
                <div className="font-medium">{ch.nom} {ch.prenoms}</div>
                {ch.telephone && <div className="text-xs text-muted-foreground">📞 {ch.telephone}</div>}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/chauffeurs/${ch.id}`}>Fiche chauffeur</Link>
                </Button>
              </>
            ) : <p className="text-muted-foreground">—</p>}
          </CardContent>
        </Card>

        {/* Matériel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Truck className="size-4 text-primary" />Matériel roulant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {mr ? (
              <>
                <div className="font-medium">{mrLabel}</div>
                {(mr.marque || mr.modele) && (
                  <div className="text-xs text-muted-foreground">{mr.marque ?? ""} {mr.modele ?? ""}</div>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/flotte/${mr.id}`}>Fiche matériel</Link>
                </Button>
              </>
            ) : <p className="text-muted-foreground">—</p>}
          </CardContent>
        </Card>
      </div>

      {/* Équipe */}
      {eq && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex size-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: eq.couleur ?? "#3b82f6" }}>
                {eq.code}
              </span>
              Équipe : {eq.nom}
            </CardTitle>
            <CardDescription className="text-xs">
              Poste : {ROULEMENT_POSTE_LABEL[poste]}{ROULEMENT_POSTE_HORAIRES[poste] ? ` (${ROULEMENT_POSTE_HORAIRES[poste]})` : ""}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Check-list de départ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardCheck className="size-4 text-primary" />
            Check-list de départ
            {checklist && (
              <Badge variant={checklist.statut_global === "FAITE" ? "success" : "warning"} className="gap-1 text-[10px]">
                {checklist.statut_global === "FAITE"
                  ? <CheckCircle2 className="size-3" />
                  : <AlertTriangle className="size-3" />}
                {checklist.statut_global === "FAITE" ? "Faite" : "Remarque"}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            {checklist
              ? <>Validée à {new Date(checklist.heure_validation).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</>
              : <>Aucune check-list n&apos;a encore été saisie pour cette désignation.</>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checklist ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/checklists/${checklist.id}`}>Ouvrir la check-list</Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href={`/checklists/new?designation=${d.id}`}>
                <ClipboardCheck className="mr-2 size-4" />
                Saisir la check-list
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Statut WhatsApp + renvoyer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Notification WhatsApp</CardTitle>
          <CardDescription className="text-xs">
            Statut : <strong>{WA_LABEL[wa]}</strong>{" "}
            {d.whatsapp_sent_at && <>· envoyé le {new Date(d.whatsapp_sent_at).toLocaleString("fr-FR")}</>}
            {" "}· tentatives : {d.whatsapp_attempts}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {wa === "FAILED" && d.whatsapp_error && (
            <p className="text-sm text-rose-700">Erreur : {d.whatsapp_error}</p>
          )}
          {wa === "SKIPPED" && (
            <p className="text-xs text-muted-foreground">
              Le provider WhatsApp n&apos;est pas configuré (variables d&apos;environnement manquantes)
              ou le chauffeur n&apos;a pas de téléphone renseigné.
            </p>
          )}
          <form action={resendWhatsappAction.bind(null, d.id)}>
            <Button type="submit" size="sm">
              <Send className="mr-2 size-4" />
              {wa === "SENT" ? "Renvoyer" : "Envoyer le WhatsApp"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {d.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{d.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <DeleteDesignationButton designationId={d.id} label="Supprimer cette désignation" />
      </div>
    </div>
  );
}
