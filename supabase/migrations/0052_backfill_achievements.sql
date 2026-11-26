-- SPDX-License-Identifier: AGPL-3.0-only
-- Backfill de logros: record_session_achievements falló SIEMPRE desde que se
-- creó (0015) por el 42702 que arregló 0051, así que `achievements` quedó
-- vacía (0 filas el 2026-11-26) aunque había 162 sesiones terminadas. Esto
-- corre la función para cada sesión terminada, en orden cronológico, como si
-- se hubiera ejecutado al cerrarla.
--
-- Por qué así:
--   * Se llama a la misma función que usa la app (no se reimplementa la
--     lógica): los PRs salen idénticos a los que se habrían registrado.
--     Cada llamada compara sólo contra sesiones ANTERIORES (created_at <),
--     así que el orden no cambia el resultado, y es idempotente (borra y
--     recrea los logros de esa sesión).
--   * auth.uid() se simula por sesión con request.jwt.claims (local a la
--     transacción). Una sesión que falle no frena el resto.
--   * created_at de cada logro = ended_at de su sesión: Registro los lista
--     por fecha y no deberían aparecer todos como "de hoy".
--   * volume_pr_week: en vivo, cada sesión de una semana récord suma una
--     fila, pero retroactivamente todas verían el total final de la semana
--     (filas idénticas). Se deja una por usuario-semana (la última sesión).
--   * Las rachas (streak_milestone) se calculan contra la racha ACTUAL, igual
--     que en vivo: los hitos pasados que ya se cortaron no se recuperan.
--
-- Reversible: la tabla estaba vacía, `delete from achievements` vuelve atrás.

do $$
declare
  s record;
begin
  for s in
    select id, user_id from workout_sessions
    where ended_at is not null
    order by created_at
  loop
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', s.user_id, 'role', 'authenticated')::text,
      true
    );
    begin
      perform * from public.record_session_achievements(s.id);
    exception when others then
      raise warning 'backfill: sesión % falló: %', s.id, sqlerrm;
    end;
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $$;

update achievements a
set created_at = ws.ended_at
from workout_sessions ws
where a.kind in ('e1rm_pr', 'volume_pr_week')
  and ws.id = (a.payload ->> 'session_id')::uuid;

delete from achievements a
using (
  select a2.id,
         row_number() over (
           partition by a2.user_id, date_trunc('week', ws.created_at)
           order by ws.created_at desc
         ) as rn
  from achievements a2
  join workout_sessions ws on ws.id = (a2.payload ->> 'session_id')::uuid
  where a2.kind = 'volume_pr_week'
) d
where a.id = d.id and d.rn > 1;
