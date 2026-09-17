-- ============================================================================
-- Football First — Migración 0020: rango de años real de la temporada vigente
--
-- Pedido de Gerardo 2026-09-16 (Sesión 9, sobre la 0018): el label "Este año (2026)" del
-- panel de jugador debería decir algo como "Temporada 2026-2027" para las ligas de temporada
-- partida (México/Bélgica/Arabia), no siempre el año calendario — sobre todo ahora que las
-- ESTADÍSTICAS mostradas ya son de la temporada real (0018), el rótulo quedaba desactualizado.
--
-- `temporada_actual` gana 2 columnas: `temporada_anio_desde` / `temporada_anio_hasta` — el
-- año de inicio y fin de la temporada vigente de la competencia doméstica del jugador, sacado
-- de TODOS los partidos guardados con esa `temporada_externa` (no solo los ya jugados, así el
-- rango sale completo desde el arranque de la temporada aunque todavía se haya jugado poco —
-- caso Nahitan, temporada nueva recién empezada). Si son el mismo año (Brasil/Chile, ~año
-- calendario) o no hay `temporada_externa` (copas/API-Football, solo año calendario), el
-- frontend sigue mostrando "Este año (AAAA)" como hasta ahora — eso lo decide el componente,
-- no la vista.
--
-- Aditiva y reversible: mismas filas/criterio de 0018, solo se agregan 2 columnas al final.
-- ============================================================================

begin;

create or replace view temporada_actual
with (security_invoker = true) as
with rango_temporada as (
  select
    competencia_id,
    temporada_externa,
    min(date_part('year', inicio_utc at time zone 'America/Montevideo'))::int as anio_desde,
    max(date_part('year', inicio_utc at time zone 'America/Montevideo'))::int as anio_hasta
  from partidos
  where temporada_externa is not null and competencia_id is not null
  group by competencia_id, temporada_externa
),
temporada_vigente as (
  -- Por competencia, la temporada real (season_id) del partido guardado más cercano a "ahora"
  -- (pasado o futuro), junto con el rango de años de ESA temporada completa.
  select distinct on (p.competencia_id)
    p.competencia_id,
    p.temporada_externa,
    rt.anio_desde,
    rt.anio_hasta
  from partidos p
  join rango_temporada rt
    on rt.competencia_id = p.competencia_id and rt.temporada_externa = p.temporada_externa
  where p.temporada_externa is not null and p.competencia_id is not null
  order by p.competencia_id, abs(extract(epoch from (p.inicio_utc - now())))
)
select
  pj.jugador_id,
  count(*)                              as partidos,
  sum(ep.minutos)                       as minutos,
  sum(ep.goles)                         as goles,
  sum(ep.asistencias)                   as asistencias,
  sum(ep.amarillas)                     as amarillas,
  sum(ep.rojas)                         as rojas,
  round(avg(ep.valoracion), 2)          as valoracion_promedio,
  max(tv.anio_desde)                    as temporada_anio_desde,
  max(tv.anio_hasta)                    as temporada_anio_hasta
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
  'Números del jugador en la temporada REAL en curso (season_id de SportMonks para las 5 ligas domésticas) o año calendario para el resto. temporada_anio_desde/hasta (0020): rango de años de esa temporada completa (min/max de TODOS sus partidos, jugados o no) — NULL si no hay temporada real conocida (el frontend cae a año calendario). Solo partidos de club.';

commit;
