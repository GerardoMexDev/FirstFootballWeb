-- ============================================================================
-- Football First — Migración 0038: cumpleaños y aniversarios sin corrimiento en años bisiestos
--
-- Hallado verificando 0037 (2026-10-01): las vistas proyectaban cada fecha fija sumando "días desde
-- el 1/1" del año original → en un año bisiesto todo lo posterior a febrero caía un día antes
-- (Abel: 6/8 → 5/8 en 2028). Bug viejo (desde 0001), no afectaba 2026–2027.
-- Ahora se proyecta con mes y día: make_date(año, mes, 1) + (día − 1). Un 29/2 cae el 1/3 en años
-- no bisiestos (mismo criterio que fecha_agencia() y el bloque fecha_agencia de 0036).
--
-- Solo cambia la expresión de proyección en los 3 bloques de agenda_anual y los 4 de
-- agenda_contenido; el resto es el cuerpo de 0036 (anual) y 0037 (contenido).
-- Reversible: vistas con el cuerpo de 0036 / 0037.
-- Football First. Creado 2026-10-01.
-- ============================================================================

begin;

create or replace view agenda_anual
with (security_invoker = true) as
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

-- 4) Cumpleaños de jugadores, proyectados a la ventana de años (fecha del Excel si la trae, 0036)
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
    (make_date(yr.y, extract(month from b.base)::int, 1) + (extract(day from b.base)::int - 1))::date as proj
  from jugadores jg
  cross join lateral (select fecha_agencia(jg.id, null, 'cumpleanos', jg.fecha_nacimiento) as base) b
  cross join (
    select generate_series(
      extract(year from now())::int - 1,
      extract(year from now())::int + 2
    ) as y
  ) yr
  where jg.fecha_nacimiento is not null and jg.servicio_match_day
) j

union all

-- 5) Aniversarios de fundación de club, proyectados a la ventana de años — título con años (0022)
select
  'aniversario_club'::text,
  cb.id,
  null::uuid,
  cb.id,
  'Aniversario de ' || cb.nombre || ' (' || cb.anios || ' años)',
  (cb.proj + time '12:00') at time zone 'America/Montevideo',
  cb.proj,
  null::text,
  false,
  false,
  cb.proj
from (
  select
    cbb.id, cbb.nombre,
    (make_date(yr.y, extract(month from b.base)::int, 1) + (extract(day from b.base)::int - 1))::date as proj,
    yr.y - extract(year from b.base)::int as anios
  from clubes cbb
  cross join lateral (select fecha_agencia(null, cbb.id, 'aniversario_club', cbb.fecha_fundacion) as base) b
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
    (make_date(yr.y, extract(month from b.base)::int, 1) + (extract(day from b.base)::int - 1))::date as proj
  from jugadores jg
  cross join lateral (select fecha_agencia(jg.id, null, 'aniversario_seleccion', jg.debut_seleccion) as base) b
  cross join (
    select generate_series(
      extract(year from now())::int - 1,
      extract(year from now())::int + 2
    ) as y
  ) yr
  where jg.debut_seleccion is not null and jg.servicio_match_day
) j;

comment on view agenda_anual is 'Todo lo fechado del calendario, unificado. `dia_uy` en zona de Uruguay; `dia_local_sede` (0013) = día en la sede para los partidos, y el mismo `dia_uy` para el resto (no tienen sede). El bloque de partidos sale de proximos_partidos. Aniversario de club (0022) trae los años cumplidos en el título. Cumpleaños/aniversarios toman la fecha del Excel de la agencia si la trae (0036).';

create or replace view agenda_contenido
with (security_invoker = true) as

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
    (make_date(yr.y, extract(month from b.base)::int, 1) + (extract(day from b.base)::int - 1))::date as proj
  from jugadores jg
  cross join lateral (select fecha_agencia(jg.id, null, 'cumpleanos', jg.fecha_nacimiento) as base) b
  cross join (
    select generate_series(extract(year from now())::int - 1, extract(year from now())::int + 2) as y
  ) yr
  where jg.fecha_nacimiento is not null and jg.servicio_contenido
) j

union all

-- 2) Aniversario de fundación del club (club con al menos un jugador servicio_contenido) — título con años (0022)
select
  'aniversario_club'::text, cb.id, null::uuid, cb.id,
  'Aniversario de ' || cb.nombre || ' (' || cb.anios || ' años)',
  (cb.proj + time '12:00') at time zone 'America/Montevideo',
  cb.proj, null::text, false, false, cb.proj
