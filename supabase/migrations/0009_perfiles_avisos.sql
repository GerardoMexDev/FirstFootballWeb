-- ============================================================================
-- Football First — Migración 0009: preferencias de notificación por usuario
--
-- La pestaña "Notificaciones" de "Mi cuenta" (panel de perfil) guarda 3 flags. El
-- ENVÍO de notificaciones es Fase 2; esto solo persiste la preferencia para cuando
-- exista, así la UI ya queda completa.
--
-- La política RLS `perfiles_update_propio` (0001) ya deja que el usuario actualice
-- su propia fila mientras no cambie `rol` → se escribe directo desde el cliente.
-- ============================================================================

begin;

alter table perfiles
  add column avisos jsonb not null
    default '{"hitos": true, "partidos": true, "resumen": true}'::jsonb;

comment on column perfiles.avisos is
  'Preferencias de notificación: {hitos, partidos, resumen} -> bool. El envío es Fase 2.';

commit;
