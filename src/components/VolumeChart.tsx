"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartPoint {
  label: string;
  value: number;
}

export function VolumeChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          stroke="#a1a1aa"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#a1a1aa"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
        />
        <Tooltip
          contentStyle={{
            background: "#14141b",
            border: "1px solid #2a2a35",
            borderRadius: 12,
            color: "#f4f4f5",
            fontSize: 12,
          }}
          labelStyle={{ color: "#a1a1aa" }}
          formatter={(value) => [`${Math.round(Number(value))} kg`, "Volumen"]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#7c5cff"
          strokeWidth={2}
          fill="url(#vol)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
