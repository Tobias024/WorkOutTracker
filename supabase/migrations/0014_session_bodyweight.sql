-- SPDX-License-Identifier: AGPL-3.0-only
-- Peso corporal por sesión (opcional): habilita el ratio fuerza/peso corporal.
-- Columna nueva → hereda la RLS de workout_sessions, sin policy nueva.
-- Down: alter table workout_sessions drop column body_weight_kg;
alter table workout_sessions
  add column if not exists body_weight_kg numeric(5, 2);
