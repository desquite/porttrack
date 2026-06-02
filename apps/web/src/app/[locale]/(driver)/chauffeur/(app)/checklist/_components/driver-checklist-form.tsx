"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Check, TriangleAlert, Camera, ClipboardCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/utils/image";
import { submitDriverChecklist, type DriverChecklistState } from "../actions";

export type ChecklistItem = { id: string; label: string };

const initial: DriverChecklistState = { status: "idle" };

type Photo = { file: File; url: string };

export function DriverChecklistForm({ designationId, items }: { designationId: string; items: ChecklistItem[] }) {
  const [state, formAction, pending] = useActionState(submitDriverChecklist, initial);
  const [answers, setAnswers] = useState<Record<string, "OK" | "ANOMALIE">>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [remarque, setRemarque] = useState("");
  const [preparing, setPreparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const allAnswered = items.length > 0 && items.every((it) => answers[it.id]);
  const hasAnomalie = Object.values(answers).includes("ANOMALIE");

  async function addPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // reset pour pouvoir reprendre une autre photo
    if (!f) return;
    // Compression côté navigateur AVANT stockage : réduit ~6 Mo → ~200 Ko, ce qui
    // évite la limite Vercel de 4,5 Mo et accélère drastiquement l'upload en 4G.
    setPreparing(true);
    try {
      const optimized = await compressImage(f);
      setPhotos((prev) => [...prev, { file: optimized, url: URL.createObjectURL(optimized) }]);
    } finally {
      setPreparing(false);
    }
  }
  function removePhoto(i: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[i]?.url);
      return prev.filter((_, j) => j !== i);
    });
  }

  function handleSubmit() {
    const fd = new FormData();
    fd.set("designation_id", designationId);
    for (const it of items) fd.set(`item-${it.id}`, answers[it.id] ?? "");
    fd.set("remarque", remarque);
    for (const p of photos) fd.append("photo", p.file);
    formAction(fd);
  }

  return (
    <div className="space-y-5 pb-2">
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
                    val === "OK" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-input text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Check className="size-4" />OK
                </button>
                <button
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [it.id]: "ANOMALIE" }))}
                  className={cn(
                    "flex h-12 items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors",
                    val === "ANOMALIE" ? "border-amber-500 bg-amber-50 text-amber-800" : "border-input text-muted-foreground hover:bg-accent",
                  )}
                >
                  <TriangleAlert className="size-4" />Anomalie
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Photos (multiple) */}
      <div className={cn("space-y-3 rounded-lg border p-3", hasAnomalie && "border-amber-300 bg-amber-50/40")}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={addPhoto} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={preparing}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-input text-sm font-medium text-muted-foreground disabled:opacity-60"
        >
          {preparing ? <><Loader2 className="size-5 animate-spin" />Optimisation…</> : <><Camera className="size-5" />Ajouter une photo</>}
        </button>

        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-md border">
                <Image src={p.url} alt={`Photo ${i + 1}`} fill sizes="33vw" className="object-cover" unoptimized />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label="Retirer"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {hasAnomalie && photos.length === 0 && (
          <p className="text-center text-[11px] text-amber-700">Une photo est conseillée en cas d&apos;anomalie.</p>
        )}
      </div>

      {/* Remarque */}
      <textarea
        value={remarque}
        onChange={(e) => setRemarque(e.target.value)}
        rows={2}
        placeholder="Remarque (optionnel)"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      />

      <Button type="button" onClick={handleSubmit} disabled={pending || preparing || !allAnswered} className="h-14 w-full text-base">
        {pending ? <><Loader2 className="mr-2 size-5 animate-spin" />Validation…</> :
          <><ClipboardCheck className="mr-2 size-5" />Valider ma check-list</>}
      </Button>
      {!allAnswered && (
        <p className="text-center text-xs text-muted-foreground">Réponds à tous les items pour pouvoir valider.</p>
      )}
    </div>
  );
}
