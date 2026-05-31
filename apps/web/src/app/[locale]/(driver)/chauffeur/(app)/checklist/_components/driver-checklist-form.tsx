"use client";

import { useActionState, useState } from "react";
import { Loader2, Check, TriangleAlert, Camera, ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { submitDriverChecklist, type DriverChecklistState } from "../actions";

export type ChecklistItem = { id: string; label: string };

const initial: DriverChecklistState = { status: "idle" };

export function DriverChecklistForm({ designationId, items }: { designationId: string; items: ChecklistItem[] }) {
  const [state, formAction, pending] = useActionState(submitDriverChecklist, initial);
  const [answers, setAnswers] = useState<Record<string, "OK" | "ANOMALIE">>({});
  const [photoName, setPhotoName] = useState<string | null>(null);

  const allAnswered = items.length > 0 && items.every((it) => answers[it.id]);
  const hasAnomalie = Object.values(answers).includes("ANOMALIE");

  return (
    <form action={formAction} className="space-y-5 pb-2">
      <input type="hidden" name="designation_id" value={designationId} />
      {items.map((it) => (
        <input key={it.id} type="hidden" name={`item-${it.id}`} value={answers[it.id] ?? ""} />
      ))}

      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Impossible de valider</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      {/* Items : 2 gros boutons OK / Anomalie */}
      <div className="space-y-3">
        {items.map((it) => {
          const val = answers[it.id];
          return (
            <div key={it.id} className="rounded-lg border bg-background p-3">
              <div className="mb-2 text-sm font-medium">{it.label}</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [it.id]: "OK" }))}
                  className={cn(
                    "flex h-12 items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors",
                    val === "OK"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-input text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Check className="size-4" />OK
                </button>
                <button
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [it.id]: "ANOMALIE" }))}
                  className={cn(
                    "flex h-12 items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors",
                    val === "ANOMALIE"
                      ? "border-amber-500 bg-amber-50 text-amber-800"
                      : "border-input text-muted-foreground hover:bg-accent",
                  )}
                >
                  <TriangleAlert className="size-4" />Anomalie
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Photo (mise en avant si anomalie) */}
      <div className={cn("rounded-lg border p-3", hasAnomalie && "border-amber-300 bg-amber-50/40")}>
        <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input text-sm font-medium text-muted-foreground">
          <Camera className="size-5" />
          {photoName ? "Changer la photo" : "Ajouter une photo"}
          <input
            type="file"
            name="photo"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        {photoName && <p className="mt-2 truncate text-center text-xs text-emerald-700">📷 {photoName}</p>}
        {hasAnomalie && !photoName && (
          <p className="mt-2 text-center text-[11px] text-amber-700">Une photo est conseillée en cas d&apos;anomalie.</p>
        )}
      </div>

      {/* Remarque */}
      <textarea
        name="remarque"
        rows={2}
        placeholder="Remarque (optionnel)"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      />

      <Button type="submit" disabled={pending || !allAnswered} className="h-14 w-full text-base">
        {pending ? <><Loader2 className="mr-2 size-5 animate-spin" />Validation…</> :
          <><ClipboardCheck className="mr-2 size-5" />Valider ma check-list</>}
      </Button>
      {!allAnswered && (
        <p className="text-center text-xs text-muted-foreground">Réponds à tous les items pour pouvoir valider.</p>
      )}
    </form>
  );
}
