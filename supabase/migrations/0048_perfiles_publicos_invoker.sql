-- ============================================================================
-- 0048 — `perfiles_publicos` deja de ser una vista SECURITY DEFINER. 2026-10-28.
-- Aviso CRITICAL del Security Advisor de Supabase ("Security Definer View",
-- lint 0010_security_definer_view) que vio Gerardo al cerrar la sesión.
-- ============================================================================
-- Por qué existía así (0025): la RLS de `perfiles` deja ver solo la fila propia, y la UI
-- necesita el nombre de quien creó o comentó un ticket. La vista corría con los permisos del
-- dueño para mostrar SOLO id/nombre/cargo, y solo a usuarios activos. No había fuga real
-- (anon sin permisos, authenticated solo SELECT, filtro es_usuario_activo()), pero el
-- patrón es el que marca el linter, y además la vista era auto-actualizable: dependía de que
-- nunca se le devolviera un INSERT/UPDATE a `authenticated`.
--
-- Ahora: el salto de permisos vive en una función acotada (`perfiles_publicos_filas`,
-- SECURITY DEFINER, search_path fijo, solo esas 3 columnas, solo para usuarios activos) y la
-- vista pasa a `security_invoker = true` leyendo de la función. Misma salida, mismas columnas
-- y mismo nombre: `tickets_vista`, `tickets_historial_vista` y `tickets_match_day` no cambian.
-- Una vista sobre una función no es auto-actualizable: ya no se puede escribir a través de ella.
-- Reversible: recrear la vista con el cuerpo de 0025 (sin security_invoker) y
-- `drop function perfiles_publicos_filas()`.
-- ============================================================================
begin;

create or replace function perfiles_publicos_filas()
returns table (id uuid, nombre_completo text, cargo text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre_completo, p.cargo
  from perfiles p
  where es_usuario_activo();
$$;

comment on function perfiles_publicos_filas() is
  'id/nombre/cargo de todos los perfiles, solo para usuarios activos (0048). La usa la vista perfiles_publicos.';

revoke execute on function perfiles_publicos_filas() from public, anon;
grant execute on function perfiles_publicos_filas() to authenticated;

create or replace view perfiles_publicos with (security_invoker = true) as
  select f.id, f.nombre_completo, f.cargo
  from perfiles_publicos_filas() f;

revoke all on perfiles_publicos from anon, authenticated;
grant select on perfiles_publicos to authenticated;

commit;
