-- ============================================================================
-- Football First — Migración 0007: vista `temporada_actual`
--
-- La ficha de jugador (vista `jugadores`) muestra un bloque "Este año" con los
-- números del jugador en lo que va del año calendario. El esquema NO tiene un
-- concepto de "temporada" (cada liga arranca en un mes distinto: Bélgica y Arabia
-- ~agosto, México/Brasil/Chile ~enero), así que se aproxima con el AÑO CALENDARIO
-- en curso en hora de Uruguay. Queda anotado como pendiente afinar al corte real
-- de cada competencia (planeacion/avances.md §5).
--
-- Fuente: `estadisticas_partido` (una fila por partido jugado, la llena
-- `sync-estadisticas`). Igual criterio que `totales_jugador` (migración 0003):
-- solo cuenta partidos de CLUB (`partidos_jugadores.con_seleccion = false`) — las
-- stats de selección van por la base manual hasta que exista un sync de selección.
--
-- Un jugador sin filas este año simplemente NO aparece en la vista → la ficha
-- muestra "la temporada recién arranca", no ceros (contexto.md §10).
--
-- NULL-ables a propósito: `minutos` y `valoracion_promedio` quedan NULL si la
-- fuente no trae el dato (p.ej. Liga de Expansión MX sin cobertura). `goles` /
-- `asistencias` / tarjetas ya vienen normalizados a 0 desde `_shared/estadisticas.ts`
-- cuando el jugador tuvo línea de juego, así que ahí la suma es un número real.
-- ============================================================================

begin;

create or replace view temporada_actual
with (security_invoker = true) as
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
where pj.con_seleccion = false
  and p.inicio_utc is not null
  and date_part('year', p.inicio_utc at time zone 'America/Montevideo')
      = date_part('year', now() at time zone 'America/Montevideo')
group by pj.jugador_id;

comment on view temporada_actual is
  'Números del jugador en el año calendario en curso (hora de Uruguay), solo partidos de club. Un jugador sin partidos este año no aparece — la ficha lo trata como "sin datos de temporada", nunca ceros.';

commit;
