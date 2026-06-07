"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Info, Loader2, Truck, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { formatDateFR } from "@/lib/utils/dates";
import { planifierRecuperationAction, type RecuperationFormState } from "../actions";
import type { RefOption } from "../../affectations/_components/load-refs";
import type { DesignationDuJour } from "../../affectations/_components/load-designations";

type ModeLivraison = "REMORQUE_COUPEE" | "CLIENT_DECHARGE" | "AUTO_CHARGEUR";

const initial: RecuperationFormState = { status: "idle" };
const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

const MODE_LABEL: Record<ModeLivraison, string> = {
  REMORQUE_COUPEE: "Remorque coupée",
  CLIENT_DECHARGE: "Client décharge",
  AUTO_CHARGEUR: "Auto-chargeur",
};

type Props = {
  conteneurId: string;
  chauffeurs: RefOption[];
  tracteurs: RefOption[];
  remorques: RefOption[];
  /** Désignations du jour (chauffeur ↔ matériel). Source unique de vérité pour
   *  le chauffeur et le matériel attribué. */
  designationsJour?: DesignationDuJour[];
  /** Mode utilisé lors de la livraison initiale (eir_archives.mode_livraison). */
  modeLivraison?: ModeLivraison | null;
  /** Si REMORQUE_COUPEE : remorque restée chez le client (eir_archives). */
  livraisonRemorqueId?: string | null;
  livraisonRemorqueImmat?: string | null;
  livraisonDate?: string | null;
};

