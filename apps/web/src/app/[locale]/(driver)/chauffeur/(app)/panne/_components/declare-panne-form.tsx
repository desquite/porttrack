"use client";

import { useActionState } from "react";
import { Loader2, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { declarePanneAction, type DeclarePanneState } from "../actions";

const initial: DeclarePanneState = { status: "idle" };

export function DeclarePanneForm() {
  const [state, action, pending] = useActionState(declarePanneAction, initial);

  return (
    <form action={action} className="space-y-4">
      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Impossible d&apos;envoyer</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <label htmlFor="description" className="text-sm font-medium">
          Description de la panne <span className="text-rose-600">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          placeholder="Ex. fuite d'huile moteur, pneu crevé, freins qui sifflent…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <Button type="submit" disabled={pending} className="h-12 w-full gap-2">
        {pending ? <><Loader2 className="size-4 animate-spin" />Envoi…</> : <><Wrench className="size-4" />Envoyer la panne</>}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        Le garage et l&apos;exploitation sont notifiés. Ton camion passera « en panne ».
      </p>
    </form>
  );
}
