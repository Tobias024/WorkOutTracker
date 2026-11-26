// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartColors } from "@/lib/chart-theme";
import { fmtCompact, fmtNum } from "@/lib/format";

export interface ChartPoint {
  label: string;
  value: number;
}

export function VolumeChart({ data }: { data: ChartPoint[] }) {
  const c = useChartColors();
  // Con menos de 2 períodos con datos no hay tendencia que dibujar: un área
  // plana en 0 no le dice nada a un usuario nuevo.
  if (data.filter((d) => d.value > 0).length < 2) {
    return (
      <p className="text-sm text-muted">
        Necesitás al menos 2 semanas de entrenos para ver la tendencia.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.primary} stopOpacity={0.45} />
            <stop offset="100%" stopColor={c.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          stroke={c.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke={c.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={48}
          allowDecimals={false}
          tickFormatter={(v) => fmtCompact(Number(v))}
        />
        <Tooltip
          contentStyle={c.tip}
          labelStyle={{ color: c.tipLabel }}
          itemStyle={{ color: c.tip.color }}
          formatter={(value) => [`${fmtNum(Number(value))} kg`, "Volumen"]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={c.primary}
          strokeWidth={2}
          fill="url(#vol)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
