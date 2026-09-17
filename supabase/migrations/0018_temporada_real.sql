-- ============================================================================
-- Football First — Migración 0018: temporada real (no año calendario) en `temporada_actual`
--
-- Pedido de Gerardo 2026-09-16 (Sesión 9): los números "Este año" no coinciden con lo que se
-- ve en internet para las 5 ligas domésticas (Arabia/Liga MX/Brasil/Chile/Bélgica). Causa
-- documentada desde el propio 0007: `temporada_actual` aproxima "temporada" con AÑO CALENDARIO
-- porque el esquema no sabía cuándo arranca/termina cada torneo. Eso funciona más o menos para
-- Brasil/Chile (~año calendario) pero mezcla DOS temporadas reales para México/Bélgica/Arabia
-- (temporada partida ~agosto-mayo): el Clausura que termina en mayo y el Apertura que arranca
-- en agosto quedan sumados como si fueran una sola "temporada 2026".
--
-- Ahora que SportMonks da el `season_id` real de cada fixture (agregado a `partidos` en esta
-- migración), se puede agrupar por temporada real para esas 5 ligas, sin tocar nada del resto
-- (copas/continentales de API-Football, sin `temporada_externa`, siguen por año calendario
-- como siempre — no hay de dónde sacarles una temporada real hoy).
--
-- Regla de la vista: para un partido con `temporada_externa` conocida, entra si coincide con
-- la temporada VIGENTE de esa competencia (la de su fixture más cercano a "ahora" — pasado o
-- futuro; con toda la temporada ya guardada, siempre hay uno cerca mientras la liga esté
-- activa). Para un partido sin `temporada_externa` (copas, API-Football), sigue el criterio
-- viejo de año calendario — sin cambios ahí.
--
-- Aditiva y reversible: la columna es nullable, la vista es `create or replace` (no `drop`).
-- ============================================================================

begin;

alter table partidos add column temporada_externa text;
comment on column partidos.temporada_externa is
  'season_id de SportMonks (temporada real del torneo). NULL para partidos de otros proveedores (copas/continentales de API-Football) — esos siguen agrupándose por año calendario en temporada_actual.';

create or replace view temporada_actual
with (security_invoker = true) as
with temporada_vigente as (
  -- Por competencia, la temporada real (season_id) del partido guardado más cercano a "ahora"
  -- (pasado o futuro). Con la temporada completa guardada, mientras la liga esté activa
  -- siempre hay un partido cerca — y ese define cuál es "la actual", sin adivinar fechas de
  -- corte. Si la liga está de receso justo en el punto medio entre dos temporadas, puede
  -- quedar ambiguo por un rato corto — caso raro, no se resuelve más fino por ahora.
  select distinct on (competencia_id)
    competencia_id,
    temporada_externa
  from partidos
  where temporada_externa is not null and competencia_id is not null
  order by competencia_id, abs(extract(epoch from (inicio_utc - now())))
)
select
  pj.jugador_id,
  count(*)                              as partidos,
  sum(ep.minutos)                       as minutos,
  sum(ep.goles)                         as goles,
  sum(ep.asistencias)                   as asistencias,
  sum(ep.amarillas)                     as amarillas,
  sum(ep.rojas)                         as rojas,
  round(avg(ep.valoracion), 2)          as valoracion_promedio
from estadisticas_partido ep
join partidos_jugadores pj
  on pj.partido_id = ep.partido_id and pj.jugador_id = ep.jugador_id
join partidos p
  on p.id = ep.partido_id
left join temporada_vigente tv
  on tv.competencia_id = p.competencia_id
where pj.con_seleccion = false
  and p.inicio_utc is not null
  and (
    (p.temporada_externa is not null and p.temporada_externa = tv.temporada_externa)
    or (
      p.temporada_externa is null
      and date_part('year', p.inicio_utc at time zone 'America/Montevideo')
          = date_part('year', now() at time zone 'America/Montevideo')
    )
  )
group by pj.jugador_id;

comment on view temporada_actual is
  'Números del jugador en la temporada REAL en curso (0018: season_id de SportMonks para las 5 ligas domésticas) o año calendario para el resto (copas/continentales sin temporada real conocida). Solo partidos de club. Un jugador sin partidos no aparece — "sin datos de temporada", nunca ceros.';

commit;
