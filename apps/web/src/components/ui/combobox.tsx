"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { normalizeForSearch } from "@porttrack/shared";

export type ComboboxOption = { id: string; label: string };

type Props = {
  /** name du champ — un <input type="hidden"> est rendu pour la soumission du form */
  name: string;
  options: ComboboxOption[];
  defaultValue?: string;
  placeholder?: string;
  /** texte du champ de recherche */
  searchPlaceholder?: string;
  /** libellé de l'option « vide » (ex. « — Non assigné — »). Si absent, pas d'option vide. */
  emptyOptionLabel?: string;
  required?: boolean;
  invalid?: boolean;
  id?: string;
  className?: string;
  /** Notifie le parent à chaque changement de sélection (mode semi-contrôlé). */
  onValueChange?: (value: string) => void;
};

/**
 * Select recherchable (combobox). Rendu 100 % client mais compatible avec les
 * <form> server actions : la valeur sélectionnée est portée par un input hidden
 * du même `name`. Recherche tolérante aux accents/casse (via normalizeForSearch,
 * cohérent avec le reste de l'app).
 */
export function Combobox({
  name,
  options,
  defaultValue = "",
  placeholder = "— Sélectionner —",
  searchPlaceholder = "Rechercher…",
  emptyOptionLabel,
  required,
  invalid,
  id,
  className,
  onValueChange,
}: Props) {
  const reactId = useId();
  const fieldId = id ?? `${name}-${reactId}`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(defaultValue);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = useMemo(
    () => options.find((o) => o.id === selectedId)?.label ?? "",
    [options, selectedId],
  );

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    if (!q) return options;
    return options.filter((o) => normalizeForSearch(o.label).includes(q));
  }, [options, query]);

  // Fermeture au clic extérieur + Échap
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Focus auto du champ de recherche à l'ouverture
  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const choose = (value: string) => {
    setSelectedId(value);
    setOpen(false);
    onValueChange?.(value);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {/* Valeur soumise dans le form */}
      <input type="hidden" name={name} value={selectedId} required={required} />

      <button
        type="button"
        id={fieldId}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-left text-sm shadow-sm",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          invalid && "border-rose-500 focus-visible:ring-rose-500",
        )}
      >
        <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
          {selectedLabel || placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          {/* Champ de recherche */}
          <div className="flex items-center gap-2 border-b px-2.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Effacer la recherche"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Liste */}
          <ul role="listbox" className="max-h-60 overflow-y-auto p-1">
            {emptyOptionLabel !== undefined && (
              <OptionRow
                label={emptyOptionLabel}
                muted
                selected={selectedId === ""}
                onClick={() => choose("")}
              />
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Aucun résultat
              </li>
            ) : (
              filtered.map((o) => (
                <OptionRow
                  key={o.id}
                  label={o.label}
                  selected={selectedId === o.id}
                  onClick={() => choose(o.id)}
                />
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function OptionRow({
  label,
  selected,
  muted,
  onClick,
}: {
  label: string;
  selected: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onClick}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm",
          "hover:bg-accent hover:text-accent-foreground",
          selected && "bg-accent/60 font-medium",
          muted && "text-muted-foreground",
        )}
      >
        <span className="truncate">{label}</span>
        {selected && <Check className="size-4 shrink-0 text-primary" />}
      </button>
    </li>
  );
}
