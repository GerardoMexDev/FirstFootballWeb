-- ============================================================================
-- Football First — Migración 0027: `proximos_partidos_contenido`
--
-- Filtro "Contenido" de /partidos (pedido de Gerardo 2026-09-29, opción 1): muestra las fechas
-- de Contenido MÁS los partidos de los jugadores que son SOLO de Contenido (hoy Rodrigo Aguirre,
-- Tigres — la sync de SportMonks los trae desde 0026). `proximos_partidos` (0017) los excluye
-- a propósito y así sigue: la lista normal, el calendario Match Day y `agenda_anual` no cambian.
--
-- Cuerpo EXACTO de `proximos_partidos` (0017) con el guardia invertido en el join de jugadores:
-- `not servicio_match_day and servicio_contenido`. Mismas columnas (el front usa el mismo tipo).
-- Solo lectura para usuarios logueados (Supabase da permisos por defecto a anon: se revocan).
--
-- Reversible: `drop view proximos_partidos_contenido`.
-- Football First. Creado 2026-09-29.
-- ============================================================================
begin;

create view proximos_partidos_contenido
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
join jugadores j           on j.id = pj.jugador_id
                          and not j.servicio_match_day and j.servicio_contenido -- solo Contenido
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

comment on view proximos_partidos_contenido is 'Como proximos_partidos (0017) pero solo jugadores de Contenido que NO son de Match Day. Alimenta el filtro "Contenido" de /partidos (0027).';

revoke all on proximos_partidos_contenido from anon, authenticated;
grant select on proximos_partidos_contenido to authenticated;

commit;
