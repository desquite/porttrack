import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { AconierRow } from "@/lib/bilan/aggregate";

type Props = {
  rows: AconierRow[];
  totalCurr: number;
  hasPrev: boolean;
};

const nf = (n: number) => n.toLocaleString("fr-FR");

export function SummaryTable({ rows, totalCurr, hasPrev }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Aucune livraison sur la période.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Aconier</th>
            <th className="py-2 pr-4 font-medium text-right">Livrés</th>
            <th className="py-2 pr-4 font-medium text-right">Part</th>
            <th className="py-2 pr-4 font-medium text-right">20&apos;</th>
            <th className="py-2 pr-4 font-medium text-right">40&apos;</th>
            <th className="py-2 pr-4 font-medium text-right">Autres</th>
            {hasPrev && <th className="py-2 pr-4 font-medium text-right">vs N-1</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.aconier} className="border-b last:border-b-0 hover:bg-muted/30">
              <td className="py-2 pr-4 font-medium">{r.aconier}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{nf(r.livres)}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                {r.partPct.toFixed(1)}%
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">{nf(r.taille20)}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{nf(r.taille40)}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                {nf(r.tailleAutre)}
              </td>
              {hasPrev && (
                <td className="py-2 pr-4 text-right tabular-nums">
                  <VariationCell value={r.variationPct} />
                </td>
              )}
            </tr>
          ))}
          {/* Total */}
          <tr className="bg-muted/30 font-medium">
            <td className="py-2 pr-4">Total</td>
            <td className="py-2 pr-4 text-right tabular-nums">{nf(totalCurr)}</td>
            <td className="py-2 pr-4 text-right tabular-nums">100%</td>
            <td className="py-2 pr-4 text-right tabular-nums">
              {nf(rows.reduce((s, r) => s + r.taille20, 0))}
            </td>
            <td className="py-2 pr-4 text-right tabular-nums">
              {nf(rows.reduce((s, r) => s + r.taille40, 0))}
            </td>
            <td className="py-2 pr-4 text-right tabular-nums">
              {nf(rows.reduce((s, r) => s + r.tailleAutre, 0))}
            </td>
            {hasPrev && <td className="py-2 pr-4" />}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function VariationCell({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="size-3" /> —
      </span>
    );
  }
  if (value >= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <TrendingUp className="size-3" />
        +{value.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-rose-600">
      <TrendingDown className="size-3" />
      {value.toFixed(1)}%
    </span>
  );
}
