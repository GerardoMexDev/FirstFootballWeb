-- ============================================================================
-- 0049 — Suspender y reactivar jugadores desde la página Jugadores. 2026-11-06.
-- Pedido de la agencia (primer caso: Rodrigo Aguirre). Decisiones de Gerardo: lo hacen el
-- Administrador y el Community Manager; el motivo es obligatorio.
-- ============================================================================
-- Suspender = `activo = false` (los servicios Match Day / Contenido NO se tocan: al reactivar,
-- el jugador vuelve tal cual estaba). Lo que hace esta migración:
--  1. `jugadores`: suspendido_en / suspendido_por / motivo_suspension (el último cambio).
--  2. Blindaje: la política `jugadores_update_manual` (0001) deja a cualquier usuario activo
--     editar cualquier columna. Un trigger impide cambiar `activo` y los datos de suspensión
--     salvo por las funciones de abajo (marcan la transacción) o service_role (scripts).
--  3. `jugador_suspender(jugador, motivo)` / `jugador_reactivar(jugador)`: Admin y CM.
--  4. Las agendas y los próximos partidos pasan a esconder a los suspendidos: hasta ahora solo
--     miraban los servicios (por eso a Nández, 2026-10-19, hubo que apagarle los dos). Cuerpos
--     copiados de su migración más reciente + el filtro `activo`; mismas columnas.
--  5. Nández (inactivo desde 2026-10-19) queda con su motivo registrado.
-- No borra nada. Reversible: recrear las 4 vistas con sus cuerpos anteriores (0038, 0039, 0033,
-- 0027), `drop function jugador_suspender, jugador_reactivar, jugadores_proteger_estado`
-- (+ trigger) y `alter table jugadores drop column suspendido_en, drop column suspendido_por,
-- drop column motivo_suspension`.
-- ============================================================================
begin;

-- 1. Datos de la suspensión ---------------------------------------------------
alter table jugadores
  add column suspendido_en     timestamptz,
  add column suspendido_por    uuid references perfiles (id) on delete set null,
  add column motivo_suspension text check (motivo_suspension is null or char_length(motivo_suspension) between 1 and 200);

comment on column jugadores.motivo_suspension is 'Por qué se suspendió (activo = false). Se limpia al reactivar (0049).';

-- 2. Blindaje de `activo` y de los datos de suspensión --------------------------
create or replace function jugadores_proteger_estado()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon')
     and coalesce(current_setting('app.jugador_estado', true), '') <> 'rpc'
     and (   new.activo            is distinct from old.activo
          or new.suspendido_en     is distinct from old.suspendido_en
          or new.suspendido_por    is distinct from old.suspendido_por
          or new.motivo_suspension is distinct from old.motivo_suspension) then
    raise exception 'Para suspender o reactivar un jugador usá el botón de la página Jugadores.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists jugadores_proteger_estado on jugadores;
create trigger jugadores_proteger_estado
  before update on jugadores
  for each row execute function jugadores_proteger_estado();

-- 3. Funciones ----------------------------------------------------------------
create or replace function jugador_suspender(p_jugador uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cargo  text := ticket__cargo_actual();
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if v_cargo not in ('Administrador', 'Community Manager') then
    raise exception 'Solo el Administrador o el Community Manager pueden suspender jugadores.' using errcode = '42501';
  end if;
  if char_length(v_motivo) not between 1 and 200 then
    raise exception 'Escribí el motivo (hasta 200 caracteres).';
  end if;
  perform set_config('app.jugador_estado', 'rpc', true);
  update jugadores
     set activo = false, suspendido_en = now(), suspendido_por = auth.uid(), motivo_suspension = v_motivo
   where id = p_jugador and activo;
  if not found then
    raise exception 'Ese jugador no existe o ya está suspendido. Recargá la página.';
  end if;
end;
$$;

create or replace function jugador_reactivar(p_jugador uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cargo text := ticket__cargo_actual();
begin
  if v_cargo not in ('Administrador', 'Community Manager') then
    raise exception 'Solo el Administrador o el Community Manager pueden reactivar jugadores.' using errcode = '42501';
  end if;
  perform set_config('app.jugador_estado', 'rpc', true);
  update jugadores
     set activo = true, suspendido_en = null, suspendido_por = null, motivo_suspension = null
   where id = p_jugador and not activo;
  if not found then
    raise exception 'Ese jugador no existe o ya está activo. Recargá la página.';
  end if;
end;
$$;

revoke execute on function jugador_suspender(uuid, text), jugador_reactivar(uuid) from public, anon;
grant execute on function jugador_suspender(uuid, text), jugador_reactivar(uuid) to authenticated;
revoke execute on function jugadores_proteger_estado() from public, anon, authenticated;

-- 4. Vistas: esconder a los suspendidos -----------------------------------------
-- agenda_anual: cuerpo de 0038_fechas_fijas_bisiestos.sql + filtro de activo (0049).
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
  and (cv.jugador_id is null or exists (select 1 from jugadores ja where ja.id = cv.jugador_id and ja.activo))

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
where (h.fecha is not null or h.fecha_utc is not null)
  and (h.jugador_id is null or exists (select 1 from jugadores ja where ja.id = h.jugador_id and ja.activo))

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
  where jg.fecha_nacimiento is not null and jg.servicio_match_day and jg.activo
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
                where jx.club_actual_id = cbb.id and jx.servicio_match_day and jx.activo)
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
  where jg.debut_seleccion is not null and jg.servicio_match_day and jg.activo
) j;

