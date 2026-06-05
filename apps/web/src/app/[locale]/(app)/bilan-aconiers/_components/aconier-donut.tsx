"use client";

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

type Slice = { aconier: string; livres: number };

type Props = { data: Slice[] };

// Palette suffisamment large pour 8-10 aconiers — reprend bleu PORTTRACK + accents
const COLORS = [
  "#1d3557", "#457b9d", "#e63946", "#2a9d8f", "#f4a261",
  "#8338ec", "#06d6a0", "#ef476f", "#118ab2", "#9c6644",
];

export function AconierDonut({ data }: Props) {
  const total = data.reduce((s, d) => s + d.livres, 0);

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="livres"
            nameKey="aconier"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={1}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const v = Number(value);
              const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
              return [`${v} (${pct}%)`, String(name)];
            }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
