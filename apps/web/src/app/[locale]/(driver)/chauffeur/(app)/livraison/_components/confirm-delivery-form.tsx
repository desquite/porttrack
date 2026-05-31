"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Camera, PackageCheck, Check, Truck, Container, MoveDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { confirmDriverDelivery, type ConfirmDeliveryState } from "../actions";

export type RemorqueOption = { id: string; label: string };

const initial: ConfirmDeliveryState = { status: "idle" };

const MODES = [
  { value: "REMORQUE_COUPEE", label: "Remorque coupée sur site", hint: "Je laisse la remorque chez le client", icon: Container },
  { value: "CLIENT_DECHARGE", label: "Client a déchargé", hint: "Je repars avec la remorque", icon: Truck },
  { value: "AUTO_CHARGEUR", label: "Déposé par terre (auto-chargeur)", hint: "Sans remorque", icon: MoveDown },
] as const;

export function ConfirmDeliveryForm({
  conteneurId,
  remorques,
  defaultRemorqueId,
}: {
  conteneurId: string;
  remorques: RemorqueOption[];
  defaultRemorqueId: string | null;
}) {
  const [state, formAction, pending] = useActionState(confirmDriverDelivery, initial);
  const [mode, setMode] = useState<string>("");
  const [remorqueId, setRemorqueId] = useState<string>(defaultRemorqueId ?? "");
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const needsRemorque = mode !== "" && mode !== "AUTO_CHARGEUR";
  const canSubmit = !!mode && (!needsRemorque || !!remorqueId) && !!photo;

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto({ file: f, url: URL.createObjectURL(f) });
    }
    e.target.value = "";
  }

  function handleSubmit() {
    const fd = new FormData();
    fd.set("conteneur_id", conteneurId);
    fd.set("mode_livraison", mode);
    if (needsRemorque) fd.set("remorque_id", remorqueId);
    if (photo) fd.set("eir", photo.file);
    formAction(fd);
  }

  return (
    <div className="space-y-5 pb-2">
      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Impossible de confirmer</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      {/* Mode de livraison */}
      <div className="space-y-2">
        <div className="text-sm font-semibold">Comment as-tu livré ?</div>
        {MODES.map((m) => {
          const active = mode === m.value;
          const Icon = m.icon;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                active ? "border-primary bg-primary/5" : "border-input hover:bg-accent",
              )}
            >
              <Icon className={cn("size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{m.label}</div>
                <div className="text-xs text-muted-foreground">{m.hint}</div>
              </div>
              {active && <Check className="size-5 text-primary" />}
            </button>
          );
        })}
      </div>

      {/* Remorque (sauf auto-chargeur) */}
      {needsRemorque && (
        <div className="space-y-1.5">
          <label htmlFor="remorque" className="text-sm font-medium">Remorque / châssis utilisé</label>
          <select
            id="remorque"
            value={remorqueId}
            onChange={(e) => setRemorqueId(e.target.value)}
            className="flex h-12 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">— Choisir —</option>
            {remorques.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          {remorques.length === 0 && <p className="text-[11px] text-amber-700">Aucune remorque en service dans la flotte.</p>}
        </div>
      )}

      {/* EIR (obligatoire, 1 photo) */}
      <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50/40 p-3">
        <div className="text-sm font-semibold">Photo de l&apos;EIR <span className="text-rose-600">*</span></div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={onPhoto} />
        {photo ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border">
            <Image src={photo.url} alt="EIR" fill sizes="100vw" className="object-cover" unoptimized />
            <button type="button" onClick={() => fileRef.current?.click()} className="absolute bottom-2 right-2 rounded-md bg-black/60 px-3 py-1.5 text-xs text-white">
              Reprendre
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} className="flex h-14 w-full items-center justify-center gap-2 rounded-md border border-dashed border-amber-400 text-sm font-medium text-amber-800">
            <Camera className="size-5" />Photographier l&apos;EIR
          </button>
        )}
      </div>

      <Button type="button" onClick={handleSubmit} disabled={pending || !canSubmit} className="h-14 w-full text-base">
        {pending ? <><Loader2 className="mr-2 size-5 animate-spin" />Confirmation…</> :
          <><PackageCheck className="mr-2 size-5" />Confirmer la livraison</>}
      </Button>
      {!canSubmit && (
        <p className="text-center text-xs text-muted-foreground">
          Choisis le mode{needsRemorque ? ", la remorque" : ""} et photographie l&apos;EIR pour confirmer.
        </p>
      )}
    </div>
  );
}
