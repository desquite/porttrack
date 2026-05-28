"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Loader2,
  UploadCloud,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ACONIERS,
  FLUX_FIELDS,
  type Aconier,
  type FluxFieldKey,
  type FluxMapping,
  type FluxImportReport,
} from "@porttrack/shared";
import {
  analyzeFluxAction,
  importFluxAction,
  type AnalyzeFluxResult,
} from "../actions";

type Props = {
  isSuperAdmin: boolean;
  tenants: { id: string; nom_entreprise: string }[];
  defaultTenantId: string | null;
};

type Step = "upload" | "mapping" | "report";

type Analysis = Extract<AnalyzeFluxResult, { ok: true }>;

const ACONIER_LABEL: Record<Aconier, string> = {
  MEDLOG: "MEDLOG",
  AGL: "AGL",
  MAERSK: "MAERSK",
  AUTRE: "Autre / inconnu",
};

export function FluxImporter({ isSuperAdmin, tenants, defaultTenantId }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [tenantId, setTenantId] = useState<string>(
    defaultTenantId ?? tenants[0]?.id ?? "",
  );
  const [aconier, setAconier] = useState<Aconier>("MEDLOG");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mapping, setMapping] = useState<FluxMapping | null>(null);
  const [report, setReport] = useState<FluxImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenantMissing = isSuperAdmin && !tenantId;

  // --- Étape 1 : analyse ---
  async function handleAnalyze() {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await analyzeFluxAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAnalysis(result);
      setMapping(result.mapping);
      setAconier(result.aconier);
      setStep("mapping");
    } catch (e) {
      console.error(e);
      setError("Erreur inattendue pendant l'analyse du fichier.");
    } finally {
      setBusy(false);
    }
  }

  // --- Étape 2 : import ---
  async function handleImport() {
    if (!file || !mapping) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append(
        "meta",
        JSON.stringify({ tenantId, aconier, nomFichier: file.name, mapping }),
      );
      const result = await importFluxAction(fd);
      setReport(result);
      setStep("report");
    } catch (e) {
      console.error(e);
      setError("Erreur inattendue pendant l'import.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setAnalysis(null);
    setMapping(null);
    setReport(null);
    setError(null);
    setAconier("MEDLOG");
  }

  return (
    <div className="space-y-6">
      <Stepper step={step} />

      {error && (
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertTitle>Échec</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === "upload" && (
        <div className="space-y-4">
          {isSuperAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="tenant">Entreprise cible</Label>
              <select
                id="tenant"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">— Choisir une entreprise —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom_entreprise}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="file">Fichier du flux</Label>
            <label
              htmlFor="file"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-muted/50"
            >
              <UploadCloud className="size-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                {file ? file.name : "Clique pour choisir un fichier"}
              </span>
              <span className="text-xs text-muted-foreground">
                .xlsx, .xls ou .csv — 10 Mo maximum
              </span>
              <input
                id="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
            </label>
          </div>

          <Button onClick={handleAnalyze} disabled={!file || tenantMissing || busy}>
            {busy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Analyse en cours…
              </>
            ) : (
              <>
                Analyser le fichier
                <ArrowRight className="ml-2 size-4" />
              </>
            )}
          </Button>
          {tenantMissing && (
            <p className="text-xs text-rose-600">Sélectionne d&apos;abord une entreprise cible.</p>
          )}
        </div>
      )}

      {step === "mapping" && analysis && mapping && (
        <MappingStep
          analysis={analysis}
          mapping={mapping}
          setMapping={setMapping}
          aconier={aconier}
          setAconier={setAconier}
          busy={busy}
          onBack={() => setStep("upload")}
          onImport={handleImport}
        />
      )}

      {step === "report" && report && (
        <ReportStep report={report} onReset={reset} />
      )}
    </div>
  );
}

// =============================================================================
// Indicateur d'étapes
// =============================================================================

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Fichier" },
    { key: "mapping", label: "Mapping & aperçu" },
    { key: "report", label: "Rapport" },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={
                "flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold " +
                (active
                  ? "border-primary bg-primary text-primary-foreground"
                  : done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-input bg-background text-muted-foreground")
              }
            >
              {done ? <CheckCircle2 className="size-3.5" /> : i + 1}
            </span>
            <span className={active ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            {i < steps.length - 1 && <span className="text-muted-foreground">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

// =============================================================================
// Étape mapping + aperçu
// =============================================================================

function MappingStep({
  analysis,
  mapping,
  setMapping,
  aconier,
  setAconier,
  busy,
  onBack,
  onImport,
}: {
  analysis: Analysis;
  mapping: FluxMapping;
  setMapping: (m: FluxMapping) => void;
  aconier: Aconier;
  setAconier: (a: Aconier) => void;
  busy: boolean;
  onBack: () => void;
  onImport: () => void;
}) {
  const numeroMapped = !!mapping.numero;
  const mappedFields = FLUX_FIELDS.filter((f) => mapping[f.key]);

  function setField(key: FluxFieldKey, header: string) {
    setMapping({ ...mapping, [key]: header });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-sm">
          <FileSpreadsheet className="size-4 text-primary" />
          <span>
            <strong>{analysis.totalRows}</strong> ligne{analysis.totalRows > 1 ? "s" : ""} détectée
            {analysis.totalRows > 1 ? "s" : ""} · {analysis.headers.length} colonnes
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="aconier" className="text-xs text-muted-foreground">
            Aconier
          </Label>
          <select
            id="aconier"
            value={aconier}
            onChange={(e) => setAconier(e.target.value as Aconier)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ACONIERS.map((a) => (
              <option key={a} value={a}>
                {ACONIER_LABEL[a]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!numeroMapped && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Colonne « N° conteneur » non mappée</AlertTitle>
          <AlertDescription>
            Le numéro de conteneur est obligatoire. Associe une colonne pour pouvoir importer.
          </AlertDescription>
        </Alert>
      )}

      {/* Éditeur de mapping */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Correspondance des colonnes</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {FLUX_FIELDS.map((field) => (
            <div key={field.key} className="flex items-center gap-2">
              <Label
                htmlFor={`map-${field.key}`}
                className="w-40 shrink-0 text-xs"
                title={field.description}
              >
                {field.label}
                {field.required && <span className="text-rose-600"> *</span>}
                {field.recommended && !mapping[field.key] && (
                  <span className="ml-1 text-amber-600">(recommandé)</span>
                )}
              </Label>
              <select
                id={`map-${field.key}`}
                value={mapping[field.key] ?? ""}
                onChange={(e) => setField(field.key, e.target.value)}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">— Ignorer —</option>
                {analysis.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Aperçu */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">
          Aperçu ({analysis.previewRows.length} première
          {analysis.previewRows.length > 1 ? "s" : ""} ligne
          {analysis.previewRows.length > 1 ? "s" : ""})
        </h3>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {mappedFields.map((f) => (
                  <th key={f.key} className="whitespace-nowrap px-2 py-1.5 text-left font-medium">
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.previewRows.map((row, i) => (
                <tr key={i} className="border-t">
                  {mappedFields.map((f) => (
                    <td key={f.key} className="whitespace-nowrap px-2 py-1.5">
                      {row[mapping[f.key]] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          <ArrowLeft className="mr-2 size-4" />
          Retour
        </Button>
        <Button onClick={onImport} disabled={!numeroMapped || busy}>
          {busy ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Import en cours…
            </>
          ) : (
            <>
              Importer {analysis.totalRows} ligne{analysis.totalRows > 1 ? "s" : ""}
              <ArrowRight className="ml-2 size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Étape rapport
// =============================================================================

function ReportStep({
  report,
  onReset,
}: {
  report: FluxImportReport;
  onReset: () => void;
}) {
  const statutInfo = {
    TERMINE: { variant: "success" as const, icon: CheckCircle2, label: "Import terminé" },
    PARTIEL: { variant: "info" as const, icon: AlertTriangle, label: "Import partiel" },
    ECHEC: { variant: "danger" as const, icon: XCircle, label: "Import échoué" },
  }[report.statut];
  const StatutIcon = statutInfo.icon;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Badge variant={statutInfo.variant} className="gap-1 px-2 py-1 text-xs">
          <StatutIcon className="size-3.5" />
          {statutInfo.label}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {report.aconier} · {report.nomFichier}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Lignes lues" value={report.nombreLignes} />
        <Stat label="Importés" value={report.nombreImportes} tone="success" />
        <Stat label="Doublons ignorés" value={report.nombreDoublons} tone="warn" />
        <Stat label="Erreurs" value={report.nombreErreurs} tone="danger" />
      </div>

      {report.doublons.length > 0 && (
        <DetailList
          title={`Doublons ignorés (${report.doublons.length})`}
          tone="warn"
          items={report.doublons}
        />
      )}
      {report.erreurs.length > 0 && (
        <DetailList
          title={`Erreurs (${report.erreurs.length})`}
          tone="danger"
          items={report.erreurs.map((e) => (e.ligne ? `Ligne ${e.ligne} : ${e.message}` : e.message))}
        />
      )}
      {report.avertissements.length > 0 && (
        <DetailList
          title={`Avertissements (${report.avertissements.length})`}
          tone="muted"
          items={report.avertissements.map((a) => (a.ligne ? `Ligne ${a.ligne} : ${a.message}` : a.message))}
        />
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button asChild>
          <Link href="/conteneurs">Voir les conteneurs</Link>
        </Button>
        <Button variant="outline" onClick={onReset}>
          <UploadCloud className="mr-2 size-4" />
          Importer un autre fichier
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warn" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-rose-600"
          : "text-foreground";
  return (
    <div className="rounded-md border bg-background p-3 text-center">
      <div className={`text-2xl font-bold ${value > 0 ? color : "text-foreground"}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

const MAX_LIST = 50;

function DetailList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "warn" | "danger" | "muted";
}) {
  const border =
    tone === "danger"
      ? "border-rose-200 bg-rose-50/50"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50/50"
        : "border-input bg-muted/30";
  const shown = items.slice(0, MAX_LIST);
  const rest = items.length - shown.length;
  return (
    <details className={`rounded-md border ${border} p-3`}>
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
        {shown.map((it, i) => (
          <li key={i} className="font-mono">
            {it}
          </li>
        ))}
        {rest > 0 && <li className="italic">… et {rest} autre{rest > 1 ? "s" : ""}.</li>}
      </ul>
    </details>
  );
}