-- agenda_contenido: cuerpo de 0039_nombres_fechas_agencia.sql + filtro de activo (0049).
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
  where jg.fecha_nacimiento is not null and jg.servicio_contenido and jg.activo
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
    and exists (select 1 from jugadores jx where jx.club_actual_id = cbb.id and jx.servicio_contenido and jx.activo)
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
  where jg.debut_seleccion is not null and jg.servicio_contenido and jg.activo
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
  where jg.debut is not null and jg.servicio_contenido and jg.activo
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
    and (fa.jugador_id is null or (jg.servicio_contenido and jg.activo))
  group by fa.texto, fa.dia, fa.mes, fa.anio
) g
cross join (
  select generate_series(extract(year from now())::int - 1, extract(year from now())::int + 2) as y
) yr
cross join lateral (select (make_date(yr.y, g.mes, 1) + (g.dia - 1))::date as proj) p
-- 0037: no proyectar a años anteriores al hecho (un título de 2026 no se festeja en 2025).
where g.anio is null or yr.y >= g.anio;

-- proximos_partidos: cuerpo de 0033_copas_espn.sql + filtro de activo (0049).
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
join jugadores j           on j.id = pj.jugador_id and j.servicio_match_day and j.activo -- 0017; activo (0049)
left join competencias c   on c.id = p.competencia_id
left join clubes loc       on loc.id = p.club_local_id
-- 0032: jugando con la selección, "su club" es el lado que se llama como su selección.
left join clubes cl        on cl.id = case
  when pj.con_seleccion and loc.nombre = j.seleccion then p.club_local_id
  when pj.con_seleccion then p.club_visitante_id
  else j.club_actual_id
end
left join clubes riv on riv.id = case
  when pj.con_seleccion and loc.nombre = j.seleccion then p.club_visitante_id
  when pj.con_seleccion then p.club_local_id
  when j.club_actual_id = p.club_local_id then p.club_visitante_id
  else p.club_local_id
end
order by
  pj.jugador_id,
  pj.con_seleccion,
  coalesce((p.inicio_utc at time zone 'America/Montevideo')::date::text, 'sinfecha:' || p.id::text),
  -- 0033: prioridad por fuente — ligas: SportMonks; copas: ESPN (llega meses antes que API-Football,
  -- así el ticket no cambia de partido cuando API-Football trae la misma copa 2 días antes).
  case p.proveedor_externo when 'sportmonks' then 0 when 'espn' then 1 when 'api-football' then 2 else 3 end,
  p.sincronizado_en desc nulls last,
  p.id;

-- proximos_partidos_contenido: cuerpo de 0027_proximos_partidos_contenido.sql + filtro de activo (0049).
create or replace view proximos_partidos_contenido
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
                          and not j.servicio_match_day and j.servicio_contenido and j.activo -- solo Contenido, activos (0049)
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

-- 5. Nández: inactivo desde 2026-10-19 (avances.md), sin motivo registrado.
update jugadores
   set suspendido_en = '2026-10-19 12:00-03', motivo_suspension = 'La agencia ya no le ofrece el servicio.'
 where id = 'ef0b1152-a08a-46ca-9f5c-72c455a6c0dd' and not activo and motivo_suspension is null;

commit;
