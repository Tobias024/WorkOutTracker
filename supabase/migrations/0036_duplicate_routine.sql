-- SPDX-License-Identifier: AGPL-3.0-only
-- Duplicar una rutina propia sin pasar por share_code.
--
-- Antes, "Copiar" generaba un share_code público en la rutina ORIGINAL y luego
-- llamaba a import_routine. Esta función copia directo, sin exponer nada.
-- Al ser una copia de la propia rutina del usuario, también se copia
-- target_weight (import_routine lo omite porque es un dato personal).

create or replace function public.duplicate_routine(p_routine_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_src routines%rowtype;
  v_new uuid;
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'No autenticado'; end if;

  select * into v_src from routines
  where id = p_routine_id and owner_id = auth.uid();
  if v_src.id is null then raise exception 'Rutina no encontrada'; end if;

  insert into routines (owner_id, name, description)
  values (v_me, v_src.name || ' (copia)', v_src.description)
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
    (routine_exercise_id, set_number, target_reps, target_weight,
     target_duration_seconds, target_distance_m)
  select ir.id, rs.set_number, rs.target_reps, rs.target_weight,
         rs.target_duration_seconds, rs.target_distance_m
  from src_rex sr
  join ins_rex ir on ir.exercise_id = sr.exercise_id and ir.position = sr.position
  join routine_sets rs on rs.routine_exercise_id = sr.id;

  return v_new;
end $$;

grant execute on function public.duplicate_routine(uuid) to authenticated;
