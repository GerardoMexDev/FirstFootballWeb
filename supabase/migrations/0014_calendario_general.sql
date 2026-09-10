-- ============================================================================
-- Football First — Migración 0014: Calendario General (servicio "Contenido")
--
-- La agencia ofrece dos servicios sobre distintos grupos de jugadores:
--   · Match Day  → seguimiento de fixture. Los 6 representados de siempre.
--                  Es la vista /calendario (renombrada a "Match Day" en el front).
--   · Contenido  → arte y comunicación para un roster más amplio (12 jugadores),
--                  sin seguir sus partidos. Alimenta la vista nueva
--                  /calendario-general con fechas fijas: cumpleaños, aniversario
--                  de fundación de club, aniversario del debut en selección y
--                  aniversario del debut profesional.
--
-- Este cambio NO debe alterar Match Day. Mecanismo:
--   1. Dos banderas en `jugadores`: servicio_match_day (default true → los 6
--      actuales quedan dentro sin tocar una fila) y servicio_contenido
--      (default false → el seed prende los 12).
--   2. `agenda_anual` gana un guardia `servicio_match_day` en sus 3 bloques de
--      fecha fija por jugador/club. Efecto hoy: salida idéntica (los 6 son todos
--      servicio_match_day y cada uno de sus clubes tiene un jugador match_day).
--   3. Vista nueva `agenda_contenido`: 4 proyecciones de fecha fija, roster
--      servicio_contenido. Misma forma de columnas que `agenda_anual` para
--      reusar `EventoCalendario` y `repositorio-agenda`.
--
-- `create or replace` para `agenda_anual` (no `drop`): mismo patrón que 0004,
-- 0011, 0013. Aditivo y reversible.
--
-- Reversión: `create or replace view agenda_anual` con el cuerpo de 0013 +
-- `drop view agenda_contenido` + `alter table jugadores drop column
-- servicio_contenido, drop column servicio_match_day`.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Banderas de servicio en `jugadores`
-- ----------------------------------------------------------------------------
alter table jugadores
  add column servicio_match_day boolean not null default true,
  add column servicio_contenido boolean not null default false;

comment on column jugadores.servicio_match_day is
  'Servicio "Match Day": la agencia sigue el fixture de este jugador. Los 6 representados historicos. Alimenta agenda_anual y la vista partidos.';
comment on column jugadores.servicio_contenido is
  'Servicio "Contenido": la agencia prepara arte/comunicacion para este jugador. Alimenta agenda_contenido (Calendario General). Puede coincidir con servicio_match_day.';

-- ----------------------------------------------------------------------------
-- 2) agenda_anual — cuerpo EXACTO de 0013 con un guardia servicio_match_day en
--    los 3 bloques de fecha fija por jugador/club (bloques 4, 5, 6). Los bloques
--    1-3 (partidos / convocatorias / hitos) NO se tocan.
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
  pp.tentativo,
  pp.dia_local_sede
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
  false,
  cv.fecha
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
  false,
  coalesce((h.fecha_utc at time zone 'America/Montevideo')::date, h.fecha)
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
  false,
  j.proj
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
  where jg.fecha_nacimiento is not null and jg.servicio_match_day
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
  false,
  cb.proj
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
    and exists (select 1 from jugadores jx
                where jx.club_actual_id = cbb.id and jx.servicio_match_day)
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
  false,
  j.proj
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
  where jg.debut_seleccion is not null and jg.servicio_match_day
) j;

comment on view agenda_anual is 'Todo lo fechado del calendario, unificado. `dia_uy` en zona de Uruguay; `dia_local_sede` (0013) = día en la sede para los partidos, y el mismo `dia_uy` para el resto (no tienen sede). El bloque de partidos sale de proximos_partidos.';

-- ----------------------------------------------------------------------------
-- 3) agenda_contenido — 4 proyecciones de fecha fija, roster servicio_contenido.
--    Sin sede: dia_local_sede = dia_uy. Ventana de años [-1, +2] igual que agenda_anual.
-- ----------------------------------------------------------------------------
create view agenda_contenido
with (security_invoker = true) as

