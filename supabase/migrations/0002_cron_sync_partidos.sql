-- ============================================================================
-- Football First — Migración 0002: pg_cron para sync-partidos
--
-- Agenda el disparo diario de la Edge Function `sync-partidos` vía pg_net. El secreto que
-- autoriza la llamada (header `x-sync-secret`, ver supabase/functions/sync-partidos/index.ts)
-- vive en Supabase Vault, cargado aparte por `scripts/configurar-vault-cron.mjs` — este
-- archivo NUNCA tiene el valor real, solo lo referencia por nombre ('sync_functions_secret').
--
-- Frecuencia (contexto.md §7): fixture 1×/día, 03:00 UTC. La ventana de "días con partido
-- hoy cada 10-15 min" y la sync de estadísticas quedan para cuando existan esas Edge
-- Functions — no se agenda un job para algo que todavía no existe.
--
-- `timeout_milliseconds`: el default de pg_net es 5000 ms. sync-partidos pide la API día
-- por día con ~6,5 s de espera entre llamadas (límite de 10 req/min del plan free de
-- API-Football, ver supabase/functions/_shared/api-football.ts) — con la ventana de 5 días
-- por default tarda ~35-40 s. 60 s deja margen. Confirmado con una llamada manual: con el
-- default de 5 s, pg_net cortaba por timeout antes de que la función terminara.
-- ============================================================================

begin;

select cron.schedule(
  'sync-partidos-diario',
  '0 3 * * *',
  $cron$
  select net.http_post(
    url     := 'https://thplgzufenxrzegwfxkg.functions.supabase.co/sync-partidos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_functions_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);

commit;
