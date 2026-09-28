-- ============================================================================
-- 0024 — Blindaje de `perfiles` (login de los 4 usuarios, Sesión 12, 2026-09-28)
-- ============================================================================
-- Dos huecos encontrados por scripts/seguridad.test.mjs:
--
-- 1. La política `perfiles_update_propio` (0001) solo congelaba `rol`: cada usuario podía
--    cambiarse su propio `cargo` (p.ej. darse "Administrador") o su `activo`. La pantalla
--    "Mi cuenta" ya decía que eso lo cambia solo un admin; ahora la base lo hace cumplir.
--    Se resuelve con un trigger (no con la política) porque compara OLD vs NEW sin
--    subconsultas y cubre cualquier columna protegida que se sume después.
--
-- 2. `handle_new_user` creaba el perfil con `activo = true` (el default de la tabla):
--    cualquier usuario nuevo de Auth pasaba `es_usuario_activo()` y leía todos los datos.
--    Con el registro público apagado no debería aparecer ninguno, pero si alguna vez se
--    prende por error, la cuenta nueva queda sin acceso hasta que un admin la active.
--    `scripts/seed-usuarios.mjs` activa explícitamente las 4 cuentas fijas.
--
-- Quién puede cambiar las columnas protegidas: `service_role` (scripts de admin) y las
-- conexiones directas a Postgres (SQL Editor), donde no hay JWT y auth.role() es NULL.
-- ============================================================================
begin;

-- 1. Columnas protegidas: rol, cargo, activo, id, creado_en.
create or replace function perfiles_proteger_columnas()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and (
       new.id        is distinct from old.id
    or new.rol       is distinct from old.rol
    or new.cargo     is distinct from old.cargo
    or new.activo    is distinct from old.activo
    or new.creado_en is distinct from old.creado_en
  ) then
    raise exception 'Solo un administrador puede cambiar rol, cargo o estado de un perfil'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_proteger_columnas on perfiles;
create trigger perfiles_proteger_columnas
  before update on perfiles
  for each row execute function perfiles_proteger_columnas();

-- 2. Los perfiles nuevos nacen inactivos.
alter table perfiles alter column activo set default false;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre_completo, activo)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre_completo', ''), false)
  on conflict (id) do nothing;
  return new;
end;
$$;

commit;