export function PlanifierForm({
  conteneurId,
  chauffeurs,
  tracteurs,
  remorques,
  designationsJour,
  modeLivraison,
  livraisonRemorqueId,
  livraisonRemorqueImmat,
  livraisonDate,
}: Props) {
  const action = planifierRecuperationAction.bind(null, conteneurId);
  const [state, formAction, pending] = useActionState(action, initial);
  const v = state.status === "error" ? state.values ?? {} : {};
  const today = new Date().toISOString().slice(0, 10);

  // ---------------------------------------------------------------------------
  // Désignations : on filtre les chauffeurs selon le matériel requis pour ce
  // mode de récup.
  //   * REMORQUE_COUPEE / CLIENT_DECHARGE → besoin d'un TRACTEUR
  //   * AUTO_CHARGEUR                     → besoin d'une AUTO_CHARGEUSE
  // ---------------------------------------------------------------------------
  const useDesignations = !!designationsJour && designationsJour.length > 0;
  const matRequis: "TRACTEUR" | "AUTO_CHARGEUSE" =
    modeLivraison === "AUTO_CHARGEUR" ? "AUTO_CHARGEUSE" : "TRACTEUR";

  const designationsCompatibles = useMemo(
    () => (designationsJour ?? []).filter((d) => d.materielType === matRequis),
    [designationsJour, matRequis],
  );

  const designationByChauffeur = useMemo(() => {
    const m = new Map<string, DesignationDuJour>();
    for (const d of designationsCompatibles) m.set(d.chauffeurId, d);
    return m;
  }, [designationsCompatibles]);

  const chauffeursOptions: RefOption[] = useDesignations
    ? designationsCompatibles.map((d) => ({ id: d.chauffeurId, label: d.chauffeurLabel }))
    : chauffeurs;

  const initialChauffeurId =
    (state.status === "error" && state.values?.chauffeur_id) || "";
  const [selectedChauffeurId, setSelectedChauffeurId] = useState<string>(initialChauffeurId);
  const autoMateriel = useDesignations ? designationByChauffeur.get(selectedChauffeurId) ?? null : null;

  // ---------------------------------------------------------------------------
  // Champs « remorque » selon le mode
  //   * REMORQUE_COUPEE  → remorque déjà sur place = celle de la livraison
  //                        (lecture seule, on la stocke quand même via hidden)
  //   * CLIENT_DECHARGE  → remorque à choisir (combobox libre)
  //   * AUTO_CHARGEUR    → pas de remorque
  // ---------------------------------------------------------------------------
  const remorqueRequired = modeLivraison === "CLIENT_DECHARGE";
  const remorqueReadonly = modeLivraison === "REMORQUE_COUPEE";
  const remorqueAbsente = modeLivraison === "AUTO_CHARGEUR";

  // Étiquette du bouton submit / pas d'auto-chargeuse disponible
  const aucunDesignationCompatible = useDesignations && designationsCompatibles.length === 0;

  return (
    <form action={formAction} className="space-y-5">
      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Impossible de planifier</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      {/* Bandeau d'info adapté au mode de livraison */}
      {modeLivraison && (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>
            Livraison « {MODE_LABEL[modeLivraison]} »
            {livraisonDate && (
              <span className="font-normal text-muted-foreground"> · le {formatDateFR(livraisonDate)}</span>
            )}
          </AlertTitle>
          <AlertDescription>
            {modeLivraison === "REMORQUE_COUPEE" && (
              <>
                La remorque{livraisonRemorqueImmat ? <> <strong>{livraisonRemorqueImmat}</strong></> : ""} est restée chez
                le client avec le conteneur. Envoie le <strong>tracteur</strong> pour la récupérer.
              </>
            )}
            {modeLivraison === "CLIENT_DECHARGE" && (
              <>
                Le client a déchargé — le conteneur vide est sur place sans remorque. Envoie un attelage complet
                (<strong>tracteur + remorque</strong>) pour ramener le vide.
              </>
            )}
            {modeLivraison === "AUTO_CHARGEUR" && (
              <>
                Livré par auto-chargeuse, le conteneur est par terre chez le client. Envoie une{" "}
                <strong>auto-chargeuse</strong> pour reprendre le vide.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {aucunDesignationCompatible && (
        <Alert variant="destructive">
          <AlertTitle>Aucun chauffeur compatible désigné aujourd&apos;hui</AlertTitle>
          <AlertDescription>
            Personne n&apos;est désigné sur un{" "}
            {matRequis === "AUTO_CHARGEUSE" ? "matériel auto-chargeuse" : "tracteur"} aujourd&apos;hui. Va dans{" "}
            <Link href="/designations" className="font-medium underline">Désignations</Link> pour en désigner un.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Chauffeur */}
        {useDesignations ? (
          <div className="space-y-1.5">
            <Label htmlFor="chauffeur_id">Chauffeur désigné aujourd&apos;hui ★</Label>
            <Combobox
              id="chauffeur_id"
              name="chauffeur_id"
              options={chauffeursOptions}
              defaultValue={initialChauffeurId}
              placeholder="— Choisir un chauffeur désigné —"
              searchPlaceholder="Rechercher un chauffeur…"
              onValueChange={(val) => setSelectedChauffeurId(val)}
            />
            <p className="text-[11px] text-muted-foreground">
              Le {matRequis === "AUTO_CHARGEUSE" ? "matériel auto-chargeuse" : "tracteur"} sera repris automatiquement.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="chauffeur_id">Chauffeur ★</Label>
            <select id="chauffeur_id" name="chauffeur_id" defaultValue={v.chauffeur_id ?? ""} required className={selectCls}>
              <option value="">— Choisir —</option>
              {chauffeurs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        )}

        {/* Tracteur / Auto-chargeuse (auto-rempli si désignations) */}
        {useDesignations ? (
          <div className="space-y-1.5">
            <Label>
              {matRequis === "AUTO_CHARGEUSE" ? "Auto-chargeuse (auto)" : "Tracteur (auto)"}
            </Label>
            <input type="hidden" name="tracteur_id" value={autoMateriel?.materielId ?? ""} />
            <div
              className={cn(
                "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm",
                !autoMateriel?.materielLabel && "text-muted-foreground",
              )}
              aria-readonly="true"
            >
              <Truck className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {autoMateriel?.materielLabel
                  ? autoMateriel.materielLabel
                  : selectedChauffeurId
                    ? "— Pas de matériel attribué —"
                    : "— En attente du chauffeur —"}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="tracteur_id">Tracteur ★</Label>
            <select id="tracteur_id" name="tracteur_id" defaultValue={v.tracteur_id ?? ""} required className={selectCls}>
              <option value="">— Choisir —</option>
              {tracteurs.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        )}

        {/* Remorque : 3 comportements selon le mode */}
        {!remorqueAbsente && (
          remorqueReadonly ? (
            <div className="space-y-1.5">
              <Label>Remorque (sur place)</Label>
              <input type="hidden" name="remorque_id" value={livraisonRemorqueId ?? ""} />
              <div
                className={cn(
                  "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm",
                  !livraisonRemorqueImmat && "text-muted-foreground",
                )}
                aria-readonly="true"
              >
                <Truck className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {livraisonRemorqueImmat ?? "— Remorque non identifiée —"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Remorque coupée chez le client lors de la livraison.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="remorque_id">Remorque {remorqueRequired ? "★" : "(facultatif)"}</Label>
              <select
                id="remorque_id"
                name="remorque_id"
                defaultValue={v.remorque_id ?? ""}
                required={remorqueRequired}
                className={selectCls}
              >
                <option value="">{remorqueRequired ? "— Choisir —" : "— Aucune —"}</option>
                {remorques.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          )
        )}

        <div className="space-y-1.5">
          <Label htmlFor="date_planifiee">Date prévue</Label>
          <Input id="date_planifiee" name="date_planifiee" type="date" defaultValue={v.date_planifiee ?? today} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Destination du vide ★</Label>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="radio" name="destination_type" value="PARC_ACONIER" defaultChecked={v.destination_type !== "TERMINAL"} />
            Parc aconier
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="radio" name="destination_type" value="TERMINAL" defaultChecked={v.destination_type === "TERMINAL"} />
            Terminal
          </label>
        </div>
        <Input name="destination_lieu" placeholder="Nom du parc / terminal (facultatif)" defaultValue={v.destination_lieu ?? ""} />
      </div>

      <Button type="submit" disabled={pending || aucunDesignationCompatible}>
        {pending ? <><Loader2 className="mr-2 size-4 animate-spin" />Planification…</> : <><Undo2 className="mr-2 size-4" />Planifier la récupération</>}
      </Button>
    </form>
  );
}
