// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useChartColors } from "@/lib/chart-theme";
import { fmtNum } from "@/lib/format";

export interface MusclePoint {
  label: string;
  value: number;
}

const MAX_SLICES = 7;

/** Donut categórico de distribución (ej. series por músculo). Colores por identidad
 *  en orden fijo; el 8°+ se pliega en "Otros". Leyenda siempre presente. */
export function MuscleDonut({ data }: { data: MusclePoint[] }) {
  const c = useChartColors();
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, MAX_SLICES);
  const tail = sorted.slice(MAX_SLICES);
  const slices = [...head];
  if (tail.length) {
    slices.push({
      label: "Otros",
      value: tail.reduce((acc, s) => acc + s.value, 0),
    });
  }
  const total = slices.reduce((acc, s) => acc + s.value, 0) || 1;
  const colorFor = (label: string, i: number) =>
    label === "Otros" ? c.other : c.categorical[i % c.categorical.length];

  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0" style={{ width: 132, height: 132 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={64}
              paddingAngle={2}
              stroke="var(--color-surface)"
              strokeWidth={2}
            >
              {slices.map((s, i) => (
                <Cell key={s.label} fill={colorFor(s.label, i)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={c.tip}
              labelStyle={{ color: c.tipLabel }}
              itemStyle={{ color: c.tip.color }}
              formatter={(value, name) => {
                const v = Number(value);
                return [
                  `${fmtNum(v, 1)} series · ${Math.round((v / total) * 100)}%`,
                  String(name),
                ];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex-1 min-w-0 flex flex-col gap-1.5">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-start gap-2 text-sm">
            <span
              className="size-3 rounded-sm shrink-0 mt-1"
              style={{ background: colorFor(s.label, i) }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{s.label}</span>
              <span className="block text-xs text-muted tabular-nums">
                {fmtNum(s.value, 1)} {s.value === 1 ? "serie" : "series"} ·{" "}
                {Math.round((s.value / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
