// SPDX-License-Identifier: AGPL-3.0-only
import type { HistorySession } from "@/hooks/useHistory";
import type { Exercise } from "@/lib/types";
import type { SheetSpec, SheetCell } from "@/lib/export-xlsx";
import { estimate1RM, sessionDate, isCountableSet } from "@/lib/metrics";
import { muscleEs, equipmentEs } from "@/lib/i18n-exercise";

/**
 * Arma las 4 hojas del template de rutina (IA-friendly): Instrucciones, Rutina
 * (para llenar), Ejercicios (catálogo con slugs) y Progreso (tu avance real,
 * para que una IA arme cargas realistas). Se descarga con `downloadWorkbook`.
 */
export function buildRoutineTemplate(
  exercises: Exercise[],
  sessions: HistorySession[],
  exMap: Map<string, Exercise>,
): SheetSpec[] {
  // Progreso por ejercicio: mejor 1RM estimado + último peso/reps + veces.
  type Prog = {
    bestE1rm: number;
    lastW: number | null;
    lastR: number | null;
    lastDate: string;
    count: number;
  };
  const prog = new Map<string, Prog>();
  for (const s of sessions) {
    const date = sessionDate(s);
    for (const we of s.workout_exercises) {
      for (const set of we.workout_sets) {
        if (!isCountableSet(set)) continue;
        const e = estimate1RM(set.weight ?? 0, set.reps ?? 0);
        const cur = prog.get(we.exercise_id);
        if (!cur) {
          prog.set(we.exercise_id, {
            bestE1rm: e,
            lastW: set.weight,
            lastR: set.reps,
            lastDate: date,
            count: 1,
          });
        } else {
          cur.bestE1rm = Math.max(cur.bestE1rm, e);
          cur.count += 1;
          if (date > cur.lastDate) {
            cur.lastDate = date;
            cur.lastW = set.weight;
            cur.lastR = set.reps;
          }
        }
      }
    }
  }
  const progRows: SheetCell[][] = [
    ["slug", "ejercicio", "mejor_1rm_est_kg", "ultimo_peso_kg", "ultimas_reps", "veces"],
    ...[...prog.entries()]
      .map(([exId, p]): SheetCell[] => {
        const ex = exMap.get(exId);
        return [
          ex?.slug ?? "",
          ex?.name ?? "",
          Math.round(p.bestE1rm),
          p.lastW ?? "",
          p.lastR ?? "",
          p.count,
        ];
      })
      .sort((a, b) => Number(b[5]) - Number(a[5])),
  ];

  const catRows: SheetCell[][] = [
    ["slug", "nombre", "musculo_primario", "equipo"],
    ...exercises.map((ex): SheetCell[] => [
      ex.slug,
      ex.name,
      ex.primary_muscles[0] ? muscleEs(ex.primary_muscles[0]) : "",
      ex.equipment ? equipmentEs(ex.equipment) : "",
    ]),
  ];

  const rutinaRows: SheetCell[][] = [
    // Las columnas nuevas van AL FINAL a propósito: el parser lee por índice,
    // así que intercalarlas rompería las plantillas ya descargadas.
    ["slug", "ejercicio", "serie", "reps", "peso_kg", "duracion_seg", "distancia_m"],
    ["Barbell_Bench_Press", "Press de banca con barra (ejemplo)", 1, 8, 60, "", ""],
    ["Barbell_Bench_Press", "Press de banca con barra (ejemplo)", 2, 8, 60, "", ""],
    ["Barbell_Bench_Press", "Press de banca con barra (ejemplo)", 3, 6, 65, "", ""],
  ];

  const instrucciones: SheetCell[][] = [
    ["Cómo armar tu rutina para importar a WOLF"],
    [""],
    ["1) Completá la hoja 'Rutina': una fila por serie."],
    ["2) 'slug' es la clave que matchea el ejercicio (obligatoria). Copiala de la hoja 'Ejercicios'."],
    ["3) 'ejercicio' es solo tu referencia; el import matchea por slug (si falta, intenta por nombre)."],
    ["4) 'serie' es el número (1,2,3...). 'reps' y 'peso_kg' son objetivos (el peso es opcional)."],
    ["4b) Para ejercicios por tiempo o distancia, usá 'duracion_seg' (en segundos) y 'distancia_m' (en metros) en vez de reps/peso."],
    ["5) Repetí el mismo slug en varias filas (una por serie). El orden de aparición define el orden en la rutina."],
    ["6) Borrá las filas de ejemplo antes de importar."],
    [""],
    [`Hoja 'Ejercicios': catálogo con todos los slugs válidos (${exercises.length}).`],
    ["Hoja 'Progreso': tu avance actual (1RM estimado, último peso/reps por ejercicio) para armar cargas realistas."],
    [""],
    ["Al importar se crea una rutina nueva. Los pesos son objetivos del plan; podés dejarlos vacíos."],
  ];

  return [
    { name: "Instrucciones", rows: instrucciones },
    { name: "Rutina", rows: rutinaRows },
    { name: "Ejercicios", rows: catRows },
    { name: "Progreso", rows: progRows },
  ];
}
