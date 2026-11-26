-- SPDX-License-Identifier: AGPL-3.0-only
-- duplicate_routine (0036) emparejaba cada routine_exercise copiado con su
-- original por (exercise_id, position), que NO es único: no hay constraint y
-- dos altas rápidas en el editor podían dejar posiciones repetidas (en prod,
-- 2026-11-25: 4 rutinas con posición repetida). Si además coincidía el
-- ejercicio, el join 2×2 le daba a cada copia las series de AMBOS originales
-- (6 series en vez de 3, set_number duplicados).
--
-- Ahora se copia fila por fila y las series se toman del id original, sin
-- ambigüedad. El volumen es chico (una rutina tiene ~5-12 ejercicios), así
-- que el loop no cuesta nada. Firma y permisos iguales a 0036.

create or replace function public.duplicate_routine(p_routine_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_src routines%rowtype;
  v_new uuid;
  v_me uuid := auth.uid();
  v_rex routine_exercises%rowtype;
  v_new_rex uuid;
begin
  if v_me is null then raise exception 'No autenticado'; end if;

  select * into v_src from routines
  where id = p_routine_id and owner_id = v_me;
  if v_src.id is null then raise exception 'Rutina no encontrada'; end if;

  insert into routines (owner_id, name, description)
  values (v_me, v_src.name || ' (copia)', v_src.description)
  returning id into v_new;

  for v_rex in
    select * from routine_exercises re
    where re.routine_id = v_src.id
    order by re.position, re.id
  loop
    insert into routine_exercises
      (routine_id, exercise_id, position, target_sets, target_reps, notes, superset_group)
    values
      (v_new, v_rex.exercise_id, v_rex.position, v_rex.target_sets, v_rex.target_reps,
       v_rex.notes, v_rex.superset_group)
    returning id into v_new_rex;

    insert into routine_sets
      (routine_exercise_id, set_number, target_reps, target_weight,
       target_duration_seconds, target_distance_m)
    select v_new_rex, rs.set_number, rs.target_reps, rs.target_weight,
           rs.target_duration_seconds, rs.target_distance_m
    from routine_sets rs
    where rs.routine_exercise_id = v_rex.id;
  end loop;

  return v_new;
end $$;

grant execute on function public.duplicate_routine(uuid) to authenticated;
