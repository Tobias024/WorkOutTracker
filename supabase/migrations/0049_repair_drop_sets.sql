-- SPDX-License-Identifier: AGPL-3.0-only
-- Repara los drop-sets que el bug de SetRow guardó con huecos.
--
-- El bug: cada cambio en una bajada reescribía el array entero desde las
-- props del último render. Un blur seguido de un tap (tipear reps y tocar
-- "Agregar bajada" o ✓ sin cerrar el teclado) mandaba el `drops[0]` viejo,
-- con reps (o peso) en null, y además pisaba las columnas base. Arreglado en
-- el cliente en el mismo release; esto limpia lo que ya estaba guardado.
--
-- Por qué así:
--   * Las métricas SQL (set_volume, set_max_weight, set_estimate_1rm) usan
--     `drops` cuando existe e IGNORAN las columnas base, y saltean los
--     elementos con null. Una `drops[0]` sin reps con la base sana hacía
--     desaparecer la serie del volumen y del e1RM aunque el dato estuviera.
--     Se copia de la base a drops[0] — nunca al revés (la base es la que el
--     usuario ve y edita; además, medido el 2026-11-25: 0 casos al revés).
--   * Las bajadas extra sin reps NI peso son un "Agregar bajada" sin usar: no
--     aportan nada y se quitan. Si queda una sola, la serie vuelve a ser
--     simple (drops = null), igual que sanitizeDrops() en src/lib/metrics.ts.
--   * Las bajadas extra a medio cargar se dejan: no hay de dónde completarlas
--     y las métricas ya las saltean.
--   * Sin columna de "dato incompleto": lo irrecuperable ya no suma en ningún
--     cálculo, así que marcarlo no cambia ningún número.
--
-- Conteo previo (2026-11-25, todos los usuarios, 131 filas con drops):
--   drops[0].reps null con base.reps     → 30
--   drops[0].weight null con base.weight → 23
--   con bajadas extra totalmente vacías  →  5
--
-- El trigger workout_sets_completed_at sólo actúa si cambia `completed`, que
-- acá no se toca: completed_at queda intacto.

-- 1) drops[0].reps desde la base.
update workout_sets
set drops = jsonb_set(drops, '{0,reps}', to_jsonb(reps))
where drops is not null
  and jsonb_typeof(drops) = 'array'
  and jsonb_array_length(drops) > 0
  and (drops -> 0 ->> 'reps') is null
  and reps is not null;

-- 2) drops[0].weight desde la base.
update workout_sets
set drops = jsonb_set(drops, '{0,weight}', to_jsonb(weight))
where drops is not null
  and jsonb_typeof(drops) = 'array'
  and jsonb_array_length(drops) > 0
  and (drops -> 0 ->> 'weight') is null
  and weight is not null;

-- 3) Bajadas extra (índice ≥ 1) sin reps ni peso: afuera.
with cleaned as (
  select
    ws.id,
    (
      select jsonb_agg(e.x order by e.i)
      from jsonb_array_elements(ws.drops) with ordinality as e(x, i)
      where e.i = 1
         or (e.x ->> 'reps') is not null
         or (e.x ->> 'weight') is not null
    ) as nd
  from workout_sets ws
  where ws.drops is not null
    and jsonb_typeof(ws.drops) = 'array'
    and exists (
      select 1
      from jsonb_array_elements(ws.drops) with ordinality as e(x, i)
      where e.i > 1
        and (e.x ->> 'reps') is null
        and (e.x ->> 'weight') is null
    )
)
update workout_sets ws
set drops = case when jsonb_array_length(c.nd) > 1 then c.nd else null end
from cleaned c
where ws.id = c.id;
