// Capa de contribución muscular fraccional (atribución de volumen por grupo).
//
// Reemplaza el viejo `muscleContributions` (que dividía 1/n, 0.5/n). Resuelve la
// contribución de un ejercicio a cada GRUPO-APP con esta precedencia:
//   1. override por slug (los 28 que el usuario entrena)  → fracciones curadas
//   2. derivado de primary/secondary de free-exercise-db  → 1.0 / 0.35 plano
// En ambos casos se aplica el SPLIT del deltoides: `shoulders` (un único músculo
// en el dataset) se reparte en anterior/lateral/posterior según name+force.
//
// La clave de grupo es la misma cadena que los músculos base en inglés
// (chest, lats, …) más las 3 cabezas del deltoides; el español lo pone muscleEs().
// Nada de esto vive en la DB: es 100% TS, como el resto de las métricas.

import type { Exercise } from "@/lib/types";

export const FRONT_DELTS = "front delts";
export const SIDE_DELTS = "side delts";
export const REAR_DELTS = "rear delts";

/** Peso plano de un secundario derivado (no dividido). */
const SECONDARY_FALLBACK = 0.35;
/** Un empuje vertical de hombro recluta algo de deltoide lateral. */
const PRESS_SIDE_DELT = 0.3;

export type Contribution = { muscle: string; weight: number };

type ExLike = Pick<
  Exercise,
  "slug" | "name" | "force" | "mechanic" | "primary_muscles" | "secondary_muscles"
>;

// ── Split del deltoides (shoulders → cabeza) ─────────────────────────────────

const isRow = (n: string) => /\brow\b/.test(n);
/** Empuje vertical de hombro (para el bump de deltoide lateral). */
const isVerticalPress = (n: string) =>
  /press|military|overhead|\bjerk\b|arnold/.test(n);

/**
 * Deriva la cabeza del deltoides desde `name` (+ si es un remo con shoulders
 * secundario). Prioridad: posterior > lateral > anterior > (default anterior).
 * `role` distingue el caso "remo con shoulders secundario" → posterior.
 */
export function deltoidHead(ex: ExLike, role: "primary" | "secondary"): string {
  const n = (ex.name ?? "").toLowerCase();
  // 1. Posterior
  if (
    /\brear\b|reverse fly|reverse flye|rear delt|rear lateral|face pull|band pull apart|reverse machine|external rotation|bent[- ]over.*(raise|lateral)/.test(
      n,
    ) ||
    (role === "secondary" && isRow(n))
  )
    return REAR_DELTS;
  // 2. Lateral
  if (/lateral raise|side lateral|side raise|\bupright\b|scaption|deltoid raise|cuban/.test(n))
    return SIDE_DELTS;
  // 3. Anterior (todo empuje vertical)
  if (/press|military|overhead|push press|\bjerk\b|arnold|front raise|front .*raise/.test(n))
    return FRONT_DELTS;
  // 4. Default / ambiguo (circles, stretches, "shoulder raise" sin más).
  return FRONT_DELTS;
}

/** Mapea un músculo base a su grupo-app, aplicando el split de deltoides. */
export function baseToGroup(
  muscle: string,
  ex: ExLike,
  role: "primary" | "secondary",
): string {
  return muscle === "shoulders" ? deltoidHead(ex, role) : muscle;
}

// ── Overrides por slug (los 28 ejercicios del usuario) ───────────────────────
// Ganan sobre cualquier dato de la base: llenan los secundarios vacíos de los
// custom y aplican fracciones + split. Motor primario = 1.0; secundarios 0.2–0.5.

const O = (...cs: [string, number][]): Contribution[] =>
  cs.map(([muscle, weight]) => ({ muscle, weight }));

