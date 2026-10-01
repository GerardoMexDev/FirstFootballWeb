-- ============================================================================
-- Football First — Migración 0037: cumpleaños de Abel del Excel + fechas de la agencia sin "años negativos"
--
-- 1. Gerardo (2026-10-01): el cumpleaños de Abel es el del Excel de la agencia (su hoja: 6/8/1990;
--    la base tenía 1990-08-08). Se corrige en `jugadores` para que la ficha y el calendario coincidan.
-- 2. Revisión de 0036: el bloque 'fecha_agencia' de `agenda_contenido` proyectaba también a años
--    anteriores al hecho (la ventana arranca en el año pasado) → "Campeón de la Leagues Cup (2026)"
--    aparecía en septiembre de 2025. Ahora solo desde el año del hecho.
--
-- Reversible: update jugadores set fecha_nacimiento = '1990-08-08' where nombre = 'Abel Hernández';
-- vista con el cuerpo de 0036.
-- Football First. Creado 2026-10-01.
-- ============================================================================

begin;

update jugadores set fecha_nacimiento = '1990-08-06' where nombre = 'Abel Hernández';

do $$
begin
  if (select count(*) from jugadores where nombre = 'Abel Hernández' and fecha_nacimiento = '1990-08-06') <> 1 then
    raise exception 'No se actualizó el cumpleaños de Abel';
  end if;
end $$;

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
    (make_date(yr.y, 1, 1) + (b.base - make_date(extract(year from b.base)::int, 1, 1)))::date as proj
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
    (make_date(yr.y, 1, 1) + (b.base - make_date(extract(year from b.base)::int, 1, 1)))::date as proj,
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
    (make_date(yr.y, 1, 1) + (b.base - make_date(extract(year from b.base)::int, 1, 1)))::date as proj
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
    (make_date(yr.y, 1, 1) + (b.base - make_date(extract(year from b.base)::int, 1, 1)))::date as proj
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
