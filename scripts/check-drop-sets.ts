// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Chequeo de las reglas de drop-sets (bug de bajadas guardadas con reps/peso
 * en null): limpieza de bajadas, e1RM que recorre las bajadas, y la columna
 * `bajada` del export.
 *
 * No hay test runner en el repo (ver check-load-advice.ts).
 * Uso:  npx tsx scripts/check-drop-sets.ts
 */
import assert from "node:assert/strict";
import { bestSetE1rm, estimate1RM, sanitizeDrops } from "../src/lib/metrics";
import { buildSessionsRows } from "../src/lib/export-csv";
import type { HistorySessionFull } from "../src/hooks/useHistory";
import type { Exercise } from "../src/lib/types";

let checks = 0;
function eq<T>(actual: T, expected: T, msg: string) {
  assert.deepEqual(actual, expected, msg);
  checks++;
}

// ── sanitizeDrops ───────────────────────────────────────────────────────────
eq(sanitizeDrops(null), null, "null queda null");
eq(sanitizeDrops([]), null, "vacío → null");
eq(sanitizeDrops([{ reps: 8, weight: 25 }]), null, "una sola → serie simple");
eq(
  sanitizeDrops([
    { reps: 8, weight: 25 },
    { reps: null, weight: null },
  ]),
  null,
  "base + bajada vacía (mis-tap) → serie simple",
);
eq(
  sanitizeDrops([
    { reps: 8, weight: 25 },
    { reps: null, weight: null },
    { reps: 4, weight: 20 },
  ]),
  [
    { reps: 8, weight: 25 },
    { reps: 4, weight: 20 },
  ],
  "saca la vacía del medio",
);
eq(
  sanitizeDrops([
    { reps: null, weight: null },
    { reps: 6, weight: 5 },
  ]),
  [
    { reps: null, weight: null },
    { reps: 6, weight: 5 },
  ],
  "la primera (espejo de la base) nunca se saca",
);
eq(
  sanitizeDrops([
    { reps: 9, weight: 55 },
    { reps: 7, weight: null },
  ]),
  [
    { reps: 9, weight: 55 },
    { reps: 7, weight: null },
  ],
  "a medio cargar se conserva",
);

// ── bestSetE1rm ─────────────────────────────────────────────────────────────
eq(bestSetE1rm({ reps: 8, weight: 100, drops: null }), estimate1RM(100, 8), "serie simple");
eq(bestSetE1rm({ reps: null, weight: null, drops: null }), 0, "vacía → 0");
eq(
  bestSetE1rm({
    reps: null,
    weight: 10,
    drops: [
      { reps: null, weight: 10 },
      { reps: 6, weight: 5 },
    ],
  }),
  estimate1RM(5, 6),
  "base sin reps: el e1RM sale de la bajada completa (Curl banco Scott)",
);
eq(
  bestSetE1rm({
    reps: 8,
    weight: 25,
    drops: [
      { reps: 8, weight: 25 },
      { reps: 4, weight: 20 },
    ],
  }),
  estimate1RM(25, 8),
  "drop-set completo: el máximo es la primera",
);

// ── export: columna bajada ──────────────────────────────────────────────────
const session = {
  id: "s1",
  name: "Brazos",
  routine_id: null,
  created_at: "2026-11-25T20:00:00Z",
  started_at: "2026-11-25T20:00:00Z",
  ended_at: "2026-11-25T21:00:00Z",
  duration_seconds: 3600,
  body_weight_kg: null,
  workout_exercises: [
    {
      exercise_id: "ex1",
      replaced_from_exercise_id: null,
      workout_sets: [
        {
          reps: 8,
          weight: 10,
          completed: true,
          is_warmup: false,
          rpe: null,
          completed_at: null,
          rest_seconds: null,
          drops: [
            { reps: 8, weight: 10 },
            { reps: 7, weight: 5 },
          ],
          duration_seconds: null,
          distance_m: null,
          comment: null,
          planned_reps: null,
          planned_weight: null,
        },
        {
          reps: 10,
          weight: 10,
          completed: true,
          is_warmup: false,
          rpe: null,
          completed_at: null,
          rest_seconds: null,
          drops: null,
          duration_seconds: null,
          distance_m: null,
          comment: null,
          planned_reps: null,
          planned_weight: null,
        },
      ],
    },
  ],
} as unknown as HistorySessionFull;
const exMap = new Map<string, Exercise>([
  ["ex1", { id: "ex1", name: "Curl banco Scott" } as Exercise],
]);
const rows = buildSessionsRows([session], exMap);
const header = rows[0];
const col = header.indexOf("bajada");
eq(col, header.length - 1, "bajada es la última columna (contrato posicional)");
eq(
  rows.slice(1).map((r) => [r[header.indexOf("serie")], r[col], r[header.indexOf("reps")]]),
  [
    [1, 0, 8],
    [1, 1, 7],
    [2, 0, 10],
  ],
  "cada bajada es su fila, numerada desde 0 dentro de la serie",
);

console.log(`check-drop-sets: ${checks} chequeos OK`);
