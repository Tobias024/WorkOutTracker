// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useChartColors } from "@/lib/chart-theme";

export interface BalanceData {
  push: number;
  pull: number;
  compound: number;
  isolation: number;
}

function pct(a: number, b: number): [number, number] {
  const total = a + b;
  if (total === 0) return [0, 0];
  return [Math.round((a / total) * 100), Math.round((b / total) * 100)];
}

function ratioLabel(a: number, b: number): string {
  if (a === 0 || b === 0) return "sin datos";
  const r = a / b;
  if (r >= 0.8 && r <= 1.25) return "equilibrado";
  return a > b ? "sesgo al primero" : "sesgo al segundo";
}

function SplitBar({
  leftLabel,
  rightLabel,
  a,
  b,
  leftColor,
  rightColor,
  note,
}: {
  leftLabel: string;
  rightLabel: string;
  a: number;
  b: number;
  leftColor: string;
  rightColor: string;
  note: string;
}) {
  const [la, lb] = pct(a, b);
  return (
    <div>
      <div className="flex justify-between text-[11.5px] mb-1.5">
        <span className="font-semibold text-accent">
          {leftLabel} {la}%
        </span>
        <span className="text-muted">{note}</span>
        <span className="font-semibold text-primary">
          {rightLabel} {lb}%
        </span>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-2">
        <div style={{ width: `${la}%`, background: leftColor }} />
        <div style={{ width: `${lb}%`, background: rightColor }} />
      </div>
    </div>
  );
}

/** Balance de patrones: empuje/tirón (de `force`) y compuesto/aislamiento (de `mechanic`). */
export function PatternBalance({ data }: { data: BalanceData }) {
  const c = useChartColors();
  const noData =
    data.push + data.pull === 0 && data.compound + data.isolation === 0;
  if (noData) {
    return (
      <p className="text-sm text-muted">
        Sin datos de patrón en los últimos 30 días.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3.5">
      <SplitBar
        leftLabel="Empuje"
        rightLabel="Tirón"
        a={data.push}
        b={data.pull}
        leftColor={c.accent}
        rightColor={c.primary}
        note={ratioLabel(data.push, data.pull)}
      />
      <SplitBar
        leftLabel="Compuesto"
        rightLabel="Aislamiento"
        a={data.compound}
        b={data.isolation}
        leftColor={c.accent}
        rightColor={c.neutral}
        note={ratioLabel(data.compound, data.isolation)}
      />
    </div>
  );
}
