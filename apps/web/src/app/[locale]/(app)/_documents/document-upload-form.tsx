"use client";

import { useActionState, useRef, useEffect, useMemo } from "react";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_TYPES,
  type DocumentOwnerType,
} from "@porttrack/shared";
import { formatExpiryLabel } from "@/lib/utils/dates";
import {
  uploadDocumentAction,
  type DocumentUploadState,
} from "./actions";

type ExistingDoc = {
  type_document: (typeof DOCUMENT_TYPES)[number];
  date_expiration: string | null;
};

type Props = {
  ownerType: DocumentOwnerType;
  ownerId: string;
  tenantId: string;
  redirectPath: string;
  /** Documents déjà uploadés — permet d'annoter le sélecteur */
  existingDocs?: ExistingDoc[];
};

// Libellés FR par type — séparés par catégorie pour groupage dans le select
const DOCUMENT_LABELS: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  CNI:                  "CNI (Carte Nationale d'Identité)",
  PERMIS_CONDUIRE:      "Permis de conduire",
  VISITE_MEDICALE:      "Visite médicale",
  ATTESTATION_CNPS:     "Attestation CNPS",
  CONTRAT_TRAVAIL:      "Contrat de travail",
  PHOTO_IDENTITE:       "Photo d'identité",
  CARTE_GRISE:          "Carte grise",
  ASSURANCE:            "Police d'assurance",
  VISITE_TECHNIQUE:     "Procès-verbal de visite technique",
  VIGNETTE:             "Vignette automobile",
  PATENTE_TRANSPORT:    "Patente de transport",
  AUTORISATION_DGTTC:   "Autorisation DGTTC",
  AUTRE:                "Autre",
};

// Sous-ensemble proposé par défaut selon le owner_type
const DOCS_BY_OWNER: Record<DocumentOwnerType, readonly (typeof DOCUMENT_TYPES)[number][]> = {
  CHAUFFEUR: [
    "CNI",
    "PERMIS_CONDUIRE",
    "VISITE_MEDICALE",
    "ATTESTATION_CNPS",
    "CONTRAT_TRAVAIL",
    "PHOTO_IDENTITE",
    "AUTRE",
  ],
  MATERIEL: [
    "CARTE_GRISE",
    "ASSURANCE",
    "VISITE_TECHNIQUE",
    "VIGNETTE",
    "PATENTE_TRANSPORT",
    "AUTORISATION_DGTTC",
    "AUTRE",
  ],
};

const initialState: DocumentUploadState = { status: "idle" };

