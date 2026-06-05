"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

type Props = {
  data: Array<Record<string, string | number>>;
  currentYearKey: string;
  previousYearKey: string | null;
};

const COLOR_CURR = "#1d3557"; // bleu marine PORTTRACK
const COLOR_PREV = "#94a3b8"; // slate-400

export function MonthlyBars({ data, currentYearKey, previousYearKey }: Props) {
  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "rgba(29, 53, 87, 0.04)" }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          {previousYearKey && (
            <Bar
              dataKey={previousYearKey}
              name={previousYearKey}
              fill={COLOR_PREV}
              radius={[4, 4, 0, 0]}
            />
          )}
          <Bar
            dataKey={currentYearKey}
            name={currentYearKey}
            fill={COLOR_CURR}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
