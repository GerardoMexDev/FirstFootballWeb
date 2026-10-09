-- ============================================================================
-- 0044 — Conteo mensual de diseños (pago del Diseñador). 2026-10-08.
-- Pedido de la agencia (avances.md §5): del 6 de un mes al 5 del siguiente, cuenta los diseños
-- COMPLETADOS: Match Day (casilla Completado en disenos_partido, sin los cancelados) + pedidos
-- fuera de Match Day (tickets a mano en 'publicado', de partido o de fecha). El período lo define
-- el DÍA EN QUE SE COMPLETÓ (hora de Uruguay); se calcula en vivo (decidido por Gerardo).
-- Solo lo ven el Administrador y el Diseñador (información de pago).
-- Reversible: drop function conteo_disenos(date, date).
-- ============================================================================
begin;

create or replace function conteo_disenos(p_desde date, p_hasta date)
returns table (
  tipo                  text,         -- 'matchday' | 'pedido'
  completado_dia        date,         -- día de Uruguay en que se completó
  completado_en         timestamptz,
  jugador_id            uuid,
  jugador_nombre        text,
  titulo                text,
  completado_por_nombre text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if ticket__cargo_actual() not in ('Administrador', 'Diseñador') then
    raise exception 'Solo el Administrador y el Diseñador ven el conteo de diseños.' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 62 then
    raise exception 'Período inválido.';
  end if;

  return query
  -- Match Day: una fila por partido y jugador con Completado tildado.
  select
    'matchday'::text,
    (d.completado_en at time zone 'America/Montevideo')::date,
    d.completado_en,
    j.id,
    coalesce(j.apodo, j.nombre),
    'Match Day — ' || coalesce(j.apodo, j.nombre) || ' · '
      || coalesce(cl.nombre, '?') || ' vs ' || coalesce(cv.nombre, '?'),
    pr.nombre_completo
  from disenos_partido d
  join jugadores j on j.id = d.jugador_id
  join partidos p on p.id = d.partido_id
  left join clubes cl on cl.id = p.club_local_id
  left join clubes cv on cv.id = p.club_visitante_id
  left join perfiles pr on pr.id = d.completado_por
  where not d.cancelado
    and (d.completado_en at time zone 'America/Montevideo')::date between p_desde and p_hasta

  union all

  -- Pedidos: tickets a mano completados; la fecha es el último paso a 'publicado' del historial.
  select
    'pedido'::text,
    (h.creado_en at time zone 'America/Montevideo')::date,
    h.creado_en,
    j.id,
    coalesce(j.apodo, j.nombre),
    t.titulo,
    pr.nombre_completo
  from tickets t
  join jugadores j on j.id = t.jugador_id
  join lateral (
    select hh.creado_en, hh.autor_id
    from tickets_historial hh
    where hh.ticket_id = t.id and hh.estado_hasta = 'publicado'
    order by hh.creado_en desc
    limit 1
  ) h on true
  left join perfiles pr on pr.id = h.autor_id
  where t.estado = 'publicado'
    and (h.creado_en at time zone 'America/Montevideo')::date between p_desde and p_hasta

  order by 3;
end;
$$;
revoke execute on function conteo_disenos(date, date) from public, anon;
grant execute on function conteo_disenos(date, date) to authenticated;
comment on function conteo_disenos(date, date) is 'Diseños completados entre dos días de Uruguay (0044): Match Day + pedidos. Solo Administrador y Diseñador.';

commit;
