-- SPDX-License-Identifier: AGPL-3.0-only
-- Marca de tiempo de cuándo se completó cada serie, para calcular el descanso
-- entre series. Se estampa por trigger (no desde el cliente), porque completar
-- ocurre en dos lugares (SetRow y el auto-complete de la última serie).
-- Hereda la RLS de workout_sets.
-- Down: drop trigger workout_sets_completed_at on workout_sets;
--       drop function stamp_set_completed(); alter table workout_sets drop column completed_at;
alter table workout_sets add column if not exists completed_at timestamptz;

create or replace function stamp_set_completed()
returns trigger language plpgsql as $$
begin
  if new.completed and not coalesce(old.completed, false) then
    new.completed_at := now();
  elsif not new.completed and coalesce(old.completed, false) then
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists workout_sets_completed_at on workout_sets;
create trigger workout_sets_completed_at before update on workout_sets
  for each row execute function stamp_set_completed();