export function DocumentUploadForm({
  ownerType,
  ownerId,
  tenantId,
  redirectPath,
  existingDocs = [],
}: Props) {
  // bind les params métier à l'action — le formulaire ne passe que les
  // champs métier (type, numéro, dates, fichier)
  const boundAction = uploadDocumentAction.bind(
    null,
    ownerType,
    ownerId,
    tenantId,
    redirectPath,
  );

  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset le form après un upload réussi (state revient à "idle")
  // On surveille les transitions error → idle pour reset.
  useEffect(() => {
    if (state.status === "idle" && !pending && formRef.current) {
      // On ne reset pas au tout premier rendu : on regarde si le ref a déjà
      // été monté avec un formData récent. Plus simple : on reset toujours
      // quand state est idle et qu'on n'est pas en pending (cas du success).
      formRef.current.reset();
    }
  }, [state, pending]);

  const getError = (name: string): string | null => {
    if (state.status !== "error") return null;
    return state.fieldErrors?.[name]?.[0] ?? null;
  };
  const fieldClass = (name: string) =>
    cn(getError(name) && "border-rose-500 focus-visible:ring-rose-500");

  const allowedDocs = DOCS_BY_OWNER[ownerType];

  // Calcule un résumé par type des docs déjà uploadés :
  //   - count : combien de docs de ce type sont présents
  //   - soonestExpiration : la date d'expiration la plus proche parmi eux
  //     (sert à afficher "expire dans Xj" dans le sélecteur)
  const existingSummary = useMemo(() => {
    const map: Partial<
      Record<(typeof DOCUMENT_TYPES)[number], { count: number; soonest: string | null }>
    > = {};
    for (const d of existingDocs) {
      const current = map[d.type_document] ?? { count: 0, soonest: null };
      current.count += 1;
      if (
        d.date_expiration &&
        (current.soonest === null || d.date_expiration < current.soonest)
      ) {
        current.soonest = d.date_expiration;
      }
      map[d.type_document] = current;
    }
    return map;
  }, [existingDocs]);

  // Split les types autorisés en 2 groupes pour l'affichage en optgroups
  const notYetUploaded = allowedDocs.filter((d) => !existingSummary[d]);
  const alreadyUploaded = allowedDocs.filter((d) => !!existingSummary[d]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.status === "error" && state.formError && (
        <Alert variant="destructive">
          <AlertTitle>Échec de l'upload</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Type document */}
        <div className="space-y-1.5">
          <Label htmlFor="type_document" className="text-xs">
            Type de document <span className="text-rose-600">*</span>
          </Label>
          <select
            id="type_document"
            name="type_document"
            required
            defaultValue=""
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              getError("type_document") && "border-rose-500",
            )}
          >
            <option value="">— Sélectionner —</option>

            {notYetUploaded.length > 0 && (
              <optgroup label="À ajouter">
                {notYetUploaded.map((d) => (
                  <option key={d} value={d}>
                    {DOCUMENT_LABELS[d]}
                  </option>
                ))}
              </optgroup>
            )}

            {alreadyUploaded.length > 0 && (
              <optgroup label="Déjà présent (cliquer pour renouveler)">
                {alreadyUploaded.map((d) => {
                  const info = existingSummary[d]!;
                  // Si on a une date d'expiration, on l'affiche ; sinon on
                  // tombe sur le nombre de docs déjà uploadés.
                  const suffix = info.soonest
                    ? formatExpiryLabel(info.soonest)
                    : `${info.count} doc${info.count > 1 ? "s" : ""} déjà uploadé${info.count > 1 ? "s" : ""}`;
                  return (
                    <option key={d} value={d}>
                      {DOCUMENT_LABELS[d]} · {suffix}
                    </option>
                  );
                })}
              </optgroup>
            )}
          </select>
          {getError("type_document") && (
            <p className="text-[11px] text-rose-600">{getError("type_document")}</p>
          )}
        </div>

        {/* Numéro */}
        <div className="space-y-1.5">
          <Label htmlFor="numero" className="text-xs">
            Numéro du document
          </Label>
          <Input
            id="numero"
            name="numero"
            placeholder="ex. ABJ-2018-002345"
            className={fieldClass("numero")}
          />
          {getError("numero") && (
            <p className="text-[11px] text-rose-600">{getError("numero")}</p>
          )}
        </div>

        {/* Date émission */}
        <div className="space-y-1.5">
          <Label htmlFor="date_emission" className="text-xs">
            Date d'émission
          </Label>
          <Input
            id="date_emission"
            name="date_emission"
            type="date"
            className={fieldClass("date_emission")}
          />
          {getError("date_emission") && (
            <p className="text-[11px] text-rose-600">{getError("date_emission")}</p>
          )}
        </div>

        {/* Date expiration */}
        <div className="space-y-1.5">
          <Label htmlFor="date_expiration" className="text-xs">
            Date d'expiration
          </Label>
          <Input
            id="date_expiration"
            name="date_expiration"
            type="date"
            className={fieldClass("date_expiration")}
          />
          {getError("date_expiration") && (
            <p className="text-[11px] text-rose-600">{getError("date_expiration")}</p>
          )}
        </div>

        {/* Fichier */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="file" className="text-xs">
            Fichier <span className="text-rose-600">*</span>{" "}
            <span className="text-muted-foreground">(PDF, JPG, PNG, WEBP — max 10 MB)</span>
          </Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            required
            className={cn(
              "file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary-foreground",
              "hover:file:bg-primary/90 cursor-pointer",
              fieldClass("file"),
            )}
          />
          {getError("file") && (
            <p className="text-[11px] text-rose-600">{getError("file")}</p>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="notes" className="text-xs">
            Notes
          </Label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            placeholder="Informations complémentaires sur ce document…"
            className={cn(
              "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              fieldClass("notes"),
            )}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Upload en cours…
            </>
          ) : (
            <>
              <Upload className="mr-2 size-4" />
              Uploader le document
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
