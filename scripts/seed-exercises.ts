// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Carga el catálogo de ejercicios desde free-exercise-db, que está bajo
 * Unlicense (dedicación al dominio público) — no MIT, como decía antes este
 * comentario. Las imágenes se traen de raw.githubusercontent en tiempo de seed
 * y quedan cubiertas por la misma dedicación.
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (clave service_role — NO exponer en el cliente)
 *
 * Uso:  npm run seed
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const DATA_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

interface RawExercise {
  id: string;
  name: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string | null;
  images: string[];
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  console.log("Descargando catálogo de free-exercise-db…");
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`No se pudo descargar el dataset: ${res.status}`);
  const raw = (await res.json()) as RawExercise[];
  console.log(`  ${raw.length} ejercicios encontrados.`);

  const rows = raw.map((e) => ({
    slug: e.id,
    name: e.name,
    // Mismo criterio que el backfill de la migración 0033: el dataset no trae
    // un campo de "cómo se mide", así que se deriva de category/force. Si no se
    // pusiera acá, un re-seed dejaría todo el cardio como reps × peso.
    metric_kind:
      e.category === "cardio"
        ? "distance_time"
        : e.force === "static"
          ? "time"
          : "reps_weight",
    category: e.category,
    equipment: e.equipment,
    primary_muscles: e.primaryMuscles ?? [],
    secondary_muscles: e.secondaryMuscles ?? [],
    mechanic: e.mechanic,
    level: e.level,
    force: e.force,
    instructions: e.instructions ?? [],
    images: (e.images ?? []).map((img) => IMAGE_BASE + img),
    is_custom: false,
  }));

  const BATCH = 200;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("exercises")
      .upsert(batch, { onConflict: "slug" });
    if (error) throw error;
    done += batch.length;
    console.log(`  Insertados ${done}/${rows.length}`);
  }

  console.log("✓ Seed completado.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