-- 1) Cumpleaños de jugadores servicio_contenido
select
  'cumpleanos'::text        as fuente,
  j.id                      as ref_id,
  j.id                      as jugador_id,
  j.club_id_placeholder     as club_id,
  'Cumpleaños de ' || coalesce(j.apodo, j.nombre) as titulo,
  (j.proj + time '12:00') at time zone 'America/Montevideo' as cuando_utc,
  j.proj                    as dia_uy,
  null::text                as competencia_codigo,
  false                     as es_internacional,
  false                     as tentativo,
  j.proj                    as dia_local_sede
from (
  select
    jg.id, jg.apodo, jg.nombre, jg.club_actual_id as club_id_placeholder,
    (make_date(yr.y, 1, 1) + (jg.fecha_nacimiento - make_date(extract(year from jg.fecha_nacimiento)::int, 1, 1)))::date as proj
  from jugadores jg
  cross join (
    select generate_series(extract(year from now())::int - 1, extract(year from now())::int + 2) as y
  ) yr
  where jg.fecha_nacimiento is not null and jg.servicio_contenido
) j

union all

-- 2) Aniversario de fundación del club (club con al menos un jugador servicio_contenido)
select
  'aniversario_club'::text, cb.id, null::uuid, cb.id,
  'Aniversario de ' || cb.nombre,
  (cb.proj + time '12:00') at time zone 'America/Montevideo',
  cb.proj, null::text, false, false, cb.proj
from (
  select
    cbb.id, cbb.nombre,
    (make_date(yr.y, 1, 1) + (cbb.fecha_fundacion - make_date(extract(year from cbb.fecha_fundacion)::int, 1, 1)))::date as proj
  from clubes cbb
  cross join (
    select generate_series(extract(year from now())::int - 1, extract(year from now())::int + 2) as y
  ) yr
  where cbb.fecha_fundacion is not null
    and exists (select 1 from jugadores jx where jx.club_actual_id = cbb.id and jx.servicio_contenido)
) cb

union all

-- 3) Aniversario del debut con la selección (servicio_contenido)
select
  'aniversario_seleccion'::text, j.id, j.id, j.club_id_placeholder,
  'Aniversario del debut con la selección de ' || coalesce(j.apodo, j.nombre),
  (j.proj + time '12:00') at time zone 'America/Montevideo',
  j.proj, null::text, false, false, j.proj
from (
  select
    jg.id, jg.apodo, jg.nombre, jg.club_actual_id as club_id_placeholder,
    (make_date(yr.y, 1, 1) + (jg.debut_seleccion - make_date(extract(year from jg.debut_seleccion)::int, 1, 1)))::date as proj
  from jugadores jg
  cross join (
    select generate_series(extract(year from now())::int - 1, extract(year from now())::int + 2) as y
  ) yr
  where jg.debut_seleccion is not null and jg.servicio_contenido
) j

union all

-- 4) Aniversario del debut profesional (servicio_contenido) — fuente nueva
select
  'aniversario_debut'::text, j.id, j.id, j.club_id_placeholder,
  'Aniversario del debut profesional de ' || coalesce(j.apodo, j.nombre),
  (j.proj + time '12:00') at time zone 'America/Montevideo',
  j.proj, null::text, false, false, j.proj
from (
  select
    jg.id, jg.apodo, jg.nombre, jg.club_actual_id as club_id_placeholder,
    (make_date(yr.y, 1, 1) + (jg.debut - make_date(extract(year from jg.debut)::int, 1, 1)))::date as proj
  from jugadores jg
  cross join (
    select generate_series(extract(year from now())::int - 1, extract(year from now())::int + 2) as y
  ) yr
  where jg.debut is not null and jg.servicio_contenido
) j;

comment on view agenda_contenido is
  'Fechas de contenido (cumpleanos, aniversarios de club / debut en seleccion / debut profesional) del servicio Contenido — roster servicio_contenido. Alimenta /calendario-general. Sin sede: dia_local_sede = dia_uy.';

commit;
