-- ============================================================================
-- Football First — Migración 0039: nombres en los chips de fechas de la agencia
--
-- Gerardo (2026-10-01): en las fechas del Excel de la agencia se mezclaban apodos y nombres
-- ("Fede, Gastón Martirena, …"). Ahora siempre nombre completo y, si tiene apodo, entre comillas:
-- 'Federico Pereira "Fede", Gastón Martirena, Kevin Amaro, Martín Fernández · Aniversario Liverpool'.
-- Solo cambia la columna `quien` del bloque fecha_agencia; el resto es el cuerpo de 0038.
-- Reversible: vista con el cuerpo de 0038.
-- Football First. Creado 2026-10-01.
-- ============================================================================

begin;

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
    -- 0039: nombre completo y, si tiene, el apodo entre comillas: Federico Pereira "Fede"
    coalesce(string_agg(jg.nombre || coalesce(' "' || nullif(jg.apodo, '') || '"', ''), ', ' order by jg.nombre), 'First') as quien
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
