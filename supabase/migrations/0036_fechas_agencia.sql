-- ============================================================================
-- Football First — Migración 0036: fechas de la agencia (Excel "calendario first.xlsx")
--
-- Punto 6 de la agencia (2026-09-30). El Excel trae 114 fechas: una hoja por jugador + @first.
-- Decidido por Gerardo: se COMBINAN — lo que el Excel trae y nosotros también, gana el Excel; lo
-- que el Excel no trae, queda lo nuestro (cumpleaños de Martirena y Martín Fernández, aniversario
-- de Colo-Colo / Al-Qadisiyah / Tigres, debuts de los demás, todo Aguirre).
--
-- 1. Tabla `fechas_agencia` (99 filas): de @first solo lo que NO es de un jugador (16 días
--    generales y del equipo); las otras 15 de @first repiten las hojas de los jugadores.
--    Textos limpios a mano (typos del Excel corregidos). Todas se repiten cada año.
--    `tipo` = la misma fuente de las vistas cuando la fecha es una de las 4 que ya calculamos
--    (cumpleanos, aniversario_club, aniversario_debut, aniversario_seleccion); 'otro' = el resto.
-- 2. `fecha_agencia()`: la fecha base de una de esas 4 fuentes, con la del Excel si la trae.
--    Las vistas proyectan desde ahí → no hay duplicados y "gana el Excel" (hoy solo cambia el
--    cumpleaños de Abel: 6/8 en su hoja; el resto coincide).
-- 3. `agenda_anual` y `agenda_contenido`: usan (2); `agenda_contenido` suma el bloque
--    'fecha_agencia' con las 'otro' (una fila por fecha; si varios jugadores comparten la misma,
--    una sola con los nombres juntos). Título "Nández · Cumple Matilda (hija)" / "First · …";
--    con año → "(N años)".
-- 4. Fundación de RB Bragantino: 2020-01-01 (dato malo nuestro) → 1928-01-08 (Excel: 8/1).
--
-- Reversible: vistas con el cuerpo de 0022; drop function fecha_agencia; drop table
-- fechas_agencia; update clubes set fecha_fundacion = '2020-01-01' where nombre = 'RB Bragantino'.
-- Football First. Creado 2026-10-01.
-- ============================================================================

begin;

create table fechas_agencia (
  id          uuid primary key default gen_random_uuid(),
  jugador_id  uuid references jugadores(id) on delete cascade,  -- null = de First (la agencia)
  club_id     uuid references clubes(id) on delete set null,     -- solo tipo aniversario_club
  dia         smallint not null check (dia between 1 and 31),
  mes         smallint not null check (mes between 1 and 12),
  anio        smallint,                                          -- el año que trae el Excel, si trae
  texto       text not null,
  tipo        text not null check (tipo in
                ('cumpleanos', 'aniversario_club', 'aniversario_debut', 'aniversario_seleccion', 'otro')),
  check (tipo <> 'aniversario_club' or club_id is not null)
);

comment on table fechas_agencia is
  'Fechas del Excel de la agencia (calendario first.xlsx, 0036). tipo = fuente de agenda que reemplaza, u otro (se muestra como fecha_agencia en agenda_contenido).';

alter table fechas_agencia enable row level security;
revoke all on fechas_agencia from anon, authenticated;
grant select on fechas_agencia to authenticated;
create policy fechas_agencia_leer on fechas_agencia for select to authenticated using (true);

