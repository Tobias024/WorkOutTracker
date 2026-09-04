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

/**
 * ¿El RIR cargado se quedó tan lejos del fallo que la serie no cuenta como
 * efectiva para el objetivo? Mismo umbral que `isHardSet` (`hardSetMaxRir`), así
 * que la UI y el conteo de volumen dicen lo mismo.
 *
 * Es el espejo del piso de reps de `repDeviation`: en hipertrofia una serie con
 * RIR 4 no suma volumen efectivo, y dejarla en gris "neutro" no comunicaba que
 * hay algo que corregir. Robinson et al. 2024 (ref "19") es lo que lo sostiene:
 * la hipertrofia mejora cuanto más cerca del fallo. Para fuerza el umbral es
 * más alto (RIR ≤ 4) justamente porque ahí la pendiente del RIR es nula.
 */
export function rirTooFar(
  rir: number | null,
  profile: TrainingProfile | null | undefined,
): boolean {
  return rir != null && rir > goalParams(profile).hardSetMaxRir;
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
  /** La serie tiene bajadas: las reps del tope no son toda la serie. */
  hasDrops = false,
): RepDeviation | null {
  if (actual == null) return null;
  const p = goalParams(profile);

  // Piso absoluto, independiente del plan. Por debajo de `hardSetMinReps` la
  // serie deja de contar como efectiva para el objetivo (mismo umbral que usa
  // isHardSet), así que la carga está alta para lo que buscás — aunque el plan
  // pidiera pocas reps y la desviación entre en la tolerancia.
  //
  // El piso es 5 para hipertrofia, no 8. Schoenfeld et al. 2021 (ref "4")
  // rehizo el continuo de repeticiones y encontró hipertrofia equivalente
  // entre ~5 y ~30 reps con volumen igualado y series cerca del fallo: una
  // serie de 6 está dentro del rango, no es un error de carga. Marcarla sería
  // contradecir el mismo paper que la app cita para elegir cargas.
  //
  // Con bajadas no aplica: el tope es la primera parte de una serie más larga,
  // así que sus reps sueltas no dicen si la carga estuvo bien.
  if (!hasDrops && actual < p.hardSetMinReps)
    return { level: "far", direction: "under" };

  if (planned == null) return null;
  const t = p.repTolerance;
  const diff = actual - planned;
  const d = Math.abs(diff);
  if (d <= t) return { level: "ok", direction: null };
  const direction = diff < 0 ? "under" : "over";
  return { level: d > t * 2 ? "far" : "off", direction };
}

// ── Landmarks de volumen semanal ────────────────────────────────────────────

export interface Landmark {
  /** Mínimo para que el volumen produzca algo medible. */
  mev: number;
  /** Donde arrancan los rendimientos decrecientes. */
  mav: number;
  /** Bandera de costo de recuperación. NO es una cantidad medida — ver abajo. */
  mrv: number;
}

/**
 * Volumen semanal por grupo muscular, en SERIES FRACCIONALES: la unidad que
 * produce `muscleContributions` (1.0 directo / 0.5 indirecto).
 *
 * Esa unidad es el punto. Los valores anteriores venían de Renaissance
 * Periodization, que cuenta SERIES DIRECTAS, y se comparaban contra el conteo
 * fraccional de la app: dos escalas distintas en la misma división. Las anclas
 * de Pelland et al. 2026 (ref "16") están medidas en series fraccionales, o sea
 * exactamente lo que la app calcula, así que ahora numerador y denominador
 * hablan el mismo idioma.
 *
 * Tampoco varían por músculo, y eso también es deliberado: la meta-regresión
 * agrupa todos los músculos, no los desagrega. La tabla vieja daba `chest: 10`
 * y `glutes: 4` como si esa diferencia estuviera medida — no lo está. Un solo
 * par de anclas para todos es menos preciso en apariencia y más honesto, y de
 * paso hace comparables las barras entre grupos.
 *
 * De dónde sale cada número:
 *
 * - **hipertrofia 10 / 16 / 20** — Schoenfeld, Ogborn y Krieger 2017 (ref "1")
 *   agrupó el volumen semanal POR GRUPO MUSCULAR en tres bandas: <9 series →
 *   5,4% de hipertrofia, 10-19 → 6,6%, 20+ → 9,8%, con ~0,37% por serie
 *   semanal. MEV 10 es el piso de la banda productiva, MAV 16 su centro y
 *   MRV 20 donde arranca la banda de alto volumen. Pelland (ref "16") coincide
 *   en que los rendimientos decrecientes empiezan cerca de 11.
 *
 *   OJO con una lectura equivocada que estuvo en este archivo: el "~4 series"
 *   de Pelland NO es un mínimo de entrenamiento. Es el volumen donde el efecto
 *   supera el *smallest detectable effect size*, o sea un piso de DETECCIÓN
 *   ESTADÍSTICA: por debajo hay crecimiento, sólo que demasiado chico para
 *   medirlo con confianza en un meta-análisis. Usarlo como MEV subestima el
 *   volumen necesario por más de la mitad.
 *
 * - **fuerza 6 / 12 / 18** — más bajo que hipertrofia porque Pelland encuentra
 *   para fuerza una meseta funcional que hipertrofia no tiene: los rendimientos
 *   decrecientes son "considerablemente más pronunciados". Ralston et al. 2017
 *   (ref "20") apoya la dirección — bandas baja ≤5, media 5-9, alta ≥10, con la
 *   baja claramente peor (ES 0,82 vs 1,01) — pero sus bandas son POR EJERCICIO
 *   y acá se mide por grupo muscular, así que la traducción es aproximada.
 *   Estos tres valores están interpolados entre ese resultado y la banda de
 *   hipertrofia; son los menos firmes de la tabla.
 *
 * - **resistencia** — NO hay landmarks de volumen semanal para resistencia
 *   local con respaldo comparable. Los papers que sostienen ese perfil en la
 *   app (refs "13"/"14") hablan de reps por serie, no de series por semana.
 *   Se reusan las anclas de hipertrofia como aproximación, y esto se dice acá
 *   en vez de inventar tres números que parezcan medidos.
 *
 * **El MRV no es una cantidad medida.** Pelland encuentra que la curva de
 * hipertrofia nunca se aplana, y en Schoenfeld la banda de 20+ es justamente la
 * que más rinde (9,8%). O sea que "pasarse del MRV" no es hacer algo mal: es
 * entrar en la zona de mayor rendimiento y mayor costo de recuperación. Se
 * mantiene como bandera de costo y la UI lo dice así.
 */
export const GOAL_LANDMARKS: Record<TrainingProfile, Landmark> = {
  hipertrofia: { mev: 10, mav: 16, mrv: 20 },
  fuerza: { mev: 6, mav: 12, mrv: 18 },
  resistencia: { mev: 10, mav: 16, mrv: 20 },
};

export function landmarkFor(
  profile?: TrainingProfile | null,
): Landmark {
  return GOAL_LANDMARKS[profile ?? DEFAULT_TRAINING_PROFILE];
}