from (
  select
    cbb.id, cbb.nombre,
    (make_date(yr.y, extract(month from b.base)::int, 1) + (extract(day from b.base)::int - 1))::date as proj,
    yr.y - extract(year from b.base)::int as anios
  from clubes cbb
  cross join lateral (select fecha_agencia(null, cbb.id, 'aniversario_club', cbb.fecha_fundacion) as base) b
  cross join (
    select generate_series(extract(year from now())::int - 1, extract(year from now())::int + 2) as y
  ) yr
  where cbb.fecha_fundacion is not null
    and exists (select 1 from jugadores jx where jx.club_actual_id = cbb.id and jx.servicio_contenido)
) cb

union all

select
  'aniversario_seleccion'::text, j.id, j.id, j.club_id_placeholder,
  'Aniversario del debut con la selección de ' || coalesce(j.apodo, j.nombre),
  (j.proj + time '12:00') at time zone 'America/Montevideo',
  j.proj, null::text, false, false, j.proj
from (
  select
    jg.id, jg.apodo, jg.nombre, jg.club_actual_id as club_id_placeholder,
    (make_date(yr.y, extract(month from b.base)::int, 1) + (extract(day from b.base)::int - 1))::date as proj
  from jugadores jg
  cross join lateral (select fecha_agencia(jg.id, null, 'aniversario_seleccion', jg.debut_seleccion) as base) b
  cross join (
    select generate_series(extract(year from now())::int - 1, extract(year from now())::int + 2) as y
  ) yr
  where jg.debut_seleccion is not null and jg.servicio_contenido
) j

union all

select
  'aniversario_debut'::text, j.id, j.id, j.club_id_placeholder,
  'Aniversario del debut profesional de ' || coalesce(j.apodo, j.nombre),
  (j.proj + time '12:00') at time zone 'America/Montevideo',
  j.proj, null::text, false, false, j.proj
from (
  select
    jg.id, jg.apodo, jg.nombre, jg.club_actual_id as club_id_placeholder,
    (make_date(yr.y, extract(month from b.base)::int, 1) + (extract(day from b.base)::int - 1))::date as proj
  from jugadores jg
  cross join lateral (select fecha_agencia(jg.id, null, 'aniversario_debut', jg.debut) as base) b
  cross join (
    select generate_series(extract(year from now())::int - 1, extract(year from now())::int + 2) as y
  ) yr
  where jg.debut is not null and jg.servicio_contenido
) j

union all

-- 5) Fechas propias del Excel de la agencia (0036): familia, títulos, otros clubes, días de First.
--    Una fila por fecha: si varios jugadores la comparten ("Aniversario Liverpool"), van juntos.
select
  'fecha_agencia'::text, g.ref_id, g.jugador_id, null::uuid,
  g.quien || ' · ' || g.texto ||
    case
      when g.anio is null then ''
      when yr.y - g.anio = 1 then ' (1 año)'
      when yr.y - g.anio > 1 then ' (' || (yr.y - g.anio) || ' años)'
      else ' (' || g.anio || ')'
    end,
  (p.proj + time '12:00') at time zone 'America/Montevideo',
  p.proj, null::text, false, false, p.proj
from (
  select
    fa.texto, fa.dia, fa.mes, fa.anio,
    (array_agg(fa.id order by fa.id))[1] as ref_id,
    case when count(*) = 1 then (array_agg(fa.jugador_id))[1] end as jugador_id,
    coalesce(string_agg(coalesce(jg.apodo, jg.nombre), ', ' order by coalesce(jg.apodo, jg.nombre)), 'First') as quien
  from fechas_agencia fa
  left join jugadores jg on jg.id = fa.jugador_id
  where fa.tipo = 'otro'
    and (fa.jugador_id is null or jg.servicio_contenido)
  group by fa.texto, fa.dia, fa.mes, fa.anio
) g
cross join (
  select generate_series(extract(year from now())::int - 1, extract(year from now())::int + 2) as y
) yr
cross join lateral (select (make_date(yr.y, g.mes, 1) + (g.dia - 1))::date as proj) p
-- 0037: no proyectar a años anteriores al hecho (un título de 2026 no se festeja en 2025).
where g.anio is null or yr.y >= g.anio;

comment on view agenda_contenido is
  'Fechas de contenido (cumpleaños, aniversarios de club / debut en selección / debut profesional) del servicio Contenido — roster servicio_contenido — más las fechas propias del Excel de la agencia (fecha_agencia, 0036). Las 4 calculadas toman la fecha del Excel si la trae. Sin sede: dia_local_sede = dia_uy.';

commit;