insert into fechas_agencia (jugador_id, club_id, dia, mes, anio, texto, tipo)
select j.id, c.id, v.dia, v.mes, v.anio, v.texto, v.tipo
from (values
  -- @first: solo días generales y del equipo
  (null, null, 1, 1, null, 'Año Nuevo', 'otro'),
  (null, null, 1, 5, null, 'Día de los Trabajadores', 'otro'),
  (null, null, 1, 7, null, 'Día Internacional de la Arquitectura', 'otro'),
  (null, null, 1, 12, null, 'Wrapped de Spotify', 'otro'),
  (null, null, 6, 1, null, 'Día de Reyes', 'otro'),
  (null, null, 10, 10, null, 'Día de la Salud Mental', 'otro'),
  (null, null, 14, 2, null, 'San Valentín', 'otro'),
  (null, null, 14, 10, null, 'Día del Futbolista', 'otro'),
  (null, null, 18, 7, null, 'Jura de la Constitución', 'otro'),
  (null, null, 22, 11, null, 'Día Internacional de la Música', 'otro'),
  (null, null, 23, 3, null, 'Cumple Chino Rochet', 'otro'),
  (null, null, 24, 12, null, 'Nochebuena', 'otro'),
  (null, null, 25, 8, null, 'Día de la Independencia', 'otro'),
  (null, null, 25, 12, null, 'Navidad', 'otro'),
  (null, null, 27, 4, null, 'Día del Diseñador Gráfico', 'otro'),
  (null, null, 31, 12, null, 'Fin de Año', 'otro'),
  -- Martirena
  ('Gastón Martirena', null, 1, 7, 2025, 'Cumple Brunella (hija)', 'otro'),
  ('Gastón Martirena', null, 4, 12, null, 'Cumple Sol (pareja)', 'otro'),
  ('Gastón Martirena', null, 7, 3, null, 'Día del hincha de Racing Club', 'otro'),
  ('Gastón Martirena', 'Club Nacional', 14, 5, null, 'Aniversario Nacional', 'aniversario_club'),
  ('Gastón Martirena', null, 15, 2, null, 'Aniversario Liverpool', 'otro'),
  ('Gastón Martirena', null, 25, 3, null, 'Aniversario Racing Club', 'otro'),
  ('Gastón Martirena', null, 27, 3, null, 'Aniversario Recopa Sudamericana', 'otro'),
  ('Gastón Martirena', null, 30, 8, null, 'Debut con Nacional (vs. Peñarol)', 'otro'),
  -- Abel
  ('Abel Hernández', null, 1, 11, null, 'Aniversario Palermo', 'otro'),
  ('Abel Hernández', null, 2, 8, null, 'Cumple Flor', 'otro'),
  ('Abel Hernández', null, 2, 11, null, 'Cumple Juana (mamá)', 'otro'),
  ('Abel Hernández', null, 4, 4, 1909, 'Aniversario Inter', 'otro'),
  ('Abel Hernández', null, 5, 1, 1905, 'Aniversario Central Español', 'otro'),
  ('Abel Hernández', null, 6, 8, 1990, 'Cumple Abel', 'cumpleanos'),
  ('Abel Hernández', null, 11, 3, 2020, 'Cumple Juana', 'otro'),
  ('Abel Hernández', null, 12, 6, 2020, 'Aniversario de casamiento (civil)', 'otro'),
  ('Abel Hernández', null, 18, 5, 2025, 'Campeón del Apertura con Liverpool', 'otro'),
  ('Abel Hernández', null, 19, 11, null, 'Cumple Nachito', 'otro'),
  ('Abel Hernández', null, 21, 7, 1902, 'Aniversario Fluminense', 'otro'),
  ('Abel Hernández', null, 22, 9, 1976, 'Cumple Gordo Ronaldo', 'otro'),
  ('Abel Hernández', null, 23, 6, 2023, 'Cumple Camilo', 'otro'),
  ('Abel Hernández', null, 23, 12, 2021, 'Aniversario de casamiento (iglesia)', 'otro'),
  ('Abel Hernández', null, 24, 7, 2011, 'Aniversario Copa América', 'otro'),
  ('Abel Hernández', null, 24, 12, null, 'Aniversario Rosario Central', 'otro'),
  ('Abel Hernández', null, 27, 8, 1911, 'Aniversario CSKA Moscú', 'otro'),
  ('Abel Hernández', null, 28, 5, null, 'Aniversario Atlético San Luis', 'otro'),
  ('Abel Hernández', null, 28, 6, null, 'Aniversario Hull City', 'otro'),
  ('Abel Hernández', 'CA Peñarol', 28, 9, null, 'Aniversario Peñarol', 'aniversario_club'),
  ('Abel Hernández', null, 28, 11, 2014, 'Cumple Emma', 'otro'),
  -- Nández
  ('Nahitan Nández', null, 1, 3, 2014, 'Debut en Primera (Peñarol vs. Danubio)', 'aniversario_debut'),
  ('Nahitan Nández', null, 2, 7, 2020, 'Cumple Tian', 'otro'),
  ('Nahitan Nández', null, 3, 4, 1905, 'Aniversario Boca Juniors', 'otro'),
  ('Nahitan Nández', null, 6, 12, null, 'Cumple Sara (novia)', 'otro'),
  ('Nahitan Nández', null, 8, 9, 2015, 'Debut en la selección mayor (vs. Costa Rica)', 'aniversario_seleccion'),
  ('Nahitan Nández', null, 12, 12, null, 'Día del hincha de Boca Juniors', 'otro'),
  ('Nahitan Nández', null, 13, 9, null, 'Primer gol en Peñarol (vs. IASA)', 'otro'),
  ('Nahitan Nández', null, 15, 6, 2018, 'Debut en el Mundial (vs. Egipto)', 'otro'),
  ('Nahitan Nández', null, 24, 9, null, 'Cumple Matilda (hija)', 'otro'),
  ('Nahitan Nández', null, 27, 4, null, 'Cumple Nico (mejor amigo)', 'otro'),
  ('Nahitan Nández', 'CA Peñarol', 28, 9, null, 'Aniversario Peñarol', 'aniversario_club'),
  ('Nahitan Nández', null, 28, 12, null, 'Cumple Nahitan', 'cumpleanos'),
  ('Nahitan Nández', null, 30, 5, null, 'Aniversario Cagliari', 'otro'),
  -- Fede Pereira
  ('Federico Pereira', null, 1, 10, 2025, 'Campeón de la Campeones Cup con Toluca', 'otro'),
  ('Federico Pereira', null, 6, 9, 2026, 'Campeón de la Leagues Cup con Toluca', 'otro'),
  ('Federico Pereira', 'Toluca', 12, 2, null, 'Aniversario Toluca', 'aniversario_club'),
  ('Federico Pereira', null, 14, 12, 2025, 'Campeón del Apertura de la Liga MX con Toluca', 'otro'),
  ('Federico Pereira', null, 15, 2, null, 'Aniversario Liverpool', 'otro'),
  ('Federico Pereira', null, 16, 12, 2023, 'Liverpool campeón', 'otro'),
  ('Federico Pereira', null, 22, 11, null, 'Cumple Marga (hija)', 'otro'),
  ('Federico Pereira', null, 24, 2, null, 'Cumple Fede', 'cumpleanos'),
  ('Federico Pereira', null, 25, 5, 2025, 'Campeón del Clausura de la Liga MX con Toluca', 'otro'),
  ('Federico Pereira', null, 29, 6, 2025, 'Campeón de Campeones con Toluca', 'otro'),
  ('Federico Pereira', null, 30, 5, 2026, 'Campeón de la Copa de Campeones Concacaf con Toluca', 'otro'),
  ('Federico Pereira', null, 30, 11, null, 'Cumple Conze (pareja)', 'otro'),
  -- Maxi Silvera
  ('Maximiliano Silvera', null, 5, 9, null, 'Cumple Maxi Silvera', 'cumpleanos'),
  ('Maximiliano Silvera', 'Club Nacional', 14, 5, null, 'Aniversario Nacional', 'aniversario_club'),
  ('Maximiliano Silvera', null, 28, 10, null, 'Aniversario Cerrito', 'otro'),
  ('Maximiliano Silvera', null, 29, 5, null, 'Aniversario FC Juárez', 'otro'),
  -- Nacho Sosa
  ('Ignacio Sosa', 'RB Bragantino', 8, 1, null, 'Aniversario Red Bull Bragantino', 'aniversario_club'),
  ('Ignacio Sosa', 'CA Peñarol', 28, 9, null, 'Aniversario Peñarol', 'aniversario_club'),
  ('Ignacio Sosa', null, 31, 8, null, 'Cumple Nacho', 'cumpleanos'),
  -- Javi Méndez
  ('Javier Méndez', null, 1, 3, null, 'Aniversario Danubio', 'otro'),
  ('Javier Méndez', null, 1, 12, 2024, 'Peñarol campeón uruguayo', 'otro'),
  ('Javier Méndez', null, 5, 12, null, 'Cumple Javi', 'cumpleanos'),
  ('Javier Méndez', null, 6, 4, null, 'Aniversario Racing', 'otro'),
  ('Javier Méndez', null, 11, 11, null, 'Cumple Thiago (hijo)', 'otro'),
  ('Javier Méndez', null, 14, 11, null, 'Aniversario DIM', 'otro'),
  ('Javier Méndez', 'CA Peñarol', 28, 9, null, 'Aniversario Peñarol', 'aniversario_club'),
  -- Franco Romero
  ('Franco Romero', null, 1, 9, null, 'Cumple Renzo (hijo)', 'otro'),
  ('Franco Romero', null, 6, 4, null, 'Aniversario Racing', 'otro'),
  ('Franco Romero', null, 11, 2, null, 'Cumple Franco', 'cumpleanos'),
  ('Franco Romero', null, 13, 12, null, 'Aniversario Sporting Cristal', 'otro'),
  ('Franco Romero', null, 15, 7, 2024, 'Cumple Lautaro (hijo)', 'otro'),
  ('Franco Romero', null, 28, 4, null, 'Cumple Ceci (esposa)', 'otro'),
  ('Franco Romero', 'CA Peñarol', 28, 9, null, 'Aniversario Peñarol', 'aniversario_club'),
  -- Kevin Amaro
  ('Kevin Amaro', 'Genk', 1, 7, null, 'Aniversario KRC Genk', 'aniversario_club'),
  ('Kevin Amaro', null, 3, 3, null, 'Cumple Kevin', 'cumpleanos'),
  ('Kevin Amaro', null, 15, 2, null, 'Aniversario Liverpool', 'otro'),
  ('Kevin Amaro', null, 16, 12, 2023, 'Liverpool campeón', 'otro'),
  -- Martín Fernández
  ('Martín Fernández', null, 1, 8, null, 'Aniversario Albacete', 'otro'),
  ('Martín Fernández', null, 15, 2, null, 'Aniversario Liverpool', 'otro'),
  ('Martín Fernández', null, 16, 12, 2023, 'Liverpool campeón', 'otro'),
  ('Martín Fernández', 'Atlante FC', 18, 4, null, 'Aniversario Atlante', 'aniversario_club')
) as v(jugador, club, dia, mes, anio, texto, tipo)
left join jugadores j on j.nombre = v.jugador
left join clubes c on c.nombre = v.club;

