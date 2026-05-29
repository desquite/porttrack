"use client";

import { useActionState, useState } from "react";
import {
  Loader2,
  Mail,
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
import { ROLES, type Role } from "@porttrack/shared";
import { inviteUserAction, type InviteUserState } from "../users-actions";

// On exclut SUPER_ADMIN et CUSTOM des rôles invitables via UI :
//   - SUPER_ADMIN : élévation réservée à SQL
//   - CUSTOM : rôle "défaut" sans signification métier, peu utile à inviter
const INVITABLE_ROLES: Role[] = ROLES.filter(
  (r) => r !== "SUPER_ADMIN" && r !== "CUSTOM",
);

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN:  "Super Admin (PORTTRACK)",
  MANAGER:      "Manager — admin de l'entreprise",
  DISPATCHER:   "Dispatcher — gère flux & affectations",
  COMPTABLE:    "Comptable — facturation & CA",
  CHEF_GARAGE:  "Chef garage — pannes & réparations",
  CUSTOM:       "Custom — permissions à la carte",
};

const initialState: InviteUserState = { status: "idle" };

type Props = {
  tenantId: string;
};

export function InviteUserForm({ tenantId }: Props) {
  const boundAction = inviteUserAction.bind(null, tenantId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [copied, setCopied] = useState(false);

  const getError = (name: "email" | "role"): string | null => {
    if (state.status !== "error") return null;
    return state.fieldErrors?.[name]?.[0] ?? null;
  };
  const getValue = (name: "email" | "role"): string => {
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
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
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
            <Label htmlFor="invite-role" className="text-xs">
              Rôle <span className="text-rose-600">*</span>
            </Label>
            <select
              id="invite-role"
              name="role"
              required
              defaultValue={getValue("role") || "DISPATCHER"}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                getError("role") && "border-rose-500",
              )}
            >
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            {getError("role") && (
              <p className="text-[11px] text-rose-600">{getError("role")}</p>
            )}
          </div>

          <div className="flex items-end">
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
        </div>
      </form>
    </div>
  );
}
