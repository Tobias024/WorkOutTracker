-- SPDX-License-Identifier: AGPL-3.0-only
-- Planificación por serie: cada serie de un ejercicio de rutina con su
-- objetivo de reps y peso. Permite planear incrementos/bajadas.
-- routine_exercises.target_sets/target_reps quedan como valores "flat" de
-- respaldo (para rutinas viejas y para la vista previa al compartir).

create table if not exists routine_sets (
  id uuid primary key default gen_random_uuid(),
  routine_exercise_id uuid not null references routine_exercises (id) on delete cascade,
  set_number integer not null,
  target_reps integer,
  target_weight numeric(7, 2),
  unique (routine_exercise_id, set_number)
);
create index if not exists routine_sets_rex_idx
  on routine_sets (routine_exercise_id, set_number);

alter table routine_sets enable row level security;

-- Acceso: sólo el dueño de la rutina a la que pertenece la serie.
drop policy if exists routine_sets_all on routine_sets;
create policy routine_sets_all on routine_sets for all using (
  exists (
    select 1 from routine_exercises re
    join routines r on r.id = re.routine_id
    where re.id = routine_sets.routine_exercise_id and r.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from routine_exercises re
    join routines r on r.id = re.routine_id
    where re.id = routine_sets.routine_exercise_id and r.owner_id = auth.uid()
  )
);

-- Backfill: genera routine_sets a partir de target_sets/target_reps para
-- ejercicios que todavía no tienen series planeadas (sin peso).
insert into routine_sets (routine_exercise_id, set_number, target_reps)
select re.id, gs.n, re.target_reps
from routine_exercises re
cross join lateral generate_series(1, greatest(coalesce(re.target_sets, 3), 1)) as gs(n)
where not exists (
  select 1 from routine_sets rs where rs.routine_exercise_id = re.id
);

-- import_routine: copiar también las series planeadas (reps sí, peso NO —
-- se comparte "sin tus pesos").
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
  insert into routine_sets (routine_exercise_id, set_number, target_reps)
  select ir.id, rs.set_number, rs.target_reps
  from src_rex sr
  join ins_rex ir on ir.exercise_id = sr.exercise_id and ir.position = sr.position
  join routine_sets rs on rs.routine_exercise_id = sr.id;

  return v_new;
end $$;
