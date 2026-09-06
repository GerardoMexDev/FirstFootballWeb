-- ============================================================================
-- Football First — Migración 0008: preferencia de tema por usuario
--
-- El toggle claro/oscuro de la barra superior guarda la preferencia acá (no en
-- localStorage) para que siga al usuario entre dispositivos. El layout raíz la lee
-- server-side y pinta `<html data-theme>` sin parpadeo.
--
-- La política RLS `perfiles_update_propio` (migración 0001) ya deja que cada quien
-- actualice su propia fila mientras no cambie `rol` — así el toggle escribe directo
-- desde el cliente, sin endpoint ni service_role.
-- ============================================================================

begin;

alter table perfiles
  add column tema text not null default 'claro'
    check (tema in ('claro', 'oscuro'));

comment on column perfiles.tema is
  'Preferencia de tema de la UI: claro | oscuro. La cambia el propio usuario desde la barra superior.';

commit;
