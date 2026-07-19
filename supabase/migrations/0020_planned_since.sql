-- Fecha desde la cual la meta de "días prometidos" está vigente. Se setea cada
-- vez que el usuario fija/cambia sus días. Sirve para NO juzgar como fallados
-- (ni pintar en rojo) los días ANTERIORES a esa fecha, que nunca se prometieron.
-- Columna nueva → hereda la RLS de profiles, sin policy nueva.
-- Down: alter table profiles drop column planned_since;
alter table profiles
  add column if not exists planned_since timestamptz;
