import {
  FileText,
  FileImage,
  Paperclip,
  AlertTriangle,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  classifyExpiry,
  EXPIRY_BADGE_VARIANT,
  formatDateFR,
  formatExpiryLabel,
} from "@/lib/utils/dates";
import type { Database, DocumentOwnerType } from "@porttrack/shared";
import { DocumentUploadForm } from "./document-upload-form";
import {
  DocumentDeleteButton,
  DocumentDownloadButton,
} from "./document-actions-buttons";

type Document = Database["public"]["Tables"]["documents"]["Row"];
type DocType = Database["public"]["Enums"]["document_type"];

const DOC_LABEL: Record<DocType, string> = {
  CNI:                "CNI",
  PERMIS_CONDUIRE:    "Permis de conduire",
  VISITE_MEDICALE:    "Visite médicale",
  ATTESTATION_CNPS:   "Attestation CNPS",
  CONTRAT_TRAVAIL:    "Contrat de travail",
  PHOTO_IDENTITE:     "Photo d'identité",
  CARTE_GRISE:        "Carte grise",
  ASSURANCE:          "Assurance",
  VISITE_TECHNIQUE:   "Visite technique",
  VIGNETTE:           "Vignette",
  PATENTE_TRANSPORT:  "Patente transport",
  AUTORISATION_DGTTC: "Autorisation DGTTC",
  AUTRE:              "Autre",
};

type Props = {
  ownerType: DocumentOwnerType;
  ownerId: string;
  tenantId: string;
  /** Chemin de la page courante pour le revalidate post-action */
  redirectPath: string;
  /** Erreur remontée par les actions delete via ?docError= */
  errorMessage?: string;
};

export async function DocumentsSection({
  ownerType,
  ownerId,
  tenantId,
  redirectPath,
  errorMessage,
}: Props) {
  const supabase = await createClient();

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  const docs = documents ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="size-4 text-primary" />
          Documents ({docs.length})
        </CardTitle>
        <CardDescription>
          Scans PDF, photos d'identité ou attestations. Les fichiers sont stockés
          de façon privée et accessibles uniquement aux utilisateurs de cette entreprise.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Erreur remontée par les actions delete/download via l'URL */}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Liste des documents */}
        {docs.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Aucun document uploadé pour le moment. Utilise le formulaire ci-dessous
            pour ajouter le premier scan.
          </div>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <DocumentRow key={d.id} doc={d} redirectPath={redirectPath} />
            ))}
          </ul>
        )}

        {/* Form d'upload */}
        <div className="border-t pt-6">
          <h4 className="mb-3 text-sm font-semibold tracking-tight">
            Ajouter un document
          </h4>
          <DocumentUploadForm
            ownerType={ownerType}
            ownerId={ownerId}
            tenantId={tenantId}
            redirectPath={redirectPath}
            existingDocs={docs.map((d) => ({
              type_document: d.type_document,
              date_expiration: d.date_expiration,
            }))}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------------

function DocumentRow({
  doc,
  redirectPath,
}: {
  doc: Document;
  redirectPath: string;
}) {
  const isImage = doc.fichier_url
    ? /\.(jpe?g|png|webp)$/i.test(doc.fichier_url)
    : false;
  const Icon = isImage ? FileImage : FileText;

  const expStatus = classifyExpiry(doc.date_expiration);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border bg-background p-3">
      <Icon className="size-5 shrink-0 text-primary" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm">
            {DOC_LABEL[doc.type_document]}
          </span>
          {doc.numero && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {doc.numero}
            </Badge>
          )}
          {doc.date_expiration && (
            <Badge variant={EXPIRY_BADGE_VARIANT[expStatus]} className="text-[10px]">
              {formatExpiryLabel(doc.date_expiration)}
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="truncate max-w-[280px]">{doc.fichier_nom ?? "Sans nom"}</span>
          {doc.fichier_taille != null && (
            <span>{formatBytes(doc.fichier_taille)}</span>
          )}
          {doc.date_emission && (
            <span>Émis : {formatDateFR(doc.date_emission)}</span>
          )}
          {doc.date_expiration && (
            <span>Expire : {formatDateFR(doc.date_expiration)}</span>
          )}
        </div>
        {doc.notes && (
          <p className="mt-1 text-xs text-muted-foreground italic">{doc.notes}</p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <DocumentDownloadButton documentId={doc.id} />
        <DocumentDeleteButton
          documentId={doc.id}
          fileName={doc.fichier_nom ?? "ce document"}
          redirectPath={redirectPath}
        />
      </div>
    </li>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
