"use client";

export interface HeatCell {
  key: string;
  value: number;
}

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

/** Heatmap tipo GitHub: 12 columnas (semanas) × 7 filas (días lun→dom), opacidad del dorado. */
export function ConsistencyHeatmap({
  weeks,
  max,
}: {
  weeks: HeatCell[][]; // cada columna = 7 días (lun→dom)
  max: number;
}) {
  return (
    <div className="flex gap-[3px]">
      {/* Columna de etiquetas de día */}
      <div className="flex flex-col gap-[3px] pr-0.5">
        {DAY_LABELS.map((d, i) => (
          <div
            key={i}
            className="aspect-square grid place-items-center text-[9px] text-muted w-3.5"
          >
            {d}
          </div>
        ))}
      </div>
      {weeks.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-[3px] flex-1 min-w-[8px]">
          {col.map((cell) => {
            const intensity = max > 0 && cell.value > 0 ? cell.value / max : 0;
            const opacity = intensity > 0 ? 0.18 + intensity * 0.82 : 0;
            return (
              <div
                key={cell.key}
                title={`${cell.key}${cell.value > 0 ? ` · ${Math.round(cell.value)} kg` : ""}`}
                className="aspect-square rounded-[3px]"
                style={{
                  background:
                    opacity > 0
                      ? `color-mix(in srgb, var(--color-primary) ${Math.round(opacity * 100)}%, var(--color-surface-2))`
                      : "var(--color-surface-2)",
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
