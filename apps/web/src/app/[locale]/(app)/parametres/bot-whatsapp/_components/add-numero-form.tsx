"use client";

import { useActionState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { addBotNumeroAction, type BotNumeroFormState } from "../actions";

const initialState: BotNumeroFormState = { status: "idle" };

export function AddNumeroForm({ tenantId }: { tenantId: string }) {
  const [state, formAction, pending] = useActionState(addBotNumeroAction, initialState);
  const v = state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tenant_id" value={tenantId} />

      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Ajout impossible</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="numero" className="text-xs">Numéro WhatsApp <span className="text-rose-600">*</span></Label>
          <Input id="numero" name="numero" required placeholder="+225 07 00 00 00 00" defaultValue={v?.numero ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="label" className="text-xs">Libellé</Label>
          <Input id="label" name="label" placeholder="Ex : Dispatcher Kouassi" defaultValue={v?.label ?? ""} />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="mr-2 size-4" />Ajouter</>}
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Peu importe le format (07…, 7…, +225…, ancien 8 chiffres) : la reconnaissance se fait sur les 8 derniers chiffres.
      </p>
    </form>
  );
}
