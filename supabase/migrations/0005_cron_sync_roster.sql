-- ============================================================================
-- Football First — Migración 0005: recurso 'roster' + pg_cron para sync-roster
--
-- 1. Agrega 'roster' al enum recurso_sync para que la bitácora `sincronizaciones` pueda
--    registrar las corridas de sync-roster (detección de cambio de club).
--    ALTER TYPE ... ADD VALUE no puede ir dentro de un bloque de transacción explícito,
--    así que va suelto y ANTES del begin/commit del cron.
--
-- 2. Agenda sync-roster una vez por semana (lunes 04:00 UTC — después del sync-partidos
--    diario de las 03:00, para no encimar llamadas a la API). Los traspasos no cambian a
--    diario; semanal alcanza y no alarga el run de partidos ni arriesga su timeout.
--
-- Mismo patrón que 0002: el secreto (x-sync-secret) sale de Supabase Vault por nombre,
-- nunca en texto plano acá. timeout amplio: sync-roster hace 1 llamada por jugador (6) +
-- 1 de /transfers por cada cambio detectado, espaciadas ~6,5 s.
-- ============================================================================

alter type recurso_sync add value if not exists 'roster';

begin;

select cron.schedule(
  'sync-roster-semanal',
  '0 4 * * 1',
  $cron$
  select net.http_post(
    url     := 'https://thplgzufenxrzegwfxkg.functions.supabase.co/sync-roster',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_functions_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);

commit;
