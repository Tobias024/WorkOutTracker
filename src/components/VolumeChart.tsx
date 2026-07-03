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
            <stop offset="0%" stopColor="#cda548" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#cda548" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          stroke="#9c9a92"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#9c9a92"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
        />
        <Tooltip
          contentStyle={{
            background: "#1c1c1a",
            border: "1px solid #2e2c27",
            borderRadius: 8,
            color: "#f2f1ed",
            fontSize: 12,
          }}
          labelStyle={{ color: "#9c9a92" }}
          formatter={(value) => [`${Math.round(Number(value))} kg`, "Volumen"]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#cda548"
          strokeWidth={2}
          fill="url(#vol)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
