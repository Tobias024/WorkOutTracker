// SPDX-License-Identifier: AGPL-3.0-only
import type { HistorySession } from "@/hooks/useHistory";
import { effectiveDrops, sessionDate, dateKey, rirOf } from "@/lib/metrics";
import { muscleEs } from "@/lib/i18n-exercise";
import type { Exercise } from "@/lib/types";

function csvCell(value: string | number | null): string {
  const s = value == null ? "" : String(value);
  // Escapa comillas y envuelve si hay coma, comilla o salto de línea.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type Cell = string | number | null;

/**
 * Arma las filas de series (UNA FILA POR SERIE; los drop-sets se aplanan: cada
 * bajada es su propia fila). La primera fila es el encabezado. Reusa la fecha
 * efectiva de la sesión y la traducción de músculo.
 */
export function buildSessionsRows(
  sessions: HistorySession[],
  exMap: Map<string, Exercise>,
): Cell[][] {
  const rows: Cell[][] = [
    [
      "fecha",
      "sesion",
      "ejercicio",
      "musculo",
      "serie",
      "reps",
      "peso_kg",
      "volumen_kg",
      "duracion_s",
      "distancia_m",
      "rir",
      "descanso_s",
      "completado",
      "duracion_min",
    ],
  ];

  for (const s of sessions) {
    const fecha = dateKey(sessionDate(s));
    const durMin =
      s.duration_seconds != null ? Math.round(s.duration_seconds / 60) : "";
    for (const we of s.workout_exercises) {
      const ex = exMap.get(we.exercise_id);
      const exName = ex?.name ?? "";
      const muscle = ex?.primary_muscles[0] ? muscleEs(ex.primary_muscles[0]) : "";
      we.workout_sets.forEach((set, si) => {
        const rir = rirOf(set);
        // Una serie por tiempo o distancia no tiene bajadas (effectiveDrops
        // devuelve []), pero igual tiene que salir en el export: se emite una
        // fila con reps/peso vacíos y la duración/distancia cargadas.
        const drops = effectiveDrops(set);
        const cells = drops.length
          ? drops.map((d) => ({
              reps: d.reps,
              weight: d.weight,
              vol: d.reps && d.weight ? d.reps * d.weight : 0,
            }))
          : [{ reps: null, weight: null, vol: 0 }];
        cells.forEach((c) => {
          rows.push([
            fecha,
            s.name,
            exName,
            muscle,
            si + 1,
            c.reps ?? "",
            c.weight ?? "",
            c.vol,
            set.duration_seconds ?? "",
            set.distance_m ?? "",
            rir ?? "",
            set.rest_seconds ?? "",
            set.completed ? "si" : "no",
            durMin,
          ]);
        });
      });
    }
  }
  return rows;
}

/** Arma un CSV con una fila por serie (mismos datos que `buildSessionsRows`). */
export function buildSessionsCsv(
  sessions: HistorySession[],
  exMap: Map<string, Exercise>,
): string {
  return buildSessionsRows(sessions, exMap)
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
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
