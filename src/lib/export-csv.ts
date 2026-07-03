import type { HistorySession } from "@/hooks/useHistory";
import { effectiveDrops, sessionDate, dateKey } from "@/lib/metrics";
import { muscleEs } from "@/lib/i18n-exercise";
import type { Exercise } from "@/lib/types";

function csvCell(value: string | number | null): string {
  const s = value == null ? "" : String(value);
  // Escapa comillas y envuelve si hay coma, comilla o salto de línea.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Arma un CSV con UNA FILA POR SERIE (los drop-sets se aplanan: cada bajada es
 * su propia fila). Reusa la fecha efectiva de la sesión y la traducción de músculo.
 */
export function buildSessionsCsv(
  sessions: HistorySession[],
  exMap: Map<string, Exercise>,
): string {
  const header = [
    "fecha",
    "sesion",
    "ejercicio",
    "musculo",
    "serie",
    "reps",
    "peso_kg",
    "volumen_kg",
    "completado",
    "duracion_min",
  ];
  const rows: string[] = [header.map(csvCell).join(",")];

  for (const s of sessions) {
    const fecha = dateKey(sessionDate(s));
    const durMin =
      s.duration_seconds != null ? Math.round(s.duration_seconds / 60) : "";
    for (const we of s.workout_exercises) {
      const ex = exMap.get(we.exercise_id);
      const exName = ex?.name ?? "";
      const muscle = ex?.primary_muscles[0] ? muscleEs(ex.primary_muscles[0]) : "";
      we.workout_sets.forEach((set, si) => {
        const drops = effectiveDrops(set);
        drops.forEach((d) => {
          const vol = d.reps && d.weight ? d.reps * d.weight : 0;
          rows.push(
            [
              fecha,
              s.name,
              exName,
              muscle,
              si + 1,
              d.reps ?? "",
              d.weight ?? "",
              vol,
              set.completed ? "si" : "no",
              durMin,
            ]
              .map(csvCell)
              .join(","),
          );
        });
      });
    }
  }
  return rows.join("\r\n");
}

/** Descarga un string como archivo. UTF-8 con BOM para que Excel respete acentos. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
