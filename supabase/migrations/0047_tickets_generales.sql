-- ============================================================================
-- 0047 — Tickets GENERALES (sin jugador). 2026-10-28.
-- Pedido de la agencia: el Diseñador hace trabajos que no son de un jugador representado
-- (piezas de la agencia, eventos, sponsors…). Decisiones de Gerardo (2026-10-28): fecha de
-- entrega obligatoria y asunto libre (sin categorías).
-- ============================================================================
-- Aditiva: no toca datos. Un ticket general reutiliza las columnas de los tickets de fecha
-- (0028): `fecha_evento` = día de entrega, `motivo` = asunto. Así el semáforo, el calendario y
-- las alertas lo tratan igual que a un ticket de fecha.
--  - `tickets.jugador_id` pasa a admitir null, solo para tickets generales: sin jugador ⇒ sin
--    partido y con fecha (check `tickets_general_con_fecha`).
--  - `tickets_vista`: left join a jugadores; `fecha_limite` de un general = el día de entrega
--    (sin los días de anticipación: la fecha que se elige ES la de entrega); columna nueva
--    `es_general` al final.
--  - `ticket_crear_general(fecha, asunto, nota)`: mismos cargos que crean los demás (0045).
--  - `conteo_disenos`: left join a jugadores; los generales cuentan con jugador "General".
-- Reversible (si no hay tickets generales): recrear `tickets_vista` (0028) y `conteo_disenos`
-- (0046), `drop function ticket_crear_general`, `alter table tickets drop constraint
-- tickets_general_con_fecha, alter column jugador_id set not null`.
-- ============================================================================
begin;

alter table tickets
  alter column jugador_id drop not null,
  add constraint tickets_general_con_fecha
    check (jugador_id is not null or (partido_id is null and fecha_evento is not null));

comment on column tickets.jugador_id is 'Jugador del ticket; null solo en tickets generales (0047), que llevan fecha de entrega y asunto.';

create or replace view tickets_vista with (security_invoker = true) as
select
  t.id,
  t.partido_id,
  t.jugador_id,
  coalesce(j.apodo, j.nombre)                    as jugador_nombre,
  t.titulo,
  t.nota,
  t.estado,
  t.link_entrega,
  t.creado_por,
  pc.nombre_completo                             as creado_por_nombre,
  coalesce(p.inicio_utc, t.inicio_utc_conocido)  as inicio_utc,
  p.estado                                       as estado_partido,
  (t.partido_id is null and t.fecha_evento is null) as partido_eliminado,
  case
    when coalesce(p.inicio_utc, t.inicio_utc_conocido) is not null then
      (coalesce(p.inicio_utc, t.inicio_utc_conocido) at time zone 'America/Montevideo')::date
      - ticket_dias_anticipacion()
    -- 0047: general → vence el día de entrega elegido.
    when t.jugador_id is null then t.fecha_evento
    when t.fecha_evento is not null then t.fecha_evento - ticket_dias_anticipacion()
    else null
  end                                            as fecha_limite,
  t.creado_en,
  t.actualizado_en,
  t.fecha_evento,
  t.motivo,
  coalesce(not j.servicio_match_day, false)      as jugador_solo_contenido,
  (t.jugador_id is null)                         as es_general
from tickets t
left join jugadores j on j.id = t.jugador_id
left join partidos p on p.id = t.partido_id
left join perfiles_publicos pc on pc.id = t.creado_por;

revoke all on tickets_vista from anon, authenticated;
grant select on tickets_vista to authenticated;

create or replace function ticket_crear_general(p_fecha date, p_asunto text, p_nota text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_cargo  text := ticket__cargo_actual();
  v_nota   text;
  v_asunto text := btrim(coalesce(p_asunto, ''));
  v_hoy    date := (now() at time zone 'America/Montevideo')::date;
  v_id     uuid;
begin
  if v_cargo not in ('Administrador', 'Community Manager', 'Diseñador') then
    raise exception 'Solo el Administrador, el Community Manager o el Diseñador pueden crear tickets.' using errcode = '42501';
  end if;
  v_nota := ticket__texto(p_nota, true, 'Escribí qué hay que hacer.');
  if char_length(v_asunto) not between 1 and 120 then
    raise exception 'Escribí el asunto (hasta 120 caracteres).';
  end if;
  if p_fecha is null or p_fecha < v_hoy then
    raise exception 'La fecha de entrega no puede ser anterior a hoy.';
  end if;

  insert into tickets (jugador_id, titulo, nota, fecha_evento, motivo, creado_por)
  values (null, 'General — ' || v_asunto, v_nota, p_fecha, v_asunto, auth.uid())
  returning id into v_id;

  insert into tickets_historial (ticket_id, tipo, autor_id, texto, estado_hasta)
  values (v_id, 'creado', auth.uid(), v_nota, 'pendiente');

  return v_id;
end;
$$;

revoke execute on function ticket_crear_general(date, text, text) from public, anon;
grant execute on function ticket_crear_general(date, text, text) to authenticated;

-- Conteo: mismo cuerpo que 0046 salvo el left join y el nombre "General" en los pedidos.
create or replace function conteo_disenos(p_desde date, p_hasta date)
returns table (
  tipo                  text,
  completado_dia        date,
  completado_en         timestamptz,
  jugador_id            uuid,
  jugador_nombre        text,
  titulo                text,
  completado_por_nombre text,
  pedido_por_nombre     text
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
  select
    'matchday'::text,
    (d.completado_en at time zone 'America/Montevideo')::date,
    d.completado_en,
    j.id,
    coalesce(j.apodo, j.nombre),
    'Match Day — ' || coalesce(j.apodo, j.nombre) || ' · '
      || coalesce(cl.nombre, '?') || ' vs ' || coalesce(cv.nombre, '?'),
    pr.nombre_completo,
    null::text
  from disenos_partido d
  join jugadores j on j.id = d.jugador_id
  join partidos p on p.id = d.partido_id
  left join clubes cl on cl.id = p.club_local_id
  left join clubes cv on cv.id = p.club_visitante_id
  left join perfiles pr on pr.id = d.completado_por
  where not d.cancelado
    and (d.completado_en at time zone 'America/Montevideo')::date between p_desde and p_hasta

  union all

  select
    'pedido'::text,
    (h.creado_en at time zone 'America/Montevideo')::date,
    h.creado_en,
    j.id,
    coalesce(j.apodo, j.nombre, 'General'),   -- 0047: tickets sin jugador
    t.titulo,
    pr.nombre_completo,
    pc.nombre_completo
  from tickets t
  left join jugadores j on j.id = t.jugador_id
  join lateral (
    select hh.creado_en, hh.autor_id
    from tickets_historial hh
    where hh.ticket_id = t.id and hh.estado_hasta = 'publicado'
    order by hh.creado_en desc
    limit 1
  ) h on true
  left join perfiles pr on pr.id = h.autor_id
  left join perfiles pc on pc.id = t.creado_por
  where t.estado = 'publicado'
    and (h.creado_en at time zone 'America/Montevideo')::date between p_desde and p_hasta

  order by 3;
end;
$$;

revoke execute on function conteo_disenos(date, date) from public, anon;
grant execute on function conteo_disenos(date, date) to authenticated;

commit;
