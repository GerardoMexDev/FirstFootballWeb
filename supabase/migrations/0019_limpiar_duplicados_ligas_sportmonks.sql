-- ============================================================================
-- Football First — Migración 0019: limpiar partidos duplicados en las 5 ligas de SportMonks
--
-- Al revisar el hallazgo de "temporada real" (0018), aparecieron 117 filas de `partidos` en
-- las 5 ligas domésticas (Arabia/Liga MX/Brasil/Chile/Bélgica) que NO son de SportMonks:
--   · ~110 de ESPN — el puente `sync-fixtures-espn` (retirado hoy, migración 0016) trajo la
--     temporada completa de estos mismos clubes ANTES de SportMonks; quedaron sin limpiar.
--   · ~13 de API-Football — corridas de `sync-partidos` de ANTES del filtro
--     `LIGAS_DOMESTICAS_SPORTMONKS` de hoy (avances.md, Sesión 9).
-- 4 de esas filas de API-Football hasta tenían `estadisticas_partido` propia — duplicando el
-- conteo de partidos/minutos de `temporada_actual` para Fede/Kevin Amaro/Martín Fernández
-- frente a la fila (mejor, con convocatoria real) que ya trajo SportMonks para el MISMO partido.
--
-- Por qué borrar y no solo dejar que el dedup de las vistas las tape: `proximos_partidos`
-- desempata prefiriendo SIEMPRE `api-football` sobre cualquier otro proveedor —eso tenía
-- sentido cuando ESPN no daba convocatoria/estadísticas y API-Football sí, dentro de su
-- ventana corta. Hoy es al revés: la fila de SportMonks es la buena (convocatoria +
-- estadísticas reales) y la de API-Football es la vieja/incompleta para estas 5 ligas. Dejarlas
-- vivas es un riesgo silencioso: alcanza con que la fila vieja tenga un `sincronizado_en` más
-- reciente en algún escenario para que el desempate la vuelva a mostrar en vez de la de
-- SportMonks. Más simple y más seguro: que dejen de existir.
--
-- `on delete cascade` (0001) limpia solo `partidos_jugadores` y `estadisticas_partido` de
-- estas filas — nada de otras ligas/copas se toca.
-- ============================================================================

begin;

delete from partidos
where competencia_id in (
  select id from competencias where id_externo in ('262', '144', '71', '265', '307')
)
and proveedor_externo is distinct from 'sportmonks';

commit;
