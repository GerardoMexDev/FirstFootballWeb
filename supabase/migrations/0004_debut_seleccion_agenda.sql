-- ============================================================================
-- Football First — Migración 0004: debut en selección + su aniversario en la agenda
--
-- 1. jugadores.debut_seleccion date  — fecha del PRIMER partido con la selección mayor.
--    Dato manual (Excel / Transfermarkt), NULL-able (la mayoría de la cartera no debutó).
--    Se deja `jugadores.debut` (ya existente, sin uso) reservada para el debut profesional
--    de carrera, que es otro dato.
--
-- 2. agenda_anual gana un 6º bloque `aniversario_seleccion`: proyecta el aniversario del
--    debut sobre la ventana de años [-1, +2], igual patrón que cumpleaños (bloque 4) y
--    aniversario de club (bloque 5). Lo consume la nota de calendario/partidos que avisa
--    con 7-10 días de anticipación (lib/agenda/notas-proximas.ts) para que los diseñadores
--    preparen el arte a tiempo.
--
-- `create or replace view`: no cambia columnas ni su orden (solo agrega filas por UNION),
-- así que conserva permisos y RLS de la vista. security_invoker se re-declara.
-- ============================================================================

begin;

alter table jugadores
  add column debut_seleccion date;

comment on column jugadores.debut_seleccion is
  'Fecha del debut con la selección mayor. Manual (Excel/Transfermarkt), NULL si no debutó. Distinta de jugadores.debut (debut profesional de carrera).';

-- ----------------------------------------------------------------------------
-- agenda_anual — misma definición que 0001 + bloque 6 (aniversario_seleccion)
-- ----------------------------------------------------------------------------
create or replace view agenda_anual
with (security_invoker = true) as
-- 1) Partidos (una fila por representado involucrado)
select
  'partido'::text            as fuente,
  p.id                       as ref_id,
  pj.jugador_id,
  j.club_actual_id           as club_id,
  coalesce(cl.nombre, '?') || ' vs ' || coalesce(riv.nombre, '?') as titulo,
  p.inicio_utc               as cuando_utc,
  (p.inicio_utc at time zone 'America/Montevideo')::date as dia_uy,
  c.codigo                   as competencia_codigo,
  (c.tipo in ('continental', 'seleccion')) as es_internacional,
  (p.inicio_utc is not null and p.inicio_utc > now() + interval '90 days') as tentativo
from partidos p
join partidos_jugadores pj on pj.partido_id = p.id
join jugadores j           on j.id = pj.jugador_id
left join competencias c   on c.id = p.competencia_id
left join clubes cl        on cl.id = j.club_actual_id
left join clubes riv on riv.id = case
  when j.club_actual_id = p.club_local_id then p.club_visitante_id
  else p.club_local_id
end
where p.inicio_utc is not null

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

comment on view agenda_anual is 'Todo lo fechado del calendario, unificado. dia_uy ya está en zona de Uruguay.';

commit;
