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
 * OJO — `hardSetMinReps` y `hardSetMaxRir` están escritos DOS VECES: acá y en
 * `is_hard_set()` de `supabase/migrations/0035_hard_sets_by_goal.sql`, porque el
 * ranking los necesita del lado de Postgres (`scoreboard_stats`,
 * `friend_metrics`). Si tocás uno, tocá el otro o el número del ranking se
 * separa del de Registro sin que nada falle. `repRangeMax` NO está en el SQL a
 * propósito: sólo lo usa la sugerencia de carga, no el conteo de volumen.
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
 * - Techos de reps (`repRangeMax`) — Schoenfeld 2021 (ref "4") otra vez:
 *   hipertrofia equivalente hasta ~30 reps; para fuerza el ≥80% 1RM óptimo cae
 *   en ~6 reps máximo — ese 6 es una LECTURA PRÁCTICA del porcentaje, no un
 *   número que el paper escriba. Resistencia no tiene techo con respaldo. El
 *   techo sólo lo usa la sugerencia de carga (`loadAdvice`), NO `isHardSet`: una
 *   serie de 35 reps sigue contando como volumen, sólo que la carga está liviana.
 *
 * - `repTolerance` — NO sale de ningún paper. Es una heurística derivada del
 *   ancho del rango de reps de cada objetivo: fallar 1 rep de 5 es un 20% del
 *   estímulo, fallar 1 de 20 es un 5%. La UI que la use debe decir eso y NO
 *   citar un paper, a diferencia de las otras dos.
 *
 * - La matriz reps × RIR de `loadAdvice` — Helms, Cronin, Storey y Zourdos 2016
 *   (ref "21") para la regla base ("N reps @ RIR X": bajá la carga si no llegás
 *   a las reps, subila si llegás con más RIR del objetivo), y Steele 2017 /
 *   Halperin 2022 (refs "9"/"10") para el cuadrante donde las dos señales se
 *   contradicen. Detalle en el docstring de `loadAdvice`.
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
  /** Reps mínimas para que una serie cuente como efectiva. Es también el piso del rango de reps del objetivo. */
  hardSetMinReps: number;
  /**
   * Techo del rango de reps del objetivo (inclusive); `null` = sin techo. Sólo
   * para la sugerencia de carga: por encima, la carga está liviana para lo que
   * buscás. No afecta a `isHardSet` ni al SQL del ranking.
   */
  repRangeMax: number | null;
  /** Desvío de reps vs. plan tolerado antes de sugerir corregir la carga. */
  repTolerance: number;
}

