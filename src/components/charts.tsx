// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { clsx } from "@/lib/clsx";
import { useChartColors } from "@/lib/chart-theme";

export interface LinePoint {
  /** Epoch ms del bucket/medición: ordena y alinea (la etiqueta d/m no tiene año). */
  t: number;
  /** Etiqueta para mostrar (d/m). */
  label: string;
  value: number;
}

const fmtDM = (t: number) => {
  const d = new Date(t);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

/** Devuelve el formateador de ticks/tooltip: "d/m" y, sólo si los datos cruzan
 *  un año calendario, "d/m 'aa". */
function makeDateFmt(ts: number[]): (t: number) => string {
  const years = new Set(ts.map((t) => new Date(t).getFullYear()));
  if (years.size <= 1) return fmtDM;
  return (t) => `${fmtDM(t)} '${String(new Date(t).getFullYear()).slice(-2)}`;
}

/** Línea simple (dorada). `faint` dibuja una serie tenue detrás (ej. peso crudo). */
export function MiniLine({
  data,
  faint,
  height = 170,
  unit = "",
  domain,
}: {
  data: LinePoint[];
  faint?: LinePoint[];
  height?: number;
  unit?: string;
  /** Dominio del eje Y (ej. ["dataMin - 1", "dataMax + 1"] para ceñir). */
  domain?: [number | string, number | string];
}) {
  const c = useChartColors();
  const fmt = makeDateFmt(data.map((d) => d.t));
  const merged = data.map((d, i) => ({
    t: d.t,
    value: d.value,
    faint: faint?.[i]?.value,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={merged} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
        <XAxis
          dataKey="t"
          tickFormatter={(t) => fmt(Number(t))}
          stroke={c.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={22}
        />
        <YAxis
          stroke={c.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={40}
          domain={domain}
        />
        <Tooltip
          contentStyle={c.tip}
          labelStyle={{ color: c.tipLabel }}
          labelFormatter={(t) => fmt(Number(t))}
          formatter={(v) => [`${v}${unit ? ` ${unit}` : ""}`, ""]}
        />
        {faint && (
          <Line
            type="monotone"
            dataKey="faint"
            stroke={c.axis}
            strokeWidth={1}
            dot={false}
            opacity={0.35}
          />
        )}
        <Line type="monotone" dataKey="value" stroke={c.primary} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Varias líneas (una por serie). Alinea por fecha (t). */
export function MultiLine({
  series,
  height = 190,
  unit = "",
}: {
  series: { name: string; points: LinePoint[] }[];
  height?: number;
  unit?: string;
}) {
  const c = useChartColors();
  const times = [...new Set(series.flatMap((s) => s.points.map((p) => p.t)))].sort(
    (a, b) => a - b,
  );
  const fmt = makeDateFmt(times);
  const rows = times.map((t) => {
    const row: Record<string, number | null> = { t };
    series.forEach((s, i) => {
      row["s" + i] = s.points.find((p) => p.t === t)?.value ?? null;
    });
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
        <XAxis
          dataKey="t"
          tickFormatter={(t) => fmt(Number(t))}
          stroke={c.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={22}
        />
        <YAxis
          stroke={c.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={c.tip}
          labelStyle={{ color: c.tipLabel }}
          labelFormatter={(t) => fmt(Number(t))}
          formatter={(v, _n, p) => [
            `${v}${unit ? ` ${unit}` : ""}`,
            (p as { name?: string })?.name ?? "",
          ]}
        />
        {series.map((s, i) => (
          <Line
            key={i}
            type="monotone"
            dataKey={"s" + i}
            name={s.name}
            stroke={c.series[i % c.series.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Sparkline mínima (sin ejes), para grillas de muchos ejercicios. */
export function Sparkline({ data, height = 34 }: { data: LinePoint[]; height?: number }) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 3, right: 2, left: 2, bottom: 3 }}>
        <Line type="monotone" dataKey="value" stroke={c.primary} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Barra apilada 100% con leyenda (para distribuciones). */
export function StackedBar({
  segments,
}: {
  segments: { label: string; value: number; className: string }[];
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3.5 rounded-full overflow-hidden bg-surface-2">
        {segments.map(
          (s, i) =>
            s.value > 0 && (
              <div
                key={i}
                className={s.className}
                style={{ width: `${(s.value / total) * 100}%` }}
              />
            ),
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-muted">
        {segments.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <span className={clsx("size-2 rounded-full", s.className)} />
            {s.label} {Math.round((s.value / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barras horizontales simples (para frecuencia por patrón, etc.). */
export function HBars({
  rows,
  unit = "",
}: {
  rows: { label: string; value: number }[];
  unit?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-24 shrink-0 text-muted text-xs">{r.label}</span>
          <div className="flex-1 h-4 rounded bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-primary/70"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
          <span className="w-14 text-right tabular-nums">
            {r.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}
