// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Vuelca a la base los músculos curados de los ejercicios custom.
 *
 * Por qué existe: los ejercicios en español de la rutina se crearon con
 * `secondary_muscles` vacío y un único primario, así que la base decía bastante
 * menos que la realidad — un press de banca figuraba sólo como pecho. La app
 * tapaba el agujero con una tabla de overrides en TS (`EXERCISE_OVERRIDES`),
 * pero eso dejaba dos verdades: las métricas usaban el override y la ficha del
 * ejercicio mostraba la columna cruda.
 *
 * Este script cierra la brecha en la dirección correcta: la base pasa a decir
 * lo mismo que las métricas. Después de correrlo, el override de cada slug
 * volcado es redundante y se puede borrar del TS.
 *
 * Escribe GRUPOS-APP, no el vocabulario crudo del dataset. En particular, las
 * cabezas del deltoides (`side delts`…) van tal cual: si se guardara
 * `shoulders`, el resolver volvería a adivinar la cabeza con expresiones
 * regulares en inglés sobre nombres en español y mandaría todo a anterior.
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso:
 *   npx tsx scripts/backfill-muscles.ts          # dry-run: imprime el diff
 *   npx tsx scripts/backfill-muscles.ts --apply  # escribe
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  EXERCISE_OVERRIDES,
  DIRECT,
} from "../src/lib/muscle-contributions";

config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");

const same = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("exercises")
    .select("id, slug, name, is_custom, primary_muscles, secondary_muscles")
    .eq("is_custom", true);
  if (error) throw error;

  let changed = 0;
  let skipped = 0;

  for (const ex of data ?? []) {
    const ov = EXERCISE_OVERRIDES[ex.slug as string];
    if (!ov) {
      console.log(`· ${ex.slug} (${ex.name}) — sin override curado, se deja`);
      skipped++;
      continue;
    }
    const primary = ov.filter((c) => c.weight === DIRECT).map((c) => c.muscle);
    const secondary = ov.filter((c) => c.weight !== DIRECT).map((c) => c.muscle);

    const curPrim = ex.primary_muscles as string[];
    const curSec = ex.secondary_muscles as string[];
    if (same(curPrim, primary) && same(curSec, secondary)) {
      skipped++;
      continue;
    }

    console.log(`\n${ex.slug} — ${ex.name}`);
    console.log(`  primarios   ${JSON.stringify(curPrim)} → ${JSON.stringify(primary)}`);
    console.log(`  secundarios ${JSON.stringify(curSec)} → ${JSON.stringify(secondary)}`);
    changed++;

    if (APPLY) {
      const { error: upErr } = await supabase
        .from("exercises")
        .update({ primary_muscles: primary, secondary_muscles: secondary })
        .eq("id", ex.id as string);
      if (upErr) throw upErr;
    }
  }

  console.log(
    `\n${changed} a cambiar, ${skipped} sin cambios. ${
      APPLY ? "APLICADO." : "Dry-run: volvé a correr con --apply para escribir."
    }`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
