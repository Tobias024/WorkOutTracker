-- SPDX-License-Identifier: AGPL-3.0-only
-- Medidas corporales (circunferencias + % graso), cadencia mensual. Los sitios
-- son nullable: una entrada puede llenar sólo algunos.
-- Down: drop table body_measurements;
create table if not exists body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  measured_on date not null,
  arm_cm numeric(5, 2),
  chest_cm numeric(5, 2),
  waist_cm numeric(5, 2),
  thigh_cm numeric(5, 2),
  bodyfat_pct numeric(4, 1),
  created_at timestamptz not null default now()
);

create index if not exists body_measurements_user_idx on body_measurements (user_id, measured_on);

alter table body_measurements enable row level security;

drop policy if exists body_measurements_all on body_measurements;
create policy body_measurements_all on body_measurements for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
