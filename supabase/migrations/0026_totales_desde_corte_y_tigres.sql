-- ============================================================================
-- Football First — Migración 0026: totales de carrera sin doble conteo + Tigres/Aguirre
--
-- 1) `totales_jugador` (0003) sumaba a la base manual TODAS las estadísticas sincronizadas,
--    también las de partidos anteriores a `base_actualizada_en` — que la base ya incluye.
--    Con el backfill de SportMonks (2026-09-16) eso infló los totales (ej. Nández 422 en vez
--    de 389 partidos, +8 goles; Pereira 263 en vez de 229) y con ellos el motor de hitos.
--    Ahora solo se suman partidos posteriores a la fecha de corte (día de Uruguay). Sin
--    fecha de corte se suma todo, como antes. No borra datos: solo cambia la suma.
--    `temporada_actual` (0007) no se toca: cuenta la temporada entera, que es lo correcto.
--
-- 2) Ids de SportMonks de Tigres UANL (609) y Rodrigo Aguirre (129658), verificados en vivo
--    2026-09-29 (Aguirre por fecha de nacimiento 1994-10-01, titular en la temporada). Aguirre
--    es solo Contenido y hasta hoy la sync de SportMonks tomaba solo Match Day → su temporada
--    salía vacía. El código de la sync ya incluye Contenido y a Tigres (CLUBES_SPORTMONKS).
--
-- Reversible: volver a crear la vista con el cuerpo de 0003 y poner los 2 ids en null.
-- Football First. Creado 2026-09-29.
-- ============================================================================
begin;

create or replace view totales_jugador
with (security_invoker = true) as
select
  j.id as jugador_id,
  j.carrera_partidos_base
    + coalesce(count(ep.id) filter (where pj.con_seleccion = false), 0)       as carrera_partidos,
  j.carrera_goles_base
    + coalesce(sum(ep.goles) filter (where pj.con_seleccion = false), 0)      as carrera_goles,
  j.carrera_asistencias_base
    + coalesce(sum(ep.asistencias) filter (where pj.con_seleccion = false), 0) as carrera_asistencias,
  j.seleccion_partidos_base
    + coalesce(count(ep.id) filter (where pj.con_seleccion = true), 0)       as seleccion_partidos,
  j.seleccion_goles_base
    + coalesce(sum(ep.goles) filter (where pj.con_seleccion = true), 0)      as seleccion_goles
from jugadores j
left join partidos_jugadores pj on pj.jugador_id = j.id
left join partidos p on p.id = pj.partido_id
-- Solo lo jugado DESPUÉS del corte: lo anterior ya está en la base manual.
left join estadisticas_partido ep
  on ep.partido_id = pj.partido_id
 and ep.jugador_id = pj.jugador_id
 and (j.base_actualizada_en is null
      or (p.inicio_utc at time zone 'America/Montevideo')::date > j.base_actualizada_en)
group by j.id;

comment on view totales_jugador is
  'Base manual (jugadores.*_base, hasta base_actualizada_en) + estadisticas_partido de partidos posteriores a esa fecha (0026). NULL si la base no se cargó — nunca 0 por defecto.';

update clubes set id_externo_sportmonks = '609'
where proveedor_externo = 'api-football' and id_externo = '2279';      -- Tigres UANL

update jugadores set id_externo_sportmonks = '129658'
where proveedor_externo = 'api-football' and id_externo = '16482';     -- Rodrigo Aguirre

commit;
