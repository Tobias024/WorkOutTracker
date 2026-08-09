-- Modela el objetivo como DOS dimensiones ortogonales, en vez del enum `goal`:
--   training_profile: fuerza | hipertrofia | resistencia   (qué se prioriza al entrenar)
--   body_objective:   superavit | mantenimiento | deficit  (modificador de composición)
-- "Pérdida de grasa" = hipertrofia + deficit (no es un 4º perfil).
-- No destructivo: la columna `goal` se conserva (deprecada; se sincroniza desde
-- la app para no romper el scoreboard). Down: drop de las 2 columnas nuevas.
alter table profiles add column if not exists training_profile text
  check (training_profile in ('fuerza', 'hipertrofia', 'resistencia'));

alter table profiles add column if not exists body_objective text
  default 'mantenimiento'
  check (body_objective in ('superavit', 'mantenimiento', 'deficit'));

-- Backfill desde el goal viejo (sobre TODAS las filas: goal null → ambos null).
update profiles set
  training_profile = case
    when goal = 'perdida_grasa' then 'hipertrofia'
    when goal in ('fuerza', 'hipertrofia', 'resistencia') then goal
    else null
  end,
  body_objective = case
    when goal = 'perdida_grasa' then 'deficit'
    when goal in ('fuerza', 'hipertrofia', 'resistencia') then 'mantenimiento'
    else null
  end;

-- TODO (fuera de scope): versionar ambos campos por bloque con fecha inicio/fin
-- para que el histórico sea interpretable. Por ahora es preferencia de perfil.
