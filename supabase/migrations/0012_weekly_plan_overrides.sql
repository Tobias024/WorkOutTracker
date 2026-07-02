-- Excepciones por semana al plan semanal. profiles.planned_weekdays sigue
-- siendo la plantilla default; una fila acá pisa la plantilla para esa
-- semana puntual. week_start = lunes de esa semana (date, sin hora).
create table if not exists weekly_plan_overrides (
  user_id uuid not null references profiles (id) on delete cascade,
  week_start date not null,
  weekdays int[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table weekly_plan_overrides enable row level security;

drop policy if exists weekly_plan_overrides_all on weekly_plan_overrides;
create policy weekly_plan_overrides_all on weekly_plan_overrides for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
