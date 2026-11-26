// SPDX-License-Identifier: AGPL-3.0-only
import type { HistorySessionFull } from "@/hooks/useHistory";
import { effectiveDrops, sessionDate, dateKey, rirOf } from "@/lib/metrics";
import { muscleEs } from "@/lib/i18n-exercise";
import { primaryMuscle } from "@/lib/muscle-contributions";
import type { Exercise } from "@/lib/types";


type Cell = string | number | null;

/**
 * Arma las filas de series (UNA FILA POR SERIE; los drop-sets se aplanan: cada
 * bajada es su propia fila). La primera fila es el encabezado. Reusa la fecha
 * efectiva de la sesión y la traducción de músculo.
 */
export function buildSessionsRows(
  sessions: HistorySessionFull[],
  exMap: Map<string, Exercise>,
  /** Nota fija por ejercicio (`user_exercise_notes`), indexada por exercise_id. */
  notes?: Map<string, string>,
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
      // Al final, como el resto de las columnas agregadas: el orden posicional
      // es parte del contrato con quien ya tiene el archivo viejo.
      "plan_reps",
      "plan_peso_kg",
      "comentario",
      "nota_ejercicio",
      "bajada",
    ],
  ];

  for (const s of sessions) {
    const fecha = dateKey(sessionDate(s));
    const durMin =
      s.duration_seconds != null ? Math.round(s.duration_seconds / 60) : "";
    for (const we of s.workout_exercises) {
      const ex = exMap.get(we.exercise_id);
      const exName = ex?.name ?? "";
      // Mismo mapeo que usan las métricas: si el export dijera otra cosa, la
      // IA que lo lee sacaría conclusiones sobre un reparto que la app no usa.
      const muscle = ex ? muscleEs(primaryMuscle(ex)) : "";
      const note = notes?.get(we.exercise_id) ?? "";
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
        cells.forEach((c, ci) => {
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
            set.planned_reps ?? "",
            set.planned_weight ?? "",
            // El comentario es de la SERIE, no de cada bajada: repetirlo en las
            // filas de un drop-set parecerían tres comentarios distintos.
            ci === 0 ? (set.comment ?? "") : "",
            ci === 0 ? note : "",
            // 0 = la serie base; 1…n = cada bajada del drop-set. Sin esto las
            // filas de un drop-set se confunden con series repetidas.
            ci,
          ]);
        });
      });
    }
  }
  return rows;
}
