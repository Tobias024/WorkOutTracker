// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Chequeo de la matriz de sugerencia de carga (`loadAdvice` en goal-params.ts).
 *
 * No hay test runner en el repo; los umbrales se venían verificando a mano con
 * tsx. Esto hace lo mismo pero exhaustivo: la matriz son 3 bandas de reps × 4
 * columnas de RIR (incluyendo "sin cargar") × 3 objetivos, y comprobarla
 * tocando la UI serie por serie no es viable.
 *
 * Uso:  npx tsx scripts/check-load-advice.ts
 */
import assert from "node:assert/strict";
import {
  GOAL_PARAMS,
  loadAdvice,
  planOutOfRange,
  repRangeLabel,
  type LoadAction,
} from "../src/lib/goal-params";
import type { TrainingProfile } from "../src/lib/types";

let checks = 0;
function eq<T>(actual: T, expected: T, msg: string) {
  assert.deepEqual(actual, expected, msg);
  checks++;
}

const PROFILES: TrainingProfile[] = ["fuerza", "hipertrofia", "resistencia"];

// ── 1. La matriz completa, sin plan (objetivo = rango del goal) ─────────────
//
//     reps \ rir    bajo      en        alto      (sin RIR)
//     bajo          bajar     bajar     SEGUIR    bajar
//     en            bajar     ok        subir     ok
//     alto          subir     subir     subir     subir
//
// Se recorre con reps y RIR representativos de cada banda para cada objetivo.
for (const profile of PROFILES) {
  const p = GOAL_PARAMS[profile];
  const floor = p.hardSetMinReps;
  const ceil = p.repRangeMax;

  // Un RIR de cada banda. `rirTooCloseBelow: null` (hipertrofia) = sin banda baja.
  const rirBajo = p.rirTooCloseBelow != null ? p.rirTooCloseBelow - 1 : null;
  const rirEn = p.rirProductiveMax;
  const rirAlto = p.rirProductiveMax + 1;

  // Reps de cada banda. Sin techo (resistencia) no hay banda "alto".
  const repsBajo = floor > 1 ? floor - 1 : null;
  const repsEn = ceil != null ? Math.floor((floor + ceil) / 2) : floor + 5;
  const repsAlto = ceil != null ? ceil + 1 : null;

  const row = (
    reps: number | null,
    band: "bajo" | "en" | "alto",
    expected: Record<string, LoadAction>,
  ) => {
    if (reps == null) return;
    for (const [key, rir] of [
      ["bajo", rirBajo],
      ["en", rirEn],
      ["alto", rirAlto],
      ["sin", null],
    ] as const) {
      if (key === "bajo" && rir == null) continue; // hipertrofia no tiene banda baja
      const a = loadAdvice({ reps, rir, planned: null, profile });
      assert.ok(a, `${profile}: esperaba advice para reps=${reps}`);
      eq(a.reps, band, `${profile} reps=${reps} rir=${rir}: banda de reps`);
      eq(
        a.action,
        expected[key],
        `${profile} reps=${reps} (${band}) rir=${rir} (${key}): acción`,
      );
    }
  };

  row(repsBajo, "bajo", { bajo: "bajar", en: "bajar", alto: "seguir", sin: "bajar" });
  row(repsEn, "en", { bajo: "bajar", en: "ok", alto: "subir", sin: "ok" });
  row(repsAlto, "alto", { bajo: "subir", en: "subir", alto: "subir", sin: "subir" });
}

// ── 2. El plan angosta el rango, pero nunca lo mueve afuera ─────────────────
{
  // hipertrofia: rango 5-30, tolerancia ±2, plan 10 → objetivo 8-12.
  const base = { profile: "hipertrofia" as const, rir: 2, planned: 10 };
  eq(loadAdvice({ ...base, reps: 10 })!.action, "ok", "plan 10, 10 reps → ok");
  eq(loadAdvice({ ...base, reps: 8 })!.action, "ok", "plan 10, 8 reps → borde ok");
  eq(loadAdvice({ ...base, reps: 12 })!.action, "ok", "plan 10, 12 reps → borde ok");
  eq(loadAdvice({ ...base, reps: 7 })!.action, "bajar", "plan 10, 7 reps → bajar");
  eq(loadAdvice({ ...base, reps: 14 })!.action, "subir", "plan 10, 14 reps → subir");
  // Magnitud: dentro de 2× tolerancia es "off", más allá "far".
  // El corte es ESTRICTO: |diff| > 2×tol. Con tol 2 y plan 10, 6 y 14 reps
  // están exactamente en 2×tol (=4) y todavía son "off"; 5 y 15 ya son "far".
  eq(loadAdvice({ ...base, reps: 7 })!.level, "off", "7 reps: off");
  eq(loadAdvice({ ...base, reps: 6 })!.level, "off", "6 reps (=2×tol): off");
  eq(loadAdvice({ ...base, reps: 5 })!.level, "far", "5 reps (>2×tol): far");
  eq(loadAdvice({ ...base, reps: 15 })!.level, "far", "15 reps (>2×tol): far");
}