export const EXERCISE_OVERRIDES: Record<string, Contribution[]> = {
  // Pecho
  "hip5d-d1e1": O(["chest", 1], ["triceps", 0.5], [FRONT_DELTS, 0.4]), // Press banca con barra
  "hip5d-d1e2": O(["chest", 1], [FRONT_DELTS, 0.5], ["triceps", 0.4]), // Press inclinado con mancuernas
  Dumbbell_Flyes: O(["chest", 1], [FRONT_DELTS, 0.2]),
  "hip5d-d1e4": O(["chest", 1], ["triceps", 0.5], [FRONT_DELTS, 0.3]), // Fondos en paralelas / asistidos
  // Hombros
  "hip5d-d4e1": O([FRONT_DELTS, 1], [SIDE_DELTS, 0.3], ["triceps", 0.5]), // Press militar con mancuernas
  Dumbbell_Shoulder_Press: O([FRONT_DELTS, 1], [SIDE_DELTS, 0.3], ["triceps", 0.5]),
  "hip5d-d4e3": O([FRONT_DELTS, 1], [SIDE_DELTS, 0.4], ["triceps", 0.5]), // Press Arnold
  "hip5d-d4e2": O([SIDE_DELTS, 1]), // Elevaciones laterales
  "hip5d-d4e4": O([REAR_DELTS, 1]), // Posterior en máquina (pájaros)
  "hip5d-d2e4": O([REAR_DELTS, 1], ["traps", 0.3]), // Face pull (custom)
  // Espalda
  "hip5d-d2e1": O(["lats", 1], ["biceps", 0.5]), // Jalón al pecho (polea alta)
  "hip5d-d2e2": O(["middle back", 1], ["lats", 0.5], ["biceps", 0.4], [REAR_DELTS, 0.3], ["traps", 0.3]), // Remo con barra
  "hip5d-d2e3": O(["middle back", 1], ["lats", 0.5], ["biceps", 0.4]), // Remo en polea baja
  "One-Arm_Dumbbell_Row": O(["middle back", 1], ["lats", 0.5], ["biceps", 0.4], [REAR_DELTS, 0.3]),
  // Bíceps
  "hip5d-d5e1": O(["biceps", 1], ["forearms", 0.3]), // Curl con barra
  Barbell_Curl: O(["biceps", 1], ["forearms", 0.3]),
  "hip5d-d5e5": O(["biceps", 1]), // Curl banco Scott
  "hip5d-d5e3": O(["biceps", 1], ["forearms", 0.5]), // Curl martillo con mancuernas
  // Tríceps
  "EZ-Bar_Skullcrusher": O(["triceps", 1], ["forearms", 0.2]),
  "hip5d-d5e4": O(["triceps", 1]), // Extensión de tríceps en polea
  // Piernas
  "hip5d-d3e2": O(["quadriceps", 1], ["glutes", 0.5]), // Prensa
  "hip5d-d3e1": O(["quadriceps", 1], ["glutes", 0.5], ["hamstrings", 0.3], ["lower back", 0.3]), // Sentadilla con barra
  "hip5d-d3e4": O(["hamstrings", 1]), // Curl femoral en máquina
  "hip5d-d3e3": O(["hamstrings", 1], ["glutes", 0.5], ["lower back", 0.4]), // Peso muerto rumano
  "hip5d-d3e5": O(["calves", 1]), // Elevación de gemelos
  Smith_Machine_Calf_Raise: O(["calves", 1]),
  // Abdominales
  "Bent-Knee_Hip_Raise": O(["abdominals", 1]),
  Flat_Bench_Lying_Leg_Raise: O(["abdominals", 1]),
};

// ── Resolver de contribución (modelo de VOLUMEN) ─────────────────────────────

const accMax = (m: Map<string, number>, k: string, w: number) =>
  m.set(k, Math.max(m.get(k) ?? 0, w));

/**
 * Contribución fraccional del ejercicio a cada grupo-app (peso 0..1 por serie).
 * Precedencia override → derivado; con split de deltoides. Reemplaza al viejo
 * reparto 1/n · 0.5/n. La clave `muscle` es el grupo-app (inglés + 3 deltoides).
 */
export function muscleContributions(ex: ExLike): Contribution[] {
  const ov = EXERCISE_OVERRIDES[ex.slug];
  if (ov) return ov;

  const acc = new Map<string, number>();
  for (const m of ex.primary_muscles ?? []) {
    const g = baseToGroup(m, ex, "primary");
    accMax(acc, g, 1);
    // Empuje vertical con hombro primario: sumar deltoide lateral parcial
    // (solo presses reales; no elevaciones frontales ni ambiguos).
    if (g === FRONT_DELTS && isVerticalPress((ex.name ?? "").toLowerCase()))
      accMax(acc, SIDE_DELTS, PRESS_SIDE_DELT);
  }
  for (const m of ex.secondary_muscles ?? [])
    accMax(acc, baseToGroup(m, ex, "secondary"), SECONDARY_FALLBACK);

  return [...acc.entries()].map(([muscle, weight]) => ({ muscle, weight }));
}
