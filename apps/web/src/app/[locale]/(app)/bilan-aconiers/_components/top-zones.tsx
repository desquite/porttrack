"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

type Props = {
  data: Array<{ zone: string; count: number }>;
};

export function TopZones({ data }: Props) {
  return (
    <div className="w-full" style={{ height: Math.max(220, data.length * 32 + 60) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="zone"
            tick={{ fontSize: 12 }}
            width={120}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "rgba(29, 53, 87, 0.04)" }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
            formatter={(v) => [`${Number(v)} conteneur(s)`, "Livrés"]}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? "#1d3557" : "#457b9d"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
