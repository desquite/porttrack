"use client";

import { useState, useTransition } from "react";
import { Loader2, UserX, UserCheck, Crown, Pencil, X, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROLES, type Role } from "@porttrack/shared";
import {
  updateUserRoleAction,
  toggleUserActiveAction,
  updateUserProfileAction,
} from "../users-actions";

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN:  "Super Admin",
  MANAGER:      "Manager",
  DISPATCHER:   "Dispatcher",
  COMPTABLE:    "Comptable",
  CHEF_GARAGE:  "Chef garage",
  CUSTOM:       "Custom",
};

const ROLE_VARIANT: Record<Role, "default" | "success" | "info" | "warning" | "secondary"> = {
  SUPER_ADMIN:  "default",
  MANAGER:      "info",
  DISPATCHER:   "success",
  COMPTABLE:    "info",
  CHEF_GARAGE:  "warning",
  CUSTOM:       "secondary",
};

// On retire SUPER_ADMIN du sélecteur inline (élévation via SQL uniquement)
const ASSIGNABLE_ROLES: Role[] = ROLES.filter((r) => r !== "SUPER_ADMIN");

type Props = {
  userId: string;
  email: string;
  prenoms: string | null;
  nom: string | null;
  telephone: string | null;
  role: Role;
  actif: boolean;
  tenantId: string;
  isSelf: boolean;          // l'utilisateur courant = ce user → guards spéciaux
  createdAt: string;
  /** Le caller peut-il administrer (modifier rôle / activer) ? Sinon lecture seule. */
  canAdmin?: boolean;
};

export function UserRow({
  userId,
  email,
  prenoms,
  nom,
  telephone,
  role,
  actif,
  tenantId,
  isSelf,
  createdAt,
  canAdmin = true,
}: Props) {
  const [rolePending, startRoleTransition] = useTransition();
  const [actifPending, startActifTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  // Nom affiché : « Prénom Nom » si renseigné, sinon on retombe sur l'email.
  const fullName = [prenoms, nom].filter(Boolean).join(" ").trim();
  const displayName = fullName || email;
  const hasName = fullName.length > 0;
  const initials = (
    hasName
      ? `${prenoms?.[0] ?? ""}${nom?.[0] ?? ""}`
      : email.slice(0, 2)
  ).toUpperCase();

  const profileAction = updateUserProfileAction.bind(null, userId, tenantId);

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value;
    if (newRole === role) return;
    const fd = new FormData();
    fd.set("role", newRole);
    startRoleTransition(async () => {
      await updateUserRoleAction(userId, tenantId, fd);
    });
  }

  function handleToggleActive() {
    const msg = actif
      ? `Désactiver le compte "${displayName}" ? Il ne pourra plus se connecter.`
      : `Réactiver le compte "${displayName}" ?`;
    if (!window.confirm(msg)) return;
    startActifTransition(async () => {
      await toggleUserActiveAction(userId, tenantId, actif);
    });
  }

  // ----- Mode édition de l'identité -----
  if (editing) {
    return (
      <li className="rounded-md border border-primary/30 bg-primary/5 p-3">
        <form action={profileAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor={`prenoms-${userId}`} className="text-xs">
                Prénoms <span className="text-rose-600">*</span>
              </Label>
              <Input id={`prenoms-${userId}`} name="prenoms" required defaultValue={prenoms ?? ""} placeholder="Lucien" />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`nom-${userId}`} className="text-xs">
                Nom <span className="text-rose-600">*</span>
              </Label>
              <Input id={`nom-${userId}`} name="nom" required defaultValue={nom ?? ""} placeholder="Adou" />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`tel-${userId}`} className="text-xs">Téléphone</Label>
              <Input id={`tel-${userId}`} name="telephone" type="tel" defaultValue={telephone ?? ""} placeholder="+225 07 11 22 33 44" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">{email}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <X className="mr-1 size-3.5" />Annuler
            </Button>
            <Button type="submit" size="sm">Enregistrer</Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-md border p-3",
        !actif && "bg-muted/40 opacity-75",
      )}
    >
      {/* Avatar */}
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
        {initials}
      </div>

      {/* Identité */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium truncate">{displayName}</span>
          {isSelf && (
            <Badge variant="outline" className="text-[10px]">
              <Crown className="mr-1 size-2.5" />
              Toi
            </Badge>
          )}
          {!actif && (
            <Badge variant="secondary" className="text-[10px]">
              Désactivé
            </Badge>
          )}
          {!hasName && (
            <Badge variant="outline" className="border-dashed text-[10px] text-muted-foreground">
              Nom à renseigner
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          {hasName && <span className="truncate">{email}</span>}
          {telephone && <span className="flex items-center gap-1"><Phone className="size-3" />{telephone}</span>}
          <span>
            Créé le{" "}
            {new Date(createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* Sélecteur rôle inline */}
      <div className="flex items-center gap-2">
        {/* Éditer l'identité (prénoms/nom/téléphone) */}
        {canAdmin && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            title="Modifier l'identité"
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
        {role === "SUPER_ADMIN" || !canAdmin ? (
          // SUPER_ADMIN non modifiable, ou caller sans droits d'admin → badge figé
          <Badge variant={ROLE_VARIANT[role]} className="text-[10px]">
            {ROLE_LABEL[role]}
          </Badge>
        ) : (
          <div className="relative">
            <select
              value={role}
              onChange={handleRoleChange}
              disabled={rolePending || isSelf}
              title={
                isSelf
                  ? "Tu ne peux pas modifier ton propre rôle"
                  : undefined
              }
              className={cn(
                "h-8 rounded-md border border-input bg-transparent px-2 pr-6 text-xs shadow-sm",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                rolePending && "opacity-60",
              )}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            {rolePending && (
              <Loader2 className="absolute right-1.5 top-1/2 size-3 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        )}

        {/* Bouton activer/désactiver — réservé aux administrateurs */}
        {canAdmin && !isSelf && role !== "SUPER_ADMIN" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleActive}
            disabled={actifPending}
            className={
              actif
                ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
            }
            title={actif ? "Désactiver" : "Réactiver"}
          >
            {actifPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : actif ? (
              <UserX className="size-3.5" />
            ) : (
              <UserCheck className="size-3.5" />
            )}
          </Button>
        )}
      </div>
    </li>
  );
}