-- Cada nombre de jugador/club del values tiene que existir (si no, la fila quedaría como "de First").
do $$
declare
  n_total int;
  n_first int;
begin
  select count(*), count(*) filter (where jugador_id is null) into n_total, n_first from fechas_agencia;
  if n_total <> 99 or n_first <> 16 then
    raise exception 'fechas_agencia: % filas (% de First); se esperaban 99 (16)', n_total, n_first;
  end if;
  if exists (select 1 from fechas_agencia where tipo = 'aniversario_club' and club_id is null) then
    raise exception 'fechas_agencia: aniversario de club sin club';
  end if;
end $$;

-- Fecha base de una de las 4 fuentes calculadas, con la del Excel si la trae (gana el Excel).
-- Conserva el año de la base (sirve para los "(N años)" de los clubes). Un 29/2 cae al 1/3.
create function fecha_agencia(p_jugador uuid, p_club uuid, p_tipo text, p_base date)
returns date
language sql stable
set search_path = public
as $$
  select coalesce(
    (select (make_date(extract(year from p_base)::int, fa.mes, 1) + (fa.dia - 1))::date
       from fechas_agencia fa
      where fa.tipo = p_tipo
        and (fa.jugador_id = p_jugador or fa.club_id = p_club)
      order by fa.id
      limit 1),
    p_base);
$$;

revoke all on function fecha_agencia(uuid, uuid, text, date) from public, anon;
grant execute on function fecha_agencia(uuid, uuid, text, date) to authenticated;

update clubes set fecha_fundacion = '1928-01-08' where nombre = 'RB Bragantino';

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
    (make_date(yr.y, 1, 1) + (b.base - make_date(extract(year from b.base)::int, 1, 1)))::date as proj
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
    (make_date(yr.y, 1, 1) + (b.base - make_date(extract(year from b.base)::int, 1, 1)))::date as proj,
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
    (make_date(yr.y, 1, 1) + (b.base - make_date(extract(year from b.base)::int, 1, 1)))::date as proj
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
cross join lateral (select (make_date(yr.y, g.mes, 1) + (g.dia - 1))::date as proj) p;

comment on view agenda_contenido is
  'Fechas de contenido (cumpleaños, aniversarios de club / debut en selección / debut profesional) del servicio Contenido — roster servicio_contenido — más las fechas propias del Excel de la agencia (fecha_agencia, 0036). Las 4 calculadas toman la fecha del Excel si la trae. Sin sede: dia_local_sede = dia_uy.';

commit;