// ── 3. Plan fuera de rango: se ignora, y el rango del goal manda ────────────
{
  const p = { profile: "hipertrofia" as const, rir: 2 };
  eq(planOutOfRange(3, "hipertrofia"), true, "plan 3 en hipertrofia: fuera");
  eq(planOutOfRange(40, "hipertrofia"), true, "plan 40 en hipertrofia: fuera");
  eq(planOutOfRange(10, "hipertrofia"), false, "plan 10 en hipertrofia: dentro");
  eq(planOutOfRange(null, "hipertrofia"), false, "sin plan: no marca");

  // Con plan 3 (fuera), el objetivo cae al rango 5-30 y NO a 3±2.
  const a = loadAdvice({ ...p, reps: 3, planned: 3 })!;
  eq(a.action, "bajar", "plan 3 + 3 reps: bajar (el plan no valida)");
  eq(a.belowFloor, true, "plan 3 + 3 reps: por debajo del piso");
  eq(a.planOutOfRange, true, "plan 3: marcado como fuera de rango");
  eq(a.level, "far", "plan 3 + 3 reps: far");
  eq(loadAdvice({ ...p, reps: 8, planned: 3 })!.action, "ok", "plan 3 + 8 reps: ok");

  // Plan alto: tampoco puede empujar el objetivo por encima del techo.
  eq(loadAdvice({ ...p, reps: 31, planned: 40 })!.action, "subir", "plan 40 + 31 reps: subir");
}

// ── 4. Piso, techo y "no suma" ──────────────────────────────────────────────
{
  const a = loadAdvice({ profile: "hipertrofia", reps: 3, rir: 2, planned: null })!;
  eq(a.belowFloor, true, "3 reps en hipertrofia: bajo el piso");
  eq(a.action, "bajar", "3 reps: bajar");
  eq(a.level, "far", "3 reps: far");

  eq(
    loadAdvice({ profile: "hipertrofia", reps: 32, rir: 2, planned: null })!.action,
    "subir",
    "32 reps (techo 30): subir",
  );
  // Fuerza: techo 6.
  eq(
    loadAdvice({ profile: "fuerza", reps: 8, rir: 3, planned: null })!.action,
    "subir",
    "fuerza 8 reps (techo 6): subir",
  );
  eq(
    loadAdvice({ profile: "fuerza", reps: 1, rir: 3, planned: null })!.belowFloor,
    false,
    "fuerza 1 rep: el piso es 1, no marca",
  );
  // Resistencia no tiene techo.
  eq(
    loadAdvice({ profile: "resistencia", reps: 50, rir: 3, planned: null })!.action,
    "ok",
    "resistencia 50 reps: sin techo, ok",
  );
}

// ── 5. Bajadas: el piso no aplica, el plan sí ───────────────────────────────
{
  const withDrops = loadAdvice({
    profile: "hipertrofia", reps: 3, rir: 2, planned: null, hasDrops: true,
  })!;
  eq(withDrops.belowFloor, false, "con bajadas: el piso no aplica");
  eq(withDrops.action, "ok", "con bajadas, 3 reps sueltas: ok");

  eq(
    loadAdvice({ profile: "hipertrofia", reps: 3, rir: 2, planned: 10, hasDrops: true })!.action,
    "bajar",
    "con bajadas, el plan sigue midiendo",
  );
}

// ── 6. byRir: la sugerencia salió sólo del RIR, y nunca escala a "far" ──────
{
  const a = loadAdvice({ profile: "hipertrofia", reps: 10, rir: 5, planned: 10 })!;
  eq(a.action, "subir", "reps en rango + RIR alto: subir");
  eq(a.byRir, true, "…y lo disparó el RIR");
  eq(a.level, "off", "el RIR solo nunca llega a far");

  const b = loadAdvice({ profile: "fuerza", reps: 5, rir: 0, planned: 5 })!;
  eq(b.action, "bajar", "fuerza, reps en rango + RIR 0: bajar");
  eq(b.byRir, true, "…por el RIR");

  // Hipertrofia no tiene banda de RIR bajo: RIR 0 con reps en rango es ok.
  const c = loadAdvice({ profile: "hipertrofia", reps: 10, rir: 0, planned: 10 })!;
  eq(c.action, "ok", "hipertrofia RIR 0 con reps en rango: ok (Robinson 2024)");
  eq(c.rir, "en", "hipertrofia: RIR 0 cae en la banda productiva");

  // Cuando las reps ya mandan, byRir es false.
  eq(loadAdvice({ profile: "hipertrofia", reps: 20, rir: 5, planned: 10 })!.byRir, false,
    "reps fuera de rango: no es byRir");
}

// ── 7. La diagonal: reps bajo + RIR alto → el peso está bien ────────────────
{
  const a = loadAdvice({ profile: "hipertrofia", reps: 6, rir: 5, planned: 10 })!;
  eq(a.action, "seguir", "reps bajo + RIR alto: seguir");
  eq(a.level, "off", "seguir siempre off");
  // Mismas reps con RIR productivo: sí es problema de carga.
  eq(loadAdvice({ profile: "hipertrofia", reps: 6, rir: 2, planned: 10 })!.action, "bajar",
    "reps bajo + RIR en rango: bajar");
}

// ── 8. Sin reps no hay sugerencia ───────────────────────────────────────────
eq(loadAdvice({ profile: "hipertrofia", reps: null, rir: 2, planned: 10 }), null,
  "sin reps cargadas: sin sugerencia");

// ── 9. Etiquetas ────────────────────────────────────────────────────────────
eq(repRangeLabel("fuerza"), "1-6", "label fuerza");
eq(repRangeLabel("hipertrofia"), "5-30", "label hipertrofia");
eq(repRangeLabel("resistencia"), "12+", "label resistencia (sin techo)");
eq(repRangeLabel(null), "5-30", "sin objetivo → hipertrofia");

console.log(`✓ ${checks} chequeos de loadAdvice OK`);
