-- ============================================================================
-- Football First — Migración 0016: pg_cron para sync-partidos-sportmonks
--                                    + apaga el cron de sync-fixtures-espn
--
-- NO APLICAR hasta que `sync-partidos-sportmonks` esté DESPLEGADA y PROBADA a mano (curl con
-- x-sync-secret) — ver planeacion/avances.md, sección "Evaluación SportMonks". Si se aplica
-- antes, queda una ventana sin cobertura de temporada completa para las 5 ligas domésticas
-- (ni ESPN, que se apaga acá, ni SportMonks, que todavía no correría).
--
-- Ocupa el mismo horario que tenía `sync-fixtures-espn` (03:30 UTC, después del
-- `sync-partidos` de las 03:00). `recurso` = 'partidos' (ya existe en el enum). `proveedor` =
-- 'sportmonks' distingue estas corridas en la bitácora `sincronizaciones`.
--
-- `timeout_milliseconds`: un solo `include` trae equipos+estado+sede+alineaciones por club en
-- 1-2 páginas (a diferencia de ESPN, que hacía 1 llamada por evento) — la corrida completa de
-- los 6 clubes debería ser bastante más rápida que los ~80s de ESPN, pero se deja el mismo
-- margen de 300s por las dudas de la primera corrida.
--
-- Mismo patrón que 0002/0005/0006/0012: el secreto (x-sync-secret) sale de Supabase Vault por
-- nombre, nunca en texto plano acá.
-- ============================================================================

begin;

select cron.unschedule('sync-fixtures-espn-diario');

select cron.schedule(
  'sync-partidos-sportmonks-diario',
  '30 3 * * *',
  $cron$
  select net.http_post(
    url     := 'https://thplgzufenxrzegwfxkg.functions.supabase.co/sync-partidos-sportmonks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_functions_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);

commit;
