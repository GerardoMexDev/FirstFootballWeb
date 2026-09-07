-- ============================================================================
-- Football First — Migración 0011: de-duplicación de las vistas de partidos
--
-- Desde `sync-fixtures-espn` (avances.md §5) hay DOS fuentes de fixtures:
--   · API-Football  — ventana de ~3 días, trae el `fixture_id` que usa `sync-estadisticas`.
--   · ESPN          — temporada completa, pero le pone su propio id a cada club rival.
--
-- Un partido de esta semana lo traen las dos. No se puede cruzar por club (los ids de
-- rival no coinciden entre fuentes), así que se colapsa por (jugador, día en Uruguay,
-- con_selección): un representado no juega dos partidos de club el mismo día, entonces si
-- aparecen dos filas para ese día es el mismo partido por dos fuentes. Se prefiere la de
-- API-Football; si no está, la de ESPN; y a igualdad, la más recién sincronizada.
--
-- Dos vistas leen fixtures:
--   1. `proximos_partidos` — se le agrega el `distinct on`.
--   2. `agenda_anual`      — su bloque de partidos pasa a leer de `proximos_partidos` (ya
--      de-duplicada) en vez de `partidos` en crudo. Mismo grano (fila por representado),
--      mismas columnas de salida, y de paso se sacan 5 joins.
--
-- `create or replace` (no `drop`): las columnas de salida no cambian. Mismo patrón que 0004.
--
-- Reversible: cuando entre API-Football Pro, `sync-partidos` solo ve toda la temporada, se
-- apaga el cron de ESPN y estas vistas pueden quedarse igual (ya no habrá duplicados que
-- colapsar) o volver a la definición previa.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) proximos_partidos — misma definición que 0001 + `distinct on`
-- ----------------------------------------------------------------------------
create or replace view proximos_partidos
with (security_invoker = true) as
select distinct on (
  pj.jugador_id,
  pj.con_seleccion,
  -- Clave de día. Si el partido no tiene fecha, se cae al id para NO colapsar dos
  -- partidos sin fecha del mismo jugador en uno solo.
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
  p.sincronizado_en
from partidos p
join partidos_jugadores pj on pj.partido_id = p.id
join jugadores j           on j.id = pj.jugador_id
left join competencias c   on c.id = p.competencia_id
left join clubes cl        on cl.id = j.club_actual_id
-- El rival es el otro club del partido respecto del club actual del jugador.
left join clubes riv on riv.id = case
  when j.club_actual_id = p.club_local_id then p.club_visitante_id
  else p.club_local_id
end
order by
  pj.jugador_id,
  pj.con_seleccion,
  coalesce((p.inicio_utc at time zone 'America/Montevideo')::date::text, 'sinfecha:' || p.id::text),
  -- FALSE (API-Football) ordena antes que TRUE (cualquier otra fuente) → gana API-Football.
  (p.proveedor_externo is distinct from 'api-football'),
  p.sincronizado_en desc nulls last,
  p.id;

comment on view proximos_partidos is 'Fuente única de la vista partidos del frontend. Una fila por representado por partido, de-duplicada por (jugador, día en Uruguay, con_selección) cuando el mismo partido llega por API-Football y por ESPN (se prefiere API-Football).';

-- ----------------------------------------------------------------------------
-- 2) agenda_anual — misma definición que 0004; solo cambia el bloque 1 (partidos),
--    que ahora lee de `proximos_partidos` (de-duplicada) en vez de `partidos` en crudo.
-- ----------------------------------------------------------------------------
create or replace view agenda_anual
with (security_invoker = true) as
-- 1) Partidos (una fila por representado involucrado) — desde proximos_partidos
select
  'partido'::text            as fuente,
  pp.partido_id              as ref_id,
  pp.jugador_id,
  pp.club_id,
  coalesce(pp.club_nombre, '?') || ' vs ' || coalesce(pp.rival_nombre, '?') as titulo,
  pp.inicio_utc              as cuando_utc,
  pp.dia_uy,
  pp.competencia_codigo,
  pp.es_internacional,
  pp.tentativo
