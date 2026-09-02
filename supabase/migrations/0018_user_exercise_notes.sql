-- SPDX-License-Identifier: AGPL-3.0-only
-- Nota fija por ejercicio (por usuario): un comentario que viaja entre TODAS
-- las rutinas/sesiones del usuario, indexado por exercise_id (identidad estable
-- del catálogo). Resuelve "guardar por ejercicio y no por rutina".
-- NO se comparte al compartir una rutina: es dato propio (import_routine no la
-- toca) y la RLS la restringe al dueño.
-- Down: drop table user_exercise_notes;

create table if not exists user_exercise_notes (
  user_id uuid not null references profiles (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table user_exercise_notes enable row level security;

drop policy if exists user_exercise_notes_all on user_exercise_notes;
create policy user_exercise_notes_all on user_exercise_notes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists user_exercise_notes_updated_at on user_exercise_notes;
create trigger user_exercise_notes_updated_at before update on user_exercise_notes
  for each row execute function set_updated_at();
