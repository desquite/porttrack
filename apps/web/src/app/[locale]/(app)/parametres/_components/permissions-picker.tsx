"use client";

import { useMemo, useState } from "react";
import { Crown, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  PERMISSION_DOMAINS,
  PERMISSION_TREE,
  type PermissionDomain,
  type StoredPermissions,
} from "@porttrack/shared";

type DomainState = { enabled: boolean; all: boolean; keys: string[] };

function initDomainState(v: StoredPermissions[PermissionDomain] | undefined): DomainState {
  if (v === "*") return { enabled: true, all: true, keys: [] };
  if (Array.isArray(v)) return { enabled: true, all: false, keys: v };
  return { enabled: false, all: false, keys: [] };
}

function serialize(isManager: boolean, states: Record<PermissionDomain, DomainState>): StoredPermissions {
  if (isManager) return {};
  const out: StoredPermissions = {};
  for (const d of PERMISSION_DOMAINS) {
    const s = states[d];
    if (!s.enabled) continue;
    out[d] = s.all ? "*" : s.keys;
  }
  return out;
}

/**
 * Sélecteur de droits par profil (cahier v8 §3).
 * - Case « Accès Manager » → role MANAGER, accès total (les profils sont masqués).
 * - Sinon : pour chaque profil coché, « Tous les droits » est coché par défaut ;
 *   le décocher révèle les sous-droits à sélectionner.
 *
 * Émet 2 hidden inputs lus par la server action :
 *   is_manager = "1" | ""
 *   permissions = JSON (StoredPermissions)
 */
export function PermissionsPicker({
  defaultIsManager,
  defaultPermissions,
}: {
  defaultIsManager: boolean;
  defaultPermissions: StoredPermissions;
}) {
  const [isManager, setIsManager] = useState(defaultIsManager);
  const [states, setStates] = useState<Record<PermissionDomain, DomainState>>(() => {
    const o = {} as Record<PermissionDomain, DomainState>;
    for (const d of PERMISSION_DOMAINS) o[d] = initDomainState(defaultPermissions[d]);
    return o;
  });

  const serialized = useMemo(() => serialize(isManager, states), [isManager, states]);

  function setDomain(d: PermissionDomain, patch: Partial<DomainState>) {
    setStates((prev) => ({ ...prev, [d]: { ...prev[d], ...patch } }));
  }
  function toggleKey(d: PermissionDomain, key: string) {
    setStates((prev) => {
      const s = prev[d];
      const keys = s.keys.includes(key) ? s.keys.filter((k) => k !== key) : [...s.keys, key];
      return { ...prev, [d]: { ...s, keys } };
    });
  }

  return (
    <div className="space-y-3">
      {/* Hidden inputs soumis avec le form */}
      <input type="hidden" name="is_manager" value={isManager ? "1" : ""} />
      <input type="hidden" name="permissions" value={JSON.stringify(serialized)} />

      {/* Accès Manager */}
      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-200 bg-amber-50/40 p-3">
        <input
          type="checkbox"
          checked={isManager}
          onChange={(e) => setIsManager(e.target.checked)}
          className="mt-0.5 size-4"
        />
        <span className="text-sm">
          <span className="flex items-center gap-1.5 font-medium"><Crown className="size-3.5 text-amber-600" />Accès Manager</span>
          <span className="text-xs text-muted-foreground">Tous les droits + Paramètres + gestion des utilisateurs + suppressions.</span>
        </span>
      </label>

      {/* Profils (masqués si Manager) */}
      {!isManager && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Coche les profils accordés. « Tous les droits » donne accès à tout le domaine ; décoche-le pour choisir précisément.
          </p>
          {PERMISSION_DOMAINS.map((d) => {
            const def = PERMISSION_TREE[d];
            const s = states[d];
            return (
              <div key={d} className={cn("rounded-md border", s.enabled && "border-primary/30 bg-primary/5")}>
                {/* En-tête profil */}
                <label className="flex cursor-pointer items-center gap-2 p-3">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => setDomain(d, { enabled: e.target.checked, all: e.target.checked ? true : s.all })}
                    className="size-4"
                  />
                  <span className="text-sm font-medium">{def.profileLabel}</span>
                  <span className="text-xs text-muted-foreground">— {def.label}</span>
                  {s.enabled && <ChevronDown className="ml-auto size-4 text-muted-foreground" />}
                </label>

                {/* « Tous les droits » + détail */}
                {s.enabled && (
                  <div className="space-y-2 border-t px-3 py-2.5">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={s.all}
                        onChange={(e) => setDomain(d, { all: e.target.checked })}
                        className="size-4"
                      />
                      <span className="font-medium">Tous les droits</span>
                    </label>

                    {!s.all && (
                      <ul className="ml-6 grid gap-1.5 sm:grid-cols-2">
                        {def.subRights.map((sr) => (
                          <li key={sr.key}>
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={s.keys.includes(sr.key)}
                                onChange={() => toggleKey(d, sr.key)}
                                className="size-4"
                              />
                              {sr.label}
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
