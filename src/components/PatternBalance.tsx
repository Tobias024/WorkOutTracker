// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useChartColors } from "@/lib/chart-theme";
import { fmtNum } from "@/lib/format";

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

/** Veredicto explícito (sin "primero/segundo"). Un lado en 0 es el peor
 *  desbalance posible, así que lo nombra en vez de decir "sin datos". */
function verdict(a: number, b: number, la: string, lb: string): string {
  if (a === 0 && b === 0) return "Sin datos";
  if (b === 0) return `Sin ${lb.toLowerCase()} registrado`;
  if (a === 0) return `Sin ${la.toLowerCase()} registrado`;
  const r = a / b;
  if (r >= 0.8 && r <= 1.25) return "Equilibrado";
  return a > b
    ? `Más ${la.toLowerCase()} que ${lb.toLowerCase()} (×${fmtNum(r, 1)})`
    : `Más ${lb.toLowerCase()} que ${la.toLowerCase()} (×${fmtNum(1 / r, 1)})`;
}

function SplitBar({
  leftLabel,
  rightLabel,
  a,
  b,
  leftColor,
  rightColor,
}: {
  leftLabel: string;
  rightLabel: string;
  a: number;
  b: number;
  leftColor: string;
  rightColor: string;
}) {
  const [la, lb] = pct(a, b);
  const text = verdict(a, b, leftLabel, rightLabel);
  return (
    <div>
      <div className="flex justify-between gap-2 text-xs text-fg mb-1.5">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <span
            className="size-2.5 rounded-sm shrink-0"
            style={{ background: leftColor }}
          />
          {leftLabel} {la}%
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold">
          {rightLabel} {lb}%
          <span
            className="size-2.5 rounded-sm shrink-0"
            style={{ background: rightColor }}
          />
        </span>
      </div>
      {/* gap-0.5: separa los segmentos aunque los colores sean parecidos. */}
      <div
        role="img"
        aria-label={`${leftLabel} ${la}%, ${rightLabel} ${lb}%. ${text}`}
        className="flex gap-0.5 h-2.5 rounded-full overflow-hidden bg-surface-2"
      >
        <div style={{ width: `${la}%`, background: leftColor }} />
        <div style={{ width: `${lb}%`, background: rightColor }} />
      </div>
      <p className="text-xs text-muted mt-1">{text}</p>
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
        leftColor={c.series[0]}
        rightColor={c.series[1]}
      />
      <SplitBar
        leftLabel="Compuesto"
        rightLabel="Aislamiento"
        a={data.compound}
        b={data.isolation}
        leftColor={c.series[0]}
        rightColor={c.neutral}
      />
    </div>
  );
}
