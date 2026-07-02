-- Plan semanal global por usuario: qué días de la semana planea entrenar.
-- 0 = domingo ... 6 = sábado (convención EXTRACT(dow)). La meta semanal es la
-- cantidad de días elegidos. Reemplaza el enfoque per-rutina (routine_schedule)
-- que no llegó a usarse.
alter table profiles
  add column if not exists planned_weekdays int[] not null default '{}';

drop table if exists routine_schedule cascade;
drop function if exists compliance_stats(date, date);
