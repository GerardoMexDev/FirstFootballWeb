-- ============================================================================
-- Football First — Migración 0006: pg_cron para sync-estadisticas
--
-- Agenda sync-estadisticas todos los días a las 05:00 UTC (después del sync-partidos de las
-- 03:00). Cada corrida procesa hasta 8 partidos terminados que todavía no tienen la línea de
-- estadísticas de algún representado (`partidos_jugadores.convocado IS NULL`); el resto
-- espera a la corrida siguiente, así el día después de un fin de semana con varios partidos
-- se pone al día en 1-2 corridas.
--
-- Mismo patrón que 0002/0005: secreto (x-sync-secret) desde Supabase Vault por nombre,
-- nunca en texto plano. timeout 150000: hasta ~2 llamadas por partido (estado + planilla)
-- espaciadas ~6,5 s por el límite de 10 req/min del plan free.
--
-- No hace falta tocar el enum: 'estadisticas' ya está en recurso_sync desde 0001.
-- ============================================================================

begin;

select cron.schedule(
  'sync-estadisticas-diario',
  '0 5 * * *',
  $cron$
  select net.http_post(
    url     := 'https://thplgzufenxrzegwfxkg.functions.supabase.co/sync-estadisticas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_functions_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $cron$
);

commit;
