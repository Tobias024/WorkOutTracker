// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Umbrales de entrenamiento por objetivo (`training_profile`).
 *
 * Hasta acá el objetivo era sólo un filtro de display: qué tarjetas se muestran
 * en Registro y qué tabla arranca el scoreboard. Los umbrales que definen "serie
 * efectiva" y "RIR productivo" estaban hardcodeados con los valores de
 * hipertrofia y aplicados a todo el mundo. Este módulo es la única fuente de
 * verdad de esos números; los llamadores le pasan el perfil.
 *
 * Qué respalda cada columna, porque no todas tienen el mismo peso:
 *
 * - RIR por objetivo — evidencia sólida. Robinson et al. 2024 (Sports Med
 *   54:2069-2087, ref "19") meta-regresionó 55 estudios: la hipertrofia mejora
 *   cuanto más cerca del fallo (pendiente negativa, IC excluye el nulo), pero
 *   PARA FUERZA LA PENDIENTE DEL RIR DIO NULA — las ganancias son iguales en un
 *   rango amplio de RIR. De ahí la asimetría: fuerza tolera RIR más alto y
 *   penaliza ir al fallo (fatiga sin rédito), hipertrofia premia acercarse y no
 *   penaliza el fallo. Refalo 2023 (ref "8") sostiene lo mismo por el otro lado:
 *   llegar al fallo real no agrega hipertrofia respecto a dejar reps en reserva.
 *
 * - Pisos de reps — evidencia razonable. Schoenfeld 2021 (ref "4"): fuerza
 *   requiere ≥60% 1RM, así que una serie corta y pesada cuenta igual (piso 1:
 *   para fuerza la moneda de volumen son las series, no las reps — Baz-Valle
 *   2021, ref "7"); hipertrofia rinde en ~5-30 reps (piso 5, el histórico);
 *   la resistencia local pide series largas (refs "13"/"14") → piso 12.
 *
 * - `repTolerance` — NO sale de ningún paper. Es una heurística derivada del
 *   ancho del rango de reps de cada objetivo: fallar 1 rep de 5 es un 20% del
 *   estímulo, fallar 1 de 20 es un 5%. La UI que la use debe decir eso y NO
 *   citar un paper, a diferencia de las otras dos.
 */
import type { TrainingProfile } from "./types";

export interface GoalParams {
  /**
   * RIR por debajo de este valor = más cerca del fallo de lo que el objetivo
   * pide (fatiga que no compra adaptación). `null` = sin penalización por
   * acercarse, que es el caso de hipertrofia según Robinson 2024.
   */
  rirTooCloseBelow: number | null;
  /** RIR máximo de la zona productiva (inclusive). Por encima, "lejos del fallo". */
  rirProductiveMax: number;
  /** RIR máximo para que una serie cuente como efectiva. */
  hardSetMaxRir: number;
  /** Reps mínimas para que una serie cuente como efectiva. */
  hardSetMinReps: number;
  /** Desvío de reps vs. plan tolerado antes de sugerir corregir la carga. */
  repTolerance: number;
}

export const GOAL_PARAMS: Record<TrainingProfile, GoalParams> = {
  fuerza: {
    rirTooCloseBelow: 2,
    rirProductiveMax: 4,
    hardSetMaxRir: 4,
    hardSetMinReps: 1,
    repTolerance: 1,
  },
  hipertrofia: {
    rirTooCloseBelow: null,
    rirProductiveMax: 3,
    hardSetMaxRir: 3,
    hardSetMinReps: 5,
    repTolerance: 2,
  },
  resistencia: {
    rirTooCloseBelow: 1,
    rirProductiveMax: 4,
    hardSetMaxRir: 4,
    hardSetMinReps: 12,
    repTolerance: 3,
  },
};

/**
 * Perfil por defecto cuando el usuario nunca eligió uno. Es hipertrofia a
 * propósito: son los valores que la app venía aplicando hardcodeados (reps ≥ 5,
 * RIR ≤ 3), así que quien no configuró nada no ve cambiar sus números.
 */
export const DEFAULT_TRAINING_PROFILE: TrainingProfile = "hipertrofia";

export function goalParams(profile: TrainingProfile | null | undefined): GoalParams {
  return GOAL_PARAMS[profile ?? DEFAULT_TRAINING_PROFILE];
}

/** Etiqueta corta de la zona de RIR productiva, para los tooltips. Ej. "2-4". */
export function rirProductiveLabel(
  profile: TrainingProfile | null | undefined,
): string {
  const p = goalParams(profile);
  const lo = p.rirTooCloseBelow ?? 0;
  return `${lo}-${p.rirProductiveMax}`;
}

export type RirZone = "danger" | "success" | "muted";

/**
 * Zona de un RIR según el objetivo: `danger` = más cerca del fallo de lo que
 * conviene, `success` = zona productiva, `muted` = lejos del fallo.
 */
export function rirZone(
  rir: number,
  profile: TrainingProfile | null | undefined,
): RirZone {
  const p = goalParams(profile);
  if (p.rirTooCloseBelow != null && rir < p.rirTooCloseBelow) return "danger";
  if (rir <= p.rirProductiveMax) return "success";
  return "muted";
}

/**
 * Desvío de las reps registradas respecto de las planeadas.
 *
 * `level` es la magnitud (y decide el color, con la paleta de MEV) y `direction`
 * la corrección de carga que se sugiere: quedarse corto y pasarse son los dos
 * errores de carga, por eso ambos se marcan; la flecha lleva la dirección para
 * que "hice más reps" no se lea como fracaso.
 */
export interface RepDeviation {
  level: "ok" | "off" | "far";
  /** `under` = faltaron reps → bajá el peso. `over` = sobraron → subilo. */
  direction: "under" | "over" | null;
}

export function repDeviation(
  actual: number | null,
  planned: number | null,
  profile: TrainingProfile | null | undefined,
): RepDeviation | null {
  if (actual == null || planned == null) return null;
  const t = goalParams(profile).repTolerance;
  const diff = actual - planned;
  const d = Math.abs(diff);
  if (d <= t) return { level: "ok", direction: null };
  const direction = diff < 0 ? "under" : "over";
  return { level: d > t * 2 ? "far" : "off", direction };
}
