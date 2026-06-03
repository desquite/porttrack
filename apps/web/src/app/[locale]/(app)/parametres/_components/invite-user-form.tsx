"use client";

import { useActionState, useState } from "react";
import {
  Loader2,
  Mail,
  Phone,
  UserPlus,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { inviteUserAction, type InviteUserState } from "../users-actions";
import { PermissionsPicker } from "./permissions-picker";

const initialState: InviteUserState = { status: "idle" };

type Props = {
  tenantId: string;
};

export function InviteUserForm({ tenantId }: Props) {
  const boundAction = inviteUserAction.bind(null, tenantId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [copied, setCopied] = useState(false);

  type FieldName = "email" | "prenoms" | "nom" | "telephone";
  const getError = (name: FieldName): string | null => {
    if (state.status !== "error") return null;
    return state.fieldErrors?.[name]?.[0] ?? null;
  };
  const getValue = (name: FieldName): string => {
    if (state.status === "error") return state.values?.[name] ?? "";
    return "";
  };

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback : sélectionne le texte
    }
  }

  return (
    <div className="space-y-4">
      {/* Erreur globale */}
      {state.status === "error" && state.formError && !state.fieldErrors && (
        <Alert variant="destructive">
          <AlertTitle>Impossible d&apos;inviter</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      {/* Succès avec magic link à copier */}
      {state.status === "success" && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <UserPlus className="size-4" />
          <AlertTitle>Utilisateur invité</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {state.emailSent ? (
                <>
                  Un email d&apos;invitation a été envoyé à{" "}
                  <strong>{state.email}</strong> avec son lien de connexion. Le
                  lien reste affiché ci-dessous au cas où.
                </>
              ) : (
                <>
                  Le compte <strong>{state.email}</strong> a été créé, mais
                  l&apos;email automatique n&apos;a pas pu partir. Copie le lien
                  ci-dessous et envoie-le-lui (WhatsApp/email).
                </>
              )}
            </p>

            {state.magicLink && (
              <div className="space-y-2">
                <p className="text-xs text-emerald-900/80">
                  Lien de connexion magique (copie-le et envoie-le par
                  WhatsApp/email — valide ~1h) :
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md border border-emerald-300 bg-white px-2 py-1 font-mono text-[11px] text-emerald-900">
                    {state.magicLink}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(state.magicLink!)}
                    className="border-emerald-300"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-1 size-3.5" />
                        Copié
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 size-3.5" />
                        Copier
                      </>
                    )}
                  </Button>
                  <Button asChild variant="outline" size="sm" className="border-emerald-300">
                    <a href={state.magicLink} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Formulaire d'invitation */}
      <form action={formAction} className="space-y-3">
        {/* Identité */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="invite-prenoms" className="text-xs">
              Prénoms <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="invite-prenoms"
              name="prenoms"
              required
              defaultValue={getValue("prenoms")}
              placeholder="Lucien"
              className={cn(getError("prenoms") && "border-rose-500")}
            />
            {getError("prenoms") && (
              <p className="text-[11px] text-rose-600">{getError("prenoms")}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="invite-nom" className="text-xs">
              Nom <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="invite-nom"
              name="nom"
              required
              defaultValue={getValue("nom")}
              placeholder="Adou"
              className={cn(getError("nom") && "border-rose-500")}
            />
            {getError("nom") && (
              <p className="text-[11px] text-rose-600">{getError("nom")}</p>
            )}
          </div>
        </div>

        {/* Contact */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="invite-email" className="text-xs">
              Adresse email <span className="text-rose-600">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="invite-email"
                name="email"
                type="email"
                required
                defaultValue={getValue("email")}
                placeholder="dispatcher@example.ci"
                className={cn("pl-8", getError("email") && "border-rose-500")}
              />
            </div>
            {getError("email") && (
              <p className="text-[11px] text-rose-600">{getError("email")}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="invite-telephone" className="text-xs">
              Téléphone
            </Label>
            <div className="relative">
              <Phone className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="invite-telephone"
                name="telephone"
                type="tel"
                defaultValue={getValue("telephone")}
                placeholder="+225 07 11 22 33 44"
                className={cn("pl-8", getError("telephone") && "border-rose-500")}
              />
            </div>
            {getError("telephone") && (
              <p className="text-[11px] text-rose-600">{getError("telephone")}</p>
            )}
          </div>
        </div>

        {/* Droits d'accès */}
        <div className="space-y-2 pt-1">
          <Label className="text-xs">Droits d&apos;accès <span className="text-rose-600">*</span></Label>
          <PermissionsPicker defaultIsManager={false} defaultPermissions={{}} />
        </div>

        <div className="flex justify-end pt-1">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Création…
              </>
            ) : (
              <>
                <UserPlus className="mr-2 size-4" />
                Inviter
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
