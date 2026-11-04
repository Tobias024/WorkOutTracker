// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { clsx } from "@/lib/clsx";
import { fmtSeries } from "@/lib/format";

export interface HeatCell {
  key: string;
  value: number;
}

// Solo L/X/V: con celdas de ~20px los 7 labels no entran legibles.
const DAY_LABELS = ["L", "", "X", "", "V", "", ""];

function parseKey(key: string): Date {
  // Mediodía local: evita el corrimiento de día de `new Date("YYYY-MM-DD")` (UTC).
  return new Date(`${key}T12:00:00`);
}

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Mar 14 oct" */
function captionDate(key: string): string {
  const d = parseKey(key);
  const wd = d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "");
  const mon = d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${d.getDate()} ${mon}`;
}

function monthShort(key: string): string {
  return parseKey(key)
    .toLocaleDateString("es-AR", { month: "short" })
    .replace(".", "");
}

/** Color de la celda según la intensidad (0–1): opacidad del color primario. */
function cellBg(intensity: number): string {
  if (intensity <= 0) return "var(--color-surface-2)";
  const opacity = 0.18 + intensity * 0.82;
  return `color-mix(in srgb, var(--color-primary) ${Math.round(opacity * 100)}%, var(--color-surface-2))`;
}

/** Heatmap tipo GitHub: 12 columnas (semanas) × 7 filas (días lun→dom), opacidad del dorado.
 *  Las celdas son botones: tocar una muestra el detalle abajo (el `title` no
 *  existe en touch). */
export function ConsistencyHeatmap({
  weeks,
  max,
}: {
  weeks: HeatCell[][]; // cada columna = 7 días (lun→dom)
  max: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  // Inicializador perezoso: "hoy" se fija al montar y no ensucia el render.
  const [today] = useState(() => localKey(new Date()));

  const past = weeks.flat().filter((c) => c.key <= today);
  const trained = past.filter((c) => c.value > 0).length;
  const sel = selected ? weeks.flat().find((c) => c.key === selected) : null;

  return (
    <div>
      <div
        role="group"
        aria-label={`Entrenaste ${trained} de los últimos ${past.length} días`}
        className="flex gap-[3px]"
      >
        {/* Columna de etiquetas de día — mismo dimensionado (flex-1 + aspect-square)
            que las columnas de datos para que cada fila alinee en altura. */}
        <div className="flex flex-col gap-[3px] flex-1 min-w-[8px]">
          <div className="h-4" aria-hidden />
          {DAY_LABELS.map((d, i) => (
            <div
              key={i}
              aria-hidden
              className="aspect-square grid place-items-center text-2xs text-muted"
            >
              {d}
            </div>
          ))}
        </div>
        {weeks.map((col, ci) => {
          const month = col[0] ? monthShort(col[0].key) : "";
          const prev = ci > 0 && weeks[ci - 1][0] ? monthShort(weeks[ci - 1][0].key) : null;
          // Rótulo de mes solo donde cambia; se omite en la última columna
          // porque se saldría del contenedor.
          const showMonth = month !== prev && ci < weeks.length - 1;
          return (
            <div key={ci} className="flex flex-col gap-[3px] flex-1 min-w-[8px]">
              <div className="h-4 text-2xs text-muted whitespace-nowrap leading-4" aria-hidden>
                {showMonth ? month : ""}
              </div>
              {col.map((cell) => {
                const intensity = max > 0 && cell.value > 0 ? cell.value / max : 0;
                const style = { background: cellBg(intensity) };
                if (cell.key > today) {
                  return (
                    <div
                      key={cell.key}
                      aria-hidden
                      className="aspect-square rounded-[3px] opacity-40"
                      style={style}
                    />
                  );
                }
                const n = Math.round(cell.value);
                return (
                  <button
                    key={cell.key}
                    type="button"
                    aria-label={`${captionDate(cell.key)}: ${n > 0 ? fmtSeries(n, 0) : "sin entrenar"}`}
                    aria-pressed={selected === cell.key}
                    onClick={() => setSelected(selected === cell.key ? null : cell.key)}
                    className={clsx(
                      "aspect-square rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      selected === cell.key && "ring-2 ring-fg",
                    )}
                    style={style}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 mt-2.5">
        <p className="text-xs text-muted min-w-0" aria-live="polite">
          {sel
            ? `${captionDate(sel.key)} · ${Math.round(sel.value) > 0 ? fmtSeries(Math.round(sel.value), 0) : "sin entrenar"}`
            : "Tocá un día para ver el detalle"}
        </p>
        <div className="flex items-center gap-1 text-2xs text-muted shrink-0" aria-hidden>
          Menos
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <span
              key={v}
              className="size-3 rounded-[3px]"
              style={{ background: cellBg(v) }}
            />
          ))}
          Más
        </div>
      </div>
    </div>
  );
}
