-- Altura y peso del perfil, para calcular BMI en el cliente (no se guarda,
-- se deriva de estos dos valores).
alter table profiles
  add column if not exists height_cm numeric(5, 1),
  add column if not exists weight_kg numeric(5, 1);