from proximos_partidos pp
where pp.inicio_utc is not null

union all

-- 2) Convocatorias
select
  'convocatoria'::text,
  cv.id,
  cv.jugador_id,
  null::uuid,
  coalesce(cv.descripcion, 'Convocatoria'),
  (cv.fecha + time '12:00') at time zone 'America/Montevideo',
  cv.fecha,
  null::text,
  (cv.tipo = 'seleccion'),
  false
from convocatorias cv
where cv.fecha is not null

union all

-- 3) Hitos con fecha
select
  'hito'::text,
  h.id,
  h.jugador_id,
  h.club_id,
  h.titulo,
  coalesce(h.fecha_utc, (h.fecha + time '12:00') at time zone 'America/Montevideo'),
  coalesce((h.fecha_utc at time zone 'America/Montevideo')::date, h.fecha),
  null::text,
  false,
  false
from hitos h
where h.fecha is not null or h.fecha_utc is not null

union all

-- 4) Cumpleaños de jugadores, proyectados a la ventana de años
select
  'cumpleanos'::text,
  j.id,
  j.id,
  j.club_id_placeholder     as club_id,
  'Cumpleaños de ' || coalesce(j.apodo, j.nombre),
  (j.proj + time '12:00') at time zone 'America/Montevideo',
  j.proj,
  null::text,
  false,
  false
from (
  select
    jg.id, jg.apodo, jg.nombre, jg.club_actual_id as club_id_placeholder,
    (make_date(yr.y, 1, 1) + (jg.fecha_nacimiento - make_date(extract(year from jg.fecha_nacimiento)::int, 1, 1)))::date as proj
  from jugadores jg
  cross join (
    select generate_series(
      extract(year from now())::int - 1,
      extract(year from now())::int + 2
    ) as y
  ) yr
  where jg.fecha_nacimiento is not null
) j

union all

-- 5) Aniversarios de fundación de club, proyectados a la ventana de años
select
  'aniversario_club'::text,
  cb.id,
  null::uuid,
  cb.id,
  'Aniversario de ' || cb.nombre,
  (cb.proj + time '12:00') at time zone 'America/Montevideo',
  cb.proj,
  null::text,
  false,
  false
from (
  select
    cbb.id, cbb.nombre,
    (make_date(yr.y, 1, 1) + (cbb.fecha_fundacion - make_date(extract(year from cbb.fecha_fundacion)::int, 1, 1)))::date as proj
  from clubes cbb
  cross join (
    select generate_series(
      extract(year from now())::int - 1,
      extract(year from now())::int + 2
    ) as y
  ) yr
  where cbb.fecha_fundacion is not null
) cb

union all

-- 6) Aniversarios del debut con la selección, proyectados a la ventana de años
select
  'aniversario_seleccion'::text,
  j.id,
  j.id,
  j.club_id_placeholder     as club_id,
  'Aniversario del debut con la selección de ' || coalesce(j.apodo, j.nombre),
  (j.proj + time '12:00') at time zone 'America/Montevideo',
  j.proj,
  null::text,
  false,
  false
from (
  select
    jg.id, jg.apodo, jg.nombre, jg.club_actual_id as club_id_placeholder,
    (make_date(yr.y, 1, 1) + (jg.debut_seleccion - make_date(extract(year from jg.debut_seleccion)::int, 1, 1)))::date as proj
  from jugadores jg
  cross join (
    select generate_series(
      extract(year from now())::int - 1,
      extract(year from now())::int + 2
    ) as y
  ) yr
  where jg.debut_seleccion is not null
) j;

comment on view agenda_anual is 'Todo lo fechado del calendario, unificado. dia_uy ya está en zona de Uruguay. El bloque de partidos sale de proximos_partidos (de-duplicada entre API-Football y ESPN).';

commit;
