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

export interface ChartPoint {
  label: string;
  value: number;
}

export function VolumeChart({ data }: { data: ChartPoint[] }) {
  const c = useChartColors();
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
          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
        />
        <Tooltip
          contentStyle={c.tip}
          labelStyle={{ color: c.tipLabel }}
          formatter={(value) => [`${Math.round(Number(value))} kg`, "Volumen"]}
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
