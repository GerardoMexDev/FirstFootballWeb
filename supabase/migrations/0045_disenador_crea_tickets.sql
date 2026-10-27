-- ============================================================================
-- 0045 — El Diseñador también crea tickets. 2026-10-27.
-- Pedido de la agencia (avances.md, 2026-10-27): el Diseñador puede crear tickets de diseño,
-- igual que el Administrador y el Community Manager (de partido de Match Day y de fecha).
--  - ticket_crear / ticket_crear_evento: se suma 'Diseñador' a los cargos que crean. El resto
--    del cuerpo es idéntico a 0025 / 0028.
--  - ticket__mover ('revisor'): quien creó el ticket lo puede cancelar sea del cargo que sea
--    (antes solo el CM creador o el Admin). Así el Diseñador cancela los suyos; los de otros, no.
-- No toca datos. `create or replace` conserva los permisos; se re-afirman por las dudas.
-- Reversible: volver a correr los cuerpos de 0025 (ticket_crear, ticket__mover) y 0028
-- (ticket_crear_evento).
-- ============================================================================
begin;

create or replace function ticket__mover(
  p_ticket uuid, p_desde estado_ticket, p_hasta estado_ticket, p_tipo tipo_evento_ticket,
  p_quien text, p_texto text, p_link text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_cargo text := ticket__cargo_actual();
  t tickets;
begin
  -- 0) p_quien es un parámetro interno fijado por cada ticket_* (nunca por el cliente): si
  -- no es uno de los dos valores válidos, ambos chequeos de permiso de abajo se saltean y
  -- la función queda "fail-open". Se corta acá, antes del lock, con un mensaje interno.
  if p_quien not in ('disenador', 'revisor') then
    raise exception 'ticket__mover: p_quien inválido (%)', p_quien;
  end if;
  -- 1) permiso por puesto (antes de bloquear: un rechazo no espera locks)
  if p_quien = 'disenador' and v_cargo <> 'Diseñador' then
    raise exception 'Solo el Diseñador puede hacer esto.' using errcode = '42501';
  end if;
  t := ticket__bloquear(p_ticket);
  -- 0045: el creador de cualquier cargo con permiso de crear (Admin, CM o Diseñador).
  if p_quien = 'revisor' and not (
    v_cargo = 'Administrador'
    or (v_cargo in ('Community Manager', 'Diseñador') and t.creado_por = auth.uid())
  ) then
    raise exception 'Solo quien creó el ticket o el Administrador puede hacer esto.' using errcode = '42501';
  end if;
  -- 2) estado (leído con el lock tomado: si otro lo cambió, se ve el cambio)
  if t.estado <> p_desde then
    raise exception 'El ticket cambió de estado (ahora está "%"). Recargá para ver lo último.', t.estado;
  end if;
  -- 3) cambio + historial, en la misma transacción
  update tickets set estado = p_hasta, link_entrega = coalesce(p_link, link_entrega) where id = p_ticket;
  insert into tickets_historial (ticket_id, tipo, autor_id, texto, link, estado_desde, estado_hasta)
  values (p_ticket, p_tipo, auth.uid(), p_texto, p_link, p_desde, p_hasta);
end;
$$;

create or replace function ticket_crear(p_partido uuid, p_jugador uuid, p_nota text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_cargo  text := ticket__cargo_actual();
  v_nota   text;
  v_titulo text;
  v_inicio timestamptz;
  v_id     uuid;
begin
  if v_cargo not in ('Administrador', 'Community Manager', 'Diseñador') then
    raise exception 'Solo el Administrador, el Community Manager o el Diseñador pueden crear tickets.' using errcode = '42501';
  end if;
  v_nota := ticket__texto(p_nota, true, 'Escribí qué hay que hacer.');

  select 'Match Day — ' || coalesce(j.apodo, j.nombre) || ' · '
         || coalesce(cl.nombre, '?') || ' vs ' || coalesce(cv.nombre, '?'),
         p.inicio_utc
    into v_titulo, v_inicio
  from partidos p
  join partidos_jugadores pj on pj.partido_id = p.id and pj.jugador_id = p_jugador
  join jugadores j on j.id = p_jugador and j.activo and j.servicio_match_day
  left join clubes cl on cl.id = p.club_local_id
  left join clubes cv on cv.id = p.club_visitante_id
  where p.id = p_partido;

  if v_titulo is null then
    raise exception 'Ese jugador no figura en ese partido de Match Day.';
  end if;

  insert into tickets (partido_id, jugador_id, titulo, nota, inicio_utc_conocido, creado_por)
  values (p_partido, p_jugador, v_titulo, v_nota, v_inicio, auth.uid())
  returning id into v_id;

  insert into tickets_historial (ticket_id, tipo, autor_id, texto, estado_hasta)
  values (v_id, 'creado', auth.uid(), v_nota, 'pendiente');

  return v_id;
end;
$$;

create or replace function ticket_crear_evento(p_jugador uuid, p_fecha date, p_motivo text, p_nota text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_cargo  text := ticket__cargo_actual();
  v_nota   text;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_nombre text;
  v_hoy    date := (now() at time zone 'America/Montevideo')::date;
  v_id     uuid;
begin
  if v_cargo not in ('Administrador', 'Community Manager', 'Diseñador') then
    raise exception 'Solo el Administrador, el Community Manager o el Diseñador pueden crear tickets.' using errcode = '42501';
  end if;
  v_nota := ticket__texto(p_nota, true, 'Escribí qué hay que hacer.');
  if char_length(v_motivo) not between 1 and 120 then
    raise exception 'Escribí el motivo (hasta 120 caracteres).';
  end if;
  if p_fecha is null or p_fecha < v_hoy then
    raise exception 'La fecha del evento no puede ser anterior a hoy.';
  end if;

  select coalesce(j.apodo, j.nombre) into v_nombre
  from jugadores j
  where j.id = p_jugador and j.activo and j.servicio_contenido;
  if v_nombre is null then
    raise exception 'Ese jugador no está en el servicio de Contenido.';
  end if;

  insert into tickets (jugador_id, titulo, nota, fecha_evento, motivo, creado_por)
  values (
    p_jugador,
    'Contenido — ' || v_nombre || ' · ' || v_motivo
      || ' (' || extract(day from p_fecha)::int || '/' || extract(month from p_fecha)::int || ')',
    v_nota, p_fecha, v_motivo, auth.uid()
  )
  returning id into v_id;

  insert into tickets_historial (ticket_id, tipo, autor_id, texto, estado_hasta)
  values (v_id, 'creado', auth.uid(), v_nota, 'pendiente');

  return v_id;
end;
$$;

revoke execute on function
  ticket__mover(uuid, estado_ticket, estado_ticket, tipo_evento_ticket, text, text, text)
  from public, anon, authenticated;
revoke execute on function
  ticket_crear(uuid, uuid, text), ticket_crear_evento(uuid, date, text, text)
  from public, anon;
grant execute on function
  ticket_crear(uuid, uuid, text), ticket_crear_evento(uuid, date, text, text)
  to authenticated;

commit;
