-- ============================================================================
-- 0030 — Match Day automático + tickets manuales simplificados. Sesión 15, 2026-09-30.
-- Spec: planeacion/specs/2026-09-30-match-day-automatico.md
-- ============================================================================
-- 1) Cada partido de Match Day es un "ticket" automático por jugador. El estado se CALCULA
--    (vista tickets_match_day): completado si el Diseñador lo tildó (tabla disenos_partido),
--    vencido si pasó la fecha límite (partido − ticket_dias_anticipacion()) sin tildar,
--    pendiente si no. Partidos anteriores a match_day_desde() (día de publicación) → sin estado.
-- 2) Tickets manuales: pendiente → completado. "Completado" se guarda como el estado existente
--    'publicado' (agregar un valor al enum no se puede usar en la misma transacción). Los que
--    estaban en 'en_revision' o 'aprobado' pasan a 'publicado' con un evento 'sistema'.
-- Reversible: drop view tickets_match_day; drop function diseno_partido_marcar, ticket_completar,
-- ticket_reabrir, match_day_desde; drop table disenos_partido. (El cambio de estados no se revierte.)
-- ============================================================================
begin;

create or replace function match_day_desde()
returns date language sql immutable as $$ select date '2026-09-30' $$;
comment on function match_day_desde() is 'Día de publicación del Match Day automático (0030): antes, los partidos no tienen estado.';

create table disenos_partido (
  partido_id     uuid not null references partidos (id) on delete cascade,
  jugador_id     uuid not null references jugadores (id) on delete cascade,
  completado_por uuid not null references perfiles (id) on delete restrict,
  completado_en  timestamptz not null default now(),
  primary key (partido_id, jugador_id)
);
comment on table disenos_partido is 'Marca de "Completado" del Diseñador por partido de Match Day y jugador (0030).';
alter table disenos_partido enable row level security;
create policy disenos_partido_select on disenos_partido for select using (es_usuario_activo());
revoke all on disenos_partido from anon, authenticated;
grant select on disenos_partido to authenticated;

create or replace function diseno_partido_marcar(p_partido uuid, p_jugador uuid, p_completado boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if ticket__cargo_actual() <> 'Diseñador' then
    raise exception 'Solo el Diseñador puede hacer esto.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from partidos_jugadores pj
    join jugadores j on j.id = pj.jugador_id and j.activo and j.servicio_match_day
    where pj.partido_id = p_partido and pj.jugador_id = p_jugador
  ) then
    raise exception 'Ese jugador no figura en ese partido de Match Day.';
  end if;
  if p_completado then
    insert into disenos_partido (partido_id, jugador_id, completado_por)
    values (p_partido, p_jugador, auth.uid())
    on conflict (partido_id, jugador_id) do nothing;
  else
    delete from disenos_partido where partido_id = p_partido and jugador_id = p_jugador;
  end if;
end;
$$;
revoke execute on function diseno_partido_marcar(uuid, uuid, boolean) from public, anon;
grant execute on function diseno_partido_marcar(uuid, uuid, boolean) to authenticated;

create view tickets_match_day with (security_invoker = true) as
select
  pp.partido_id,
  pp.jugador_id,
  coalesce(pp.jugador_apodo, pp.jugador_nombre)                          as jugador_nombre,
  'Match Day — ' || coalesce(pp.jugador_apodo, pp.jugador_nombre) || ' · '
    || coalesce(pp.club_nombre, '?') || ' vs ' || coalesce(pp.rival_nombre, '?') as titulo,
  pp.dia_uy,
  pp.inicio_utc,
  case when pp.dia_uy is null then null else pp.dia_uy - ticket_dias_anticipacion() end as fecha_limite,
  case
    when pp.dia_uy is not null and pp.dia_uy < match_day_desde() then null
    when d.partido_id is not null then 'completado'
    when pp.dia_uy is not null
         and (now() at time zone 'America/Montevideo')::date > pp.dia_uy - ticket_dias_anticipacion() then 'vencido'
    else 'pendiente'
  end                                                                    as estado,
  pc.nombre_completo                                                     as completado_por_nombre,
  d.completado_en
from proximos_partidos pp
left join disenos_partido d on d.partido_id = pp.partido_id and d.jugador_id = pp.jugador_id
left join perfiles_publicos pc on pc.id = d.completado_por;
comment on view tickets_match_day is 'Ticket automático por partido de Match Day y jugador (0030): estado calculado.';
revoke all on tickets_match_day from anon, authenticated;
grant select on tickets_match_day to authenticated;

create or replace function ticket_completar(p_ticket uuid, p_texto text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform ticket__mover(p_ticket, 'pendiente', 'publicado', 'publicado', 'disenador',
                        ticket__texto(p_texto, false, null));
end;
$$;

create or replace function ticket_reabrir(p_ticket uuid, p_texto text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform ticket__mover(p_ticket, 'publicado', 'pendiente', 'devuelto', 'disenador',
                        ticket__texto(p_texto, false, null));
end;
$$;
revoke execute on function ticket_completar(uuid, text), ticket_reabrir(uuid, text) from public, anon;
grant execute on function ticket_completar(uuid, text), ticket_reabrir(uuid, text) to authenticated;

-- Datos: los manuales en revisión o aprobados pasan a completado (el diseño ya se entregó).
insert into tickets_historial (ticket_id, tipo, autor_id, texto, estado_desde, estado_hasta)
select id, 'sistema', null, 'Pasó a Completado: el recorrido de tickets se simplificó (pendiente → completado).', estado, 'publicado'
from tickets where estado in ('en_revision', 'aprobado');
update tickets set estado = 'publicado' where estado in ('en_revision', 'aprobado');

commit;
