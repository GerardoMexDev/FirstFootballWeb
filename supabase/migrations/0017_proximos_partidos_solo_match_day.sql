-- ============================================================================
-- Football First — Migración 0017: `proximos_partidos` solo para Match Day
--
-- Bug reportado por Gerardo en producción 2026-09-16 (Sesión 9): en `/partidos` (y por lo
-- tanto en `/calendario`, Match Day) aparecía un partido de Nacional (Uruguay) con dos
-- representados de servicio CONTENIDO (Maximiliano Silvera, Gastón Martirena) — jugadores que
-- NO son de Match Day y cuyo fixture no se sigue.
--
-- Causa raíz: `proximos_partidos` (0011/0013) nunca filtró por `jugadores.servicio_match_day`
-- — la migración 0014 (Calendario General) le puso ese guardia a los bloques 4/5/6 de
-- `agenda_anual` pero dejó explícitamente sin tocar el bloque 1 (partidos), asumiendo que
-- `partidos_jugadores` solo tenía filas de jugadores Match Day. Esa asunción dejó de ser
-- cierta: ANTES del fix de Sesión 8 (`abb9f98`, "filtrar servicio_match_day en sync-partidos/
-- sync-fixtures-espn/sync-roster"), los sync sí creaban filas de puente para jugadores de
-- Contenido. El fix de Sesión 8 frenó las filas NUEVAS pero no limpió las 7 que ya existían
-- (Silvera, Martirena, Aguirre, Romero, Hernández — verificado en vivo).
--
-- Efecto: `agenda_anual` (Match Day) hereda el fix gratis, sin tocar su propia definición —
-- su bloque 1 ya sale `from proximos_partidos`, así que basta con arreglar acá.
--
-- `create or replace` con la definición EXACTA de 0013 + `and j.servicio_match_day` en el
-- join de jugadores. Columnas de salida sin cambios (mismo orden/tipo) — aditivo y reversible
-- (revertir = `create or replace` con el cuerpo de 0013).
-- ============================================================================

begin;

create or replace view proximos_partidos
with (security_invoker = true) as
select distinct on (
  pj.jugador_id,
  pj.con_seleccion,
  coalesce((p.inicio_utc at time zone 'America/Montevideo')::date::text, 'sinfecha:' || p.id::text)
)
  p.id                         as partido_id,
  pj.jugador_id,
  j.nombre                     as jugador_nombre,
  j.apodo                      as jugador_apodo,
  j.foto_url                   as jugador_foto_url,
  j.seleccion                  as jugador_seleccion,
  pj.con_seleccion,
  pj.convocado,
  c.id                         as competencia_id,
  c.nombre                     as competencia_nombre,
  c.codigo                     as competencia_codigo,
  c.tipo                       as competencia_tipo,
  (c.tipo in ('continental', 'seleccion')) as es_internacional,
  c.cobertura                  as competencia_cobertura,
  cl.id                        as club_id,
  cl.nombre                    as club_nombre,
  cl.escudo_url                as club_escudo_url,
  riv.id                       as rival_id,
  riv.nombre                   as rival_nombre,
  riv.escudo_url               as rival_escudo_url,
  p.es_local,
  p.inicio_utc,
  p.zona_horaria_evento,
  (p.inicio_utc at time zone p.zona_horaria_evento)      as inicio_local_sede,
  (p.inicio_utc at time zone 'America/Montevideo')       as inicio_local_uy,
  (p.inicio_utc at time zone 'America/Montevideo')::date as dia_uy,
  p.estado,
  p.ronda,
  p.estadio,
  p.ciudad,
  p.marcador_local,
  p.marcador_visitante,
  (p.inicio_utc is not null and p.inicio_utc > now() + interval '90 days') as tentativo,
  p.sincronizado_en,
  coalesce(
    (p.inicio_utc at time zone p.zona_horaria_evento)::date,
    (p.inicio_utc at time zone 'America/Montevideo')::date
  ) as dia_local_sede
from partidos p
join partidos_jugadores pj on pj.partido_id = p.id
join jugadores j           on j.id = pj.jugador_id and j.servicio_match_day -- NUEVO (0017)
left join competencias c   on c.id = p.competencia_id
left join clubes cl        on cl.id = j.club_actual_id
left join clubes riv on riv.id = case
  when j.club_actual_id = p.club_local_id then p.club_visitante_id
  else p.club_local_id
end
order by
  pj.jugador_id,
  pj.con_seleccion,
  coalesce((p.inicio_utc at time zone 'America/Montevideo')::date::text, 'sinfecha:' || p.id::text),
  (p.proveedor_externo is distinct from 'api-football'),
  p.sincronizado_en desc nulls last,
  p.id;

comment on view proximos_partidos is 'Fuente única de la vista partidos del frontend. Una fila por representado de Match Day (0017: servicio_match_day, nunca Contenido) por partido, de-duplicada por (jugador, día en Uruguay, con_selección). `dia_local_sede` (0013) = día civil en la sede.';

-- Limpieza de las 7 filas de puente pre-existentes de jugadores de Contenido (huérfanas desde
-- antes del fix de Sesión 8) — ya no las va a mostrar la vista, pero tampoco tiene sentido que
-- sigan en la tabla: Contenido no sigue fixture, por diseño (comentario de la 0014).
delete from partidos_jugadores pj
using jugadores j
where pj.jugador_id = j.id and j.servicio_match_day = false;

commit;
