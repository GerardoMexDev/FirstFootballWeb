-- ============================================================================
-- Football First — Migración 0012: pg_cron para sync-fixtures-espn
--
-- Agenda el disparo diario de la Edge Function `sync-fixtures-espn` vía pg_net. Trae el
-- calendario de liga doméstica de la temporada completa desde ESPN (gratis) para cubrir el
-- hueco de la ventana de ~3 días del plan free de API-Football (avances.md §5).
--
-- Horario: 03:30 UTC — DESPUÉS del `sync-partidos` diario de las 03:00 y ANTES del
-- `sync-roster` semanal de los lunes 04:00, para no encimar corridas.
--
-- `recurso` en la bitácora = 'partidos' (ya existe en el enum `recurso_sync`, no hace falta
-- ALTER TYPE). El `proveedor` = 'espn' distingue estas corridas de las de API-Football.
--
-- `timeout_milliseconds`: la primera corrida pide el detalle de ~30 eventos por cada uno de
-- los 6 clubes, espaciados 250 ms (~50-80 s). Las siguientes solo re-consultan lo que está
-- en la ventana [-3d, +14d], así que son cortas. 300 s deja margen para la primera.
--
-- Mismo patrón que 0002/0005: el secreto (x-sync-secret) sale de Supabase Vault por nombre,
-- nunca en texto plano acá.
-- ============================================================================

begin;

select cron.schedule(
  'sync-fixtures-espn-diario',
  '30 3 * * *',
  $cron$
  select net.http_post(
    url     := 'https://thplgzufenxrzegwfxkg.functions.supabase.co/sync-fixtures-espn',
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
