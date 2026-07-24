-- Objetivo de entrenamiento del perfil. Cambia qué métricas se promocionan a
-- portada en Registro (no qué se calcula). Nullable: perfiles viejos quedan en
-- "General" (orden actual) hasta elegir. Hereda la RLS de profiles.
-- Down: alter table profiles drop column goal;
alter table profiles
  add column if not exists goal text
    check (goal in ('fuerza', 'hipertrofia', 'resistencia', 'perdida_grasa'));
