-- Descanso registrado por serie (segundos), medido con el cronómetro de
-- descanso: arranca al tildar una serie y se detiene al empezar la siguiente.
-- Lo escribe el cliente (no un trigger). Hereda la RLS de workout_sets.
-- Down: alter table workout_sets drop column rest_seconds;
alter table workout_sets add column if not exists rest_seconds integer;
