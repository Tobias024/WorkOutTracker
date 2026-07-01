-- Sexo del perfil — habilita dividir los boards por género más adelante.
-- 'male' | 'female'. Nullable: perfiles viejos quedan sin definir.
alter table profiles
  add column if not exists sex text check (sex in ('male', 'female'));