export const GOAL_PARAMS: Record<TrainingProfile, GoalParams> = {
  fuerza: {
    rirTooCloseBelow: 2,
    rirProductiveMax: 4,
    hardSetMaxRir: 4,
    hardSetMinReps: 1,
    repRangeMax: 6,
    repTolerance: 1,
  },
  hipertrofia: {
    rirTooCloseBelow: null,
    rirProductiveMax: 3,
    hardSetMaxRir: 3,
    hardSetMinReps: 5,
    repRangeMax: 30,
    repTolerance: 2,
  },
  resistencia: {
    rirTooCloseBelow: 1,
    rirProductiveMax: 4,
    hardSetMaxRir: 4,
    hardSetMinReps: 12,
    repRangeMax: null,
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

/** Etiqueta corta del rango de reps del objetivo, para los tooltips. Ej. "5-30", "12+". */
export function repRangeLabel(
  profile: TrainingProfile | null | undefined,
): string {
  const p = goalParams(profile);
  return p.repRangeMax == null
    ? `${p.hardSetMinReps}+`
    : `${p.hardSetMinReps}-${p.repRangeMax}`;
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
 * ¿El plan de la serie cae fuera del rango de reps del objetivo? Un plan de 3
 * reps para hipertrofia, o de 12 para fuerza. `loadAdvice` lo ignora en ese caso
 * (el objetivo pasa a ser el rango del goal entero) y la UI lo avisa, en la
 * sesión y en el editor de rutina: la app no acompaña en silencio un plan mal
 * armado, lo señala donde nace.
 */
export function planOutOfRange(
  planned: number | null | undefined,
  profile: TrainingProfile | null | undefined,
): boolean {
  if (planned == null) return false;
  const p = goalParams(profile);
  if (planned < p.hardSetMinReps) return true;
  return p.repRangeMax != null && planned > p.repRangeMax;
}

export type LoadAction = "ok" | "subir" | "bajar" | "seguir";
/** Magnitud → color con la paleta de MEV: ok success · off warning · far danger. */
export type LoadLevel = "ok" | "off" | "far";
/** Dónde cayó un valor respecto de su rango objetivo. */
export type Band = "bajo" | "en" | "alto";

export interface LoadAdvice {
  action: LoadAction;
  level: LoadLevel;
  reps: Band;
  /** `null` = RIR sin cargar: la sugerencia sale sólo de las reps. */
  rir: Band | null;
  /** La sugerencia la disparó sólo el RIR (reps en rango). Para el "· por el RIR" del texto. */
  byRir: boolean;
  /** Reps por debajo del piso del objetivo: el texto explica que la serie no suma. */
  belowFloor: boolean;
  /** El plan de la serie cae fuera del rango del objetivo: se ignoró y el ⓘ lo avisa. */
  planOutOfRange: boolean;
}

/**
 * Sugerencia de carga: cruza las reps y el RIR de una serie contra los rangos
 * del objetivo y dice si subir el peso, bajarlo, dejarlo, o si el problema no
 * fue el peso.
 *
 *     reps \ rir    bajo      en        alto      (sin RIR)
 *     bajo          bajar     bajar     SEGUIR    bajar
 *     en            bajar     ok        subir     ok
 *     alto          subir     subir     subir     subir
 *
 * **Objetivo de reps.** Piso = `hardSetMinReps`, techo = `repRangeMax`. Si la
 * serie tiene un plan DENTRO de ese rango, el objetivo es `plan ± repTolerance`
 * acotado al rango: el plan sólo puede angostar el rango del objetivo, nunca
 * moverlo afuera. Sin plan, o con un plan fuera de rango (que se ignora y se
 * marca en `planOutOfRange`), el objetivo es el rango entero. Así un plan mal
 * armado no puede sesgar la sugerencia: 3 reps con plan de 3 en hipertrofia
 * dispara "bajá · menos de 5 reps no suma", igual que sin plan.
 *
 * **Objetivo de RIR.** Siempre el del objetivo (`rirZone`), nunca el plan: la
 * rutina no planifica RIR.
 *
 * **La regla base** es la de Helms, Cronin, Storey y Zourdos 2016 (ref "21"),
 * que prescribe "N reps @ RIR X": *bajá la carga si no completás las reps;
 * subila si las completás con más RIR que el objetivo*. Son las filas "reps
 * bajo → bajar" y "RIR alto → subir".
 *
 * **Las dos diagonales** son donde las señales se contradicen:
 * - Reps bajo + RIR alto (te faltaron reps pero paraste lejos del fallo). No es
 *   un problema de carga. Steele 2017 y Halperin 2022 (refs "9"/"10") muestran
 *   que la gente SUBESTIMA sistemáticamente sus reps en reserva — 1-2 con
 *   experiencia, 4-5 sin — así que un RIR alto reportado es real como mínimo:
 *   la carga permitía las reps, el usuario paró antes. De ahí `seguir`, que
 *   dice "el peso está bien: llegá a las reps".
 * - Reps alto + RIR bajo. Reps sobre el rango = carga liviana para el objetivo
 *   (Schoenfeld 2021, ref "4"); subirla baja las reps al rango y sube el RIR al
 *   mismo esfuerzo. Las dos señales apuntan igual: `subir`.
 *
 * **Magnitud.** `far` si las reps quedaron fuera del rango absoluto del objetivo
 * o a más de 2× la tolerancia del plan; si no, `off`. Cuando la sugerencia la
 * dispara sólo el RIR (fila "en"), la magnitud es `off` como máximo: el RIR es
 * la señal más ruidosa de las dos (Halperin 2022: la precisión sólo se sostiene
 * en series de menos de ~12 reps). `seguir` es siempre `off`.
 *
 * **Bajadas.** El piso no aplica — el tope es la primera parte de una serie más
 * larga, sus reps sueltas no dicen si la carga estuvo bien. Plan y techo sí.
 */
export function loadAdvice(input: {
  reps: number | null;
  rir: number | null;
  planned: number | null | undefined;
  /** La serie tiene bajadas: las reps del tope no son toda la serie. */
  hasDrops?: boolean;
  profile: TrainingProfile | null | undefined;
}): LoadAdvice | null {
  const { reps, rir, hasDrops = false, profile } = input;
  const planned = input.planned ?? null;
  if (reps == null) return null;
  const p = goalParams(profile);
  const floor = p.hardSetMinReps;
  const ceil = p.repRangeMax ?? Infinity;
  const t = p.repTolerance;

  const outOfRange = planOutOfRange(planned, profile);
  const usePlan = planned != null && !outOfRange;
  const floorApplies = !hasDrops;
  const lo = usePlan
    ? floorApplies
      ? Math.max(floor, planned - t)
      : planned - t
    : floorApplies
      ? floor
      : -Infinity;
  const hi = usePlan ? Math.min(ceil, planned + t) : ceil;

  const repsBand: Band = reps < lo ? "bajo" : reps > hi ? "alto" : "en";
  const belowFloor = floorApplies && reps < floor;
  const repsFar =
    belowFloor ||
    reps > ceil ||
    (usePlan && Math.abs(reps - planned) > t * 2);

  const rirBand: Band | null =
    rir == null
      ? null
      : (({ danger: "bajo", success: "en", muted: "alto" }) as const)[
          rirZone(rir, profile)
        ];

  let action: LoadAction;
  if (repsBand === "bajo") action = rirBand === "alto" ? "seguir" : "bajar";
  else if (repsBand === "alto") action = "subir";
  else action = rirBand === "bajo" ? "bajar" : rirBand === "alto" ? "subir" : "ok";

  const byRir = repsBand === "en" && action !== "ok";
  const level: LoadLevel =
    action === "ok"
      ? "ok"
      : action === "seguir" || byRir
        ? "off"
        : repsFar
          ? "far"
          : "off";

  return {
    action,
    level,
    reps: repsBand,
    rir: rirBand,
    byRir,
    belowFloor,
    planOutOfRange: outOfRange,
  };
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
