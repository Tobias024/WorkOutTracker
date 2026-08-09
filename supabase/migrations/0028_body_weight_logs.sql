-- Registro de peso corporal por día (espejo de sleep_logs). Permite registrar
-- el peso a diario, entrenes o no. La tendencia de peso mergea esto con el
-- body_weight_kg de las sesiones (para no perder historia previa).
-- Down: drop table body_weight_logs;
create table if not exists body_weight_logs (
  user_id uuid not null references profiles (id) on delete cascade,
  weighed_on date not null,
  weight_kg numeric(5, 2) not null check (weight_kg > 0 and weight_kg <= 500),
  created_at timestamptz not null default now(),
  primary key (user_id, weighed_on)
);

create index if not exists body_weight_logs_user_idx
  on body_weight_logs (user_id, weighed_on desc);

alter table body_weight_logs enable row level security;

drop policy if exists body_weight_logs_all on body_weight_logs;
create policy body_weight_logs_all on body_weight_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
