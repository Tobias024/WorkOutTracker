-- SPDX-License-Identifier: AGPL-3.0-only
-- Series que no se miden en reps × peso: por tiempo (plancha, colgada), por
-- tiempo + carga (plancha con disco, caminata del granjero) y por distancia +
-- tiempo (corrida, bici, remo ergo).
--
-- El tipo vive en el EJERCICIO, no en la serie: una plancha siempre se mide en
-- tiempo. `category='cardio'` y `force='static'` ya existen en el vocabulario de
-- free-exercise-db, pero no alcanzan como fuente de verdad: son text nullable
-- sin CHECK, y los ejercicios creados desde la app fuerzan category='strength'
-- a mano (useExercises.ts), así que hoy es imposible crear uno de cardio. Sirven
-- solo para el backfill de las filas sembradas.
--
-- Las funciones de agregación (set_volume, set_max_weight, set_estimate_1rm) NO
-- se tocan: con reps/weight en NULL ya devuelven 0, que es lo correcto — el
-- cardio no suma tonelaje. Y el criterio de serie dura del servidor
-- (coalesce(ws.reps,0) >= 5) tampoco: una serie por tiempo no debe contar como
-- volumen de fuerza. La constancia y las rachas cuentan días con sesión, no
-- series, así que un día de solo cardio ya cuenta bien.
--
-- Down: alter table ... drop column (los datos de esas columnas se pierden).

-- ── Tipo de medición del ejercicio ──────────────────────────────────────────

alter table exercises
  add column if not exists metric_kind text not null default 'reps_weight';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exercises_metric_kind_check'
  ) then
    alter table exercises
      add constraint exercises_metric_kind_check
      check (metric_kind in ('reps_weight', 'time', 'time_load', 'distance_time'));
  end if;
end $$;

-- Backfill de las filas sembradas desde free-exercise-db. Solo toca las que
-- siguen en el default, para no pisar nada elegido a mano si se re-ejecuta.
update exercises
   set metric_kind = 'distance_time'
 where metric_kind = 'reps_weight'
   and category = 'cardio';

update exercises
   set metric_kind = 'time'
 where metric_kind = 'reps_weight'
   and force = 'static';

-- ── Columnas de la serie ────────────────────────────────────────────────────
-- distance_m en METROS enteros: se muestra en km, pero guardar enteros evita
-- el redondeo de numeric/float en las sumas.

alter table workout_sets
  add column if not exists duration_seconds integer,
  add column if not exists distance_m integer;

alter table routine_sets
  add column if not exists target_duration_seconds integer,
  add column if not exists target_distance_m integer;

-- ── Planificación por ejercicio de rutina ───────────────────────────────────
-- import_routine (0006) copia target_reps pero no target_weight; se mantiene el
-- mismo criterio: la duración/distancia objetivo SÍ se copian, porque no son un
-- dato personal como la carga, son la definición del ejercicio (correr 5 km).

create or replace function import_routine(p_share_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_src routines%rowtype;
  v_new uuid;
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'No autenticado'; end if;

  select * into v_src from routines where share_code = p_share_code;
  if v_src.id is null then raise exception 'Rutina no encontrada'; end if;

  insert into routines (owner_id, name, description)
  values (v_me, v_src.name, v_src.description)
  returning id into v_new;

  with src_rex as (
    select * from routine_exercises where routine_id = v_src.id
  ), ins_rex as (
    insert into routine_exercises
      (routine_id, exercise_id, position, target_sets, target_reps, notes, superset_group)
    select v_new, exercise_id, position, target_sets, target_reps, notes, superset_group
    from src_rex
    returning id, exercise_id, position
  )
  insert into routine_sets
    (routine_exercise_id, set_number, target_reps, target_duration_seconds, target_distance_m)
  select ir.id, rs.set_number, rs.target_reps,
         rs.target_duration_seconds, rs.target_distance_m
  from src_rex sr
  join ins_rex ir on ir.exercise_id = sr.exercise_id and ir.position = sr.position
  join routine_sets rs on rs.routine_exercise_id = sr.id;

  return v_new;
end $$;
