-- SPDX-License-Identifier: AGPL-3.0-only
-- Camino rápido para set_volume / set_max_weight / set_estimate_1rm cuando la
-- serie no tiene drops (ws.drops is null, el 99% de los casos).
--
-- Por qué: hoy cada llamada construye un jsonb (jsonb_build_array +
-- jsonb_build_object), lo expande con jsonb_array_elements y re-castea texto a
-- numeric, por cada una de las series que se agregan. Para drops null el
-- resultado es una única "bajada" {reps, weight}, así que se calcula directo
-- con columnas escalares.
--
-- Equivalencia exacta (misma firma, immutable, mismos tipos y escalas):
--   * set_volume: la fila única sólo cuenta si reps y weight no son null:
--     reps*weight; si alguno es null el agregado sobre 0 filas daba 0
--     -> coalesce(reps::numeric * weight, 0).
--   * set_max_weight: cuenta si weight no es null -> weight; null -> 0
--     -> coalesce(weight, 0).
--   * set_estimate_1rm: si reps o weight son null no hay filas -> 0; si
--     reps<=0 o weight<=0 -> 0; reps=1 -> weight; si no
--     round(weight * (1 + reps::numeric / 30)) (división numeric, igual que
--     antes con (d->>'reps')::numeric / 30).
--   * drops no nulo (incluido '[]'::jsonb) sigue por la lógica jsonb original,
--     intacta (con '[]' sigue devolviendo 0).
--
-- Down: re-aplicar set_volume/set_max_weight (0004) y set_estimate_1rm (0009).

create or replace function set_volume(ws workout_sets)
returns numeric language sql immutable as $$
  select case
    when ws.drops is null then
      coalesce(ws.reps::numeric * ws.weight, 0)
    else (
      select coalesce(sum((d->>'reps')::numeric * (d->>'weight')::numeric), 0)
      from jsonb_array_elements(
        coalesce(ws.drops, jsonb_build_array(jsonb_build_object('reps', ws.reps, 'weight', ws.weight)))
      ) d
      where d->>'reps' is not null and d->>'weight' is not null
    )
  end;
$$;

create or replace function set_max_weight(ws workout_sets)
returns numeric language sql immutable as $$
  select case
    when ws.drops is null then
      coalesce(ws.weight::numeric, 0)
    else (
      select coalesce(max((d->>'weight')::numeric), 0)
      from jsonb_array_elements(
        coalesce(ws.drops, jsonb_build_array(jsonb_build_object('reps', ws.reps, 'weight', ws.weight)))
      ) d
      where d->>'weight' is not null
    )
  end;
$$;

create or replace function set_estimate_1rm(ws workout_sets)
returns numeric language sql immutable as $$
  select case
    when ws.drops is null then
      case
        when ws.reps is null or ws.weight is null then 0
        when ws.reps::numeric <= 0 or ws.weight::numeric <= 0 then 0
        when ws.reps::numeric = 1 then ws.weight::numeric
        else round(ws.weight::numeric * (1 + ws.reps::numeric / 30))
      end
    else (
      select coalesce(max(
        case
          when (d->>'reps')::numeric <= 0 or (d->>'weight')::numeric <= 0 then 0
          when (d->>'reps')::numeric = 1 then (d->>'weight')::numeric
          else round((d->>'weight')::numeric * (1 + (d->>'reps')::numeric / 30))
        end
      ), 0)
      from jsonb_array_elements(
        coalesce(ws.drops, jsonb_build_array(jsonb_build_object('reps', ws.reps, 'weight', ws.weight)))
      ) d
      where d->>'reps' is not null and d->>'weight' is not null
    )
  end;
$$;
