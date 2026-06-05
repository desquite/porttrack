"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

type Props = {
  aconiers: string[];
  selected: string | null;
};

export function AconierFilter({ aconiers, selected }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const p = new URLSearchParams(sp.toString());
    if (value === "") p.delete("aconier");
    else p.set("aconier", value);
    startTransition(() => router.replace(`${pathname}?${p.toString()}`));
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Aconier :</span>
      <select
        value={selected ?? ""}
        onChange={onChange}
        disabled={pending}
        className="h-9 rounded-md border bg-background px-2 text-sm min-w-44"
      >
        <option value="">Tous les aconiers</option>
        {aconiers.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
    </label>
  );
}
