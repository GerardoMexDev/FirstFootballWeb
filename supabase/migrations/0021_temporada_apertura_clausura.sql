-- ============================================================================
-- Football First — Migración 0021: "Apertura"/"Clausura" para Liga MX
--
-- Pedido de Gerardo 2026-09-16 (Sesión 9, sobre la 0020): que el label diga "Apertura 2026" /
-- "Clausura 2027" para Liga MX en vez de "Este año (2026)". SportMonks no da ese nombre como
-- texto (`GET /seasons/{id}` solo da "2025/2026"/"2026/2027" — el año "académico", no el
-- torneo) — se deriva del MES de inicio de la temporada, que sí es un dato real: Liga MX
-- arranca el Apertura en julio y el Clausura en enero (verificado en vivo: temporada 28009,
-- "2026/2027", `starting_at: 2026-07-17` — es el Apertura, pese al nombre "2026/2027").
--
-- `temporada_actual` gana `temporada_inicio` (fecha real de arranque de la temporada vigente,
-- no solo el año) — el frontend decide el rótulo "Apertura"/"Clausura" a partir del mes, y
-- SOLO para Liga MX (Toluca/Atlante); el resto de las ligas (Bélgica/Arabia/Brasil/Chile) no
-- usa esa terminología y sigue con "Temporada AAAA-AAAA" / "Este año (AAAA)" como en 0020.
--
-- Aditiva y reversible: mismo criterio de 0018/0020, una columna más al final.
-- ============================================================================

begin;

create or replace view temporada_actual
with (security_invoker = true) as
with rango_temporada as (
  select
    competencia_id,
    temporada_externa,
    min(inicio_utc)                                                           as inicio,
    min(date_part('year', inicio_utc at time zone 'America/Montevideo'))::int as anio_desde,
    max(date_part('year', inicio_utc at time zone 'America/Montevideo'))::int as anio_hasta
  from partidos
  where temporada_externa is not null and competencia_id is not null
  group by competencia_id, temporada_externa
),
temporada_vigente as (
  select distinct on (p.competencia_id)
    p.competencia_id,
    p.temporada_externa,
    rt.inicio,
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
  max(tv.anio_hasta)                    as temporada_anio_hasta,
  max(tv.inicio)                        as temporada_inicio
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
  'Números del jugador en la temporada REAL en curso (season_id de SportMonks para las 5 ligas domésticas) o año calendario para el resto. temporada_anio_desde/hasta (0020) + temporada_inicio (0021, fecha real de arranque — el frontend deriva "Apertura"/"Clausura" para Liga MX a partir del mes). Solo partidos de club.';

commit;
