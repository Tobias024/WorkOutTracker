-- SPDX-License-Identifier: AGPL-3.0-only
-- Registro de sueño por noche (para la métrica base "Sueño"). Una fila por día.
-- Down: drop table sleep_logs;
create table if not exists sleep_logs (
  user_id uuid not null references profiles (id) on delete cascade,
  slept_on date not null,
  hours numeric(3, 1) not null check (hours >= 0 and hours <= 24),
  created_at timestamptz not null default now(),
  primary key (user_id, slept_on)
);

create index if not exists sleep_logs_user_idx on sleep_logs (user_id, slept_on desc);

alter table sleep_logs enable row level security;

drop policy if exists sleep_logs_all on sleep_logs;
create policy sleep_logs_all on sleep_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
