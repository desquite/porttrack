"use client";

import { useActionState, useState } from "react";
import { Loader2, ClipboardCheck, FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { validerLivraisonAction, type SaisieFormState } from "../actions";
import type { RefOption } from "../../affectations/_components/load-refs";

const initial: SaisieFormState = { status: "idle" };
const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

const MODES = [
  { value: "REMORQUE_COUPEE", label: "Remorque coupée" },
  { value: "CLIENT_DECHARGE", label: "Client décharge" },
  { value: "AUTO_CHARGEUR", label: "Auto-chargeur" },
];

export function SaisieLivraisonForm({
  affectationId,
  defaultChauffeurId,
  defaultTracteurId,
  chauffeurs,
  tracteurs,
  remorques,
}: {
  affectationId: string;
  defaultChauffeurId: string | null;
  defaultTracteurId: string | null;
  chauffeurs: RefOption[];
  tracteurs: RefOption[];
  remorques: RefOption[];
}) {
  const action = validerLivraisonAction.bind(null, affectationId);
  const [state, formAction, pending] = useActionState(action, initial);
  const v = state.status === "error" ? state.values ?? {} : {};
  const today = new Date().toISOString().slice(0, 10);

  // Mode local pour conditionner l'affichage de la remorque (obligatoire sauf
  // auto-chargeur).
  const [mode, setMode] = useState<string>(v.mode_livraison ?? "REMORQUE_COUPEE");
  const remorqueRequired = mode !== "AUTO_CHARGEUR";

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-5">
      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Impossible de saisir</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="chauffeur_id">Chauffeur ★</Label>
          <select
            id="chauffeur_id"
            name="chauffeur_id"
            defaultValue={v.chauffeur_id ?? defaultChauffeurId ?? ""}
            required
            className={selectCls}
          >
            <option value="">— Choisir —</option>
            {chauffeurs.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tracteur_id">Tracteur ★</Label>
          <select
            id="tracteur_id"
            name="tracteur_id"
            defaultValue={v.tracteur_id ?? defaultTracteurId ?? ""}
            required
            className={selectCls}
          >
            <option value="">— Choisir —</option>
            {tracteurs.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mode_livraison">Mode de livraison ★</Label>
          <select
            id="mode_livraison"
            name="mode_livraison"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            required
            className={selectCls}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="remorque_id">
            Remorque {remorqueRequired ? "★" : "(non applicable)"}
          </Label>
          <select
            id="remorque_id"
            name="remorque_id"
            defaultValue={v.remorque_id ?? ""}
            disabled={!remorqueRequired}
            required={remorqueRequired}
            className={selectCls}
          >
            <option value="">{remorqueRequired ? "— Choisir —" : "— Aucune —"}</option>
            {remorques.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date_livraison">Date de livraison ★</Label>
          <Input
            id="date_livraison"
            name="date_livraison"
            type="date"
            defaultValue={v.date_livraison ?? today}
            required
          />
        </div>
      </div>

      {/* Upload EIR */}
      <div className="space-y-1.5 rounded-md border border-dashed bg-muted/20 p-4">
        <Label htmlFor="eir" className="flex items-center gap-2">
          <FileUp className="size-4 text-primary" />
          EIR (PDF, PNG ou JPG — max 5 Mo) ★
        </Label>
        <Input
          id="eir"
          name="eir"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          required
        />
        <p className="text-xs text-muted-foreground">
          Joins le scan ou la photo du bon EIR ramené par le chauffeur.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? (
          <><Loader2 className="mr-2 size-4 animate-spin" />Validation…</>
        ) : (
          <><ClipboardCheck className="mr-2 size-4" />Valider la livraison</>
        )}
      </Button>
    </form>
  );
}
