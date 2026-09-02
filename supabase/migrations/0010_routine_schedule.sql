-- SPDX-License-Identifier: AGPL-3.0-only
-- Planificación semanal: qué día de la semana corresponde a cada rutina.
-- weekday: 0 = domingo ... 6 = sábado (convención de EXTRACT(dow) de Postgres,
-- para que el cálculo de cumplimiento no necesite traducir índices).
create table if not exists routine_schedule (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references routines (id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  created_at timestamptz not null default now(),
  unique (routine_id, weekday)
);
create index if not exists routine_schedule_routine_idx on routine_schedule (routine_id);

alter table routine_schedule enable row level security;

-- Acceso: solo el dueño de la rutina (mismo patrón que routine_sets).
drop policy if exists routine_schedule_all on routine_schedule;
create policy routine_schedule_all on routine_schedule for all using (
  exists (
    select 1 from routines r
    where r.id = routine_schedule.routine_id and r.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from routines r
    where r.id = routine_schedule.routine_id and r.owner_id = auth.uid()
  )
);

-- Porcentaje de cumplimiento en un rango de fechas.
-- Regla: por cada día del rango que tenga AL MENOS una rutina planificada
-- para ese weekday, se cuenta como "cumplido" si el usuario tiene alguna
-- workout_session ese día calendario (sin importar la rutina). Días sin
-- ninguna rutina planificada no entran en el denominador.
create or replace function compliance_stats(p_from date, p_to date)
returns table (
  planned_days integer,
  completed_days integer,
  pct numeric
)
language plpgsql stable security invoker set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'No autenticado'; end if;

  return query
    with days as (
      select gs::date as d
      from generate_series(p_from, p_to, interval '1 day') gs
    ),
    planned as (
      select d.d
      from days d
      where exists (
        select 1 from routine_schedule rs
        join routines r on r.id = rs.routine_id
        where r.owner_id = v_me and rs.weekday = extract(dow from d.d)
      )
    ),
    done as (
      select p.d
      from planned p
      where exists (
        select 1 from workout_sessions s
        where s.user_id = v_me
          and s.created_at::date = p.d
      )
    )
    select
      (select count(*) from planned)::integer,
      (select count(*) from done)::integer,
      case when (select count(*) from planned) = 0 then 0
        else round((select count(*) from done)::numeric / (select count(*) from planned) * 100, 1)
      end;
end $$;
