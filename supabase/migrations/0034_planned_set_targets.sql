-- SPDX-License-Identifier: AGPL-3.0-only
-- Separa el PLAN del REGISTRO en workout_sets.
--
-- Antes, `useStartWorkout` copiaba el plan de routine_sets dentro de
-- reps/weight, así que planeado y real compartían columna: apenas el usuario
-- tipeaba, el plan se perdía y ya no había con qué comparar. Estas columnas
-- guardan el snapshot del plan al arrancar la sesión (snapshot, no FK: si la
-- rutina se edita a mitad de semana la sesión en curso no debe cambiar, y los
-- ejercicios reemplazados no tienen routine_set que apuntar).

alter table workout_sets
  add column if not exists planned_reps int,
  add column if not exists planned_weight numeric,
  add column if not exists planned_duration_seconds int,
  add column if not exists planned_distance_m numeric;

comment on column workout_sets.planned_reps is
  'Snapshot del plan (routine_sets.target_reps) al crear la sesión. null = serie agregada a mano, sin plan.';

-- Backfill acotado a sesiones EN CURSO y series sin tildar: sólo ahí el valor
-- que hay en reps/weight es el plan copiado y no algo que el usuario registró.
-- Las sesiones cerradas quedan intactas a propósito: inventarles un plan
-- falsearía el historial y el coloreo por desvío mentiría sobre el pasado.
update workout_sets ws
set planned_reps             = ws.reps,
    planned_weight           = ws.weight,
    planned_duration_seconds = ws.duration_seconds,
    planned_distance_m       = ws.distance_m
from workout_exercises we
join workout_sessions s on s.id = we.session_id
where ws.workout_exercise_id = we.id
  and s.ended_at is null
  and not ws.completed;
