"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useChartColors } from "@/lib/chart-theme";

export interface MusclePoint {
  label: string;
  value: number;
}

// Paleta categórica validada para superficie oscura (skill dataviz, columna
// "Dark"), en orden fijo (el orden ES el mecanismo de separación CVD, no cosmético).
const COLORS = [
  "#3987e5", // azul
  "#199e70", // aqua
  "#c98500", // amarillo
  "#9085e9", // violeta
  "#e66767", // rojo
  "#d55181", // magenta
  "#d95926", // naranja
];
const OTHER_COLOR = "#898781"; // muted: "Otros"
const MAX_SLICES = 7;

/** Donut categórico de distribución (ej. sets por músculo). Colores por identidad
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
    label === "Otros" ? OTHER_COLOR : COLORS[i % COLORS.length];

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
              formatter={(value, name) => {
                const v = Number(value);
                return [
                  `${v} sets · ${Math.round((v / total) * 100)}%`,
                  String(name),
                ];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex-1 min-w-0 flex flex-col gap-1.5">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 rounded-sm shrink-0"
              style={{ background: colorFor(s.label, i) }}
            />
            <span className="truncate flex-1">{s.label}</span>
            <span className="text-muted tabular-nums shrink-0">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
