-- ============================================================================
-- Football First — Migración 0032: convocatoria a mano a la selección uruguaya
--
-- Pedido de Gerardo (2026-09-30): si un representado de Match Day con selección Uruguay (hoy
-- Nahitan Nández) está convocado, ese partido de Uruguay ES de Match Day — tarjeta con su cara y
-- ticket automático para el Diseñador (0030). Ninguna fuente gratis publica la lista con tiempo y
-- API-Football nunca trajo esos partidos (0 filas `con_seleccion`), así que lo marca a mano el
-- Administrador o el Community Manager.
--
-- 1. `proximos_partidos`: cuerpo EXACTO de 0017; solo cambian los joins de club/rival: jugando con
--    la selección, "su club" es el lado del partido que se llama como su selección (Uruguay).
--    Así la tarjeta, `agenda_anual` y `tickets_match_day` dicen "Uruguay vs India".
-- 2. RPC `seleccion_convocar(partido, jugador, convocado)`: solo Administrador / CM, solo partidos
--    de `partidos_seleccion` (0031), solo representados de Match Day de Uruguay.
--
-- Reversible: `create or replace view proximos_partidos` con el cuerpo de 0017 +
-- `drop function seleccion_convocar(uuid, uuid, boolean)`.
-- Football First. Creado 2026-09-30.
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
  (p.proveedor_externo is distinct from 'api-football'),
  p.sincronizado_en desc nulls last,
  p.id;

comment on view proximos_partidos is 'Fuente única de la vista partidos del frontend. Una fila por representado de Match Day (0017: servicio_match_day, nunca Contenido) por partido, de-duplicada por (jugador, día en Uruguay, con_selección). `dia_local_sede` (0013) = día civil en la sede.';

create or replace function seleccion_convocar(p_partido uuid, p_jugador uuid, p_convocado boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cargo text := ticket__cargo_actual(); -- sin sesión → 42501
begin
  if v_cargo not in ('Administrador', 'Community Manager') then
    raise exception 'Solo el Administrador o el Community Manager marcan convocados.' using errcode = '42501';
  end if;
  if not exists (select 1 from partidos_seleccion s where s.partido_id = p_partido) then
    raise exception 'Ese partido no es de la selección.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from jugadores j
    where j.id = p_jugador and j.activo and j.servicio_match_day and j.seleccion = 'Uruguay'
  ) then
    raise exception 'Ese jugador no es un representado de Match Day de la selección uruguaya.' using errcode = '22023';
  end if;
  if p_convocado then
    insert into partidos_jugadores (partido_id, jugador_id, convocado, con_seleccion)
    values (p_partido, p_jugador, true, true)
    on conflict (partido_id, jugador_id) do update set convocado = true, con_seleccion = true;
  else
    delete from partidos_jugadores
    where partido_id = p_partido and jugador_id = p_jugador and con_seleccion;
  end if;
end;
$$;

revoke all on function seleccion_convocar(uuid, uuid, boolean) from public, anon;
grant execute on function seleccion_convocar(uuid, uuid, boolean) to authenticated;

commit;
