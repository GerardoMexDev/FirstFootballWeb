-- ============================================================================
-- 0028 — Tickets de diseño atados a una FECHA (sin partido), desde la ficha del jugador.
-- Spec: planeacion/specs/2026-09-29-tickets-desde-ficha.md. Sesión 14, 2026-09-29.
-- ============================================================================
-- Aditiva: 2 columnas nullable + 2 checks + índice en `tickets`, `tickets_vista` recreada con
-- las mismas columnas + 3 al final, y la función `ticket_crear_evento`. No toca datos.
--  - Un ticket es de partido O de fecha (nunca los dos). Fecha y motivo van juntos.
--  - `fecha_limite`: la del partido si lo hay; si no, fecha_evento − ticket_dias_anticipacion().
--  - `partido_eliminado` pasa a ser "sin partido Y sin fecha": un ticket de fecha no es huérfano.
--  - Las demás funciones (entregar, aprobar, …) no miran el partido: sirven igual.
-- Reversible: recrear la vista con el cuerpo de 0025, `drop function ticket_crear_evento`,
-- y `alter table tickets drop column fecha_evento, drop column motivo` (si no hay tickets de fecha).
-- ============================================================================
begin;

alter table tickets
  add column fecha_evento date,
  add column motivo       text check (motivo is null or char_length(motivo) between 1 and 120),
  add constraint tickets_partido_o_fecha check (partido_id is null or fecha_evento is null),
  add constraint tickets_fecha_con_motivo check ((fecha_evento is null) = (motivo is null));

create index tickets_fecha_evento_idx on tickets (fecha_evento) where fecha_evento is not null;

comment on column tickets.fecha_evento is 'Día del evento (cumpleaños, aniversario, convocatoria…) para tickets sin partido (0028).';
comment on column tickets.motivo is 'Qué se celebra en fecha_evento ("Cumpleaños", "Convocado a la selección: …").';

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
    when t.fecha_evento is not null then t.fecha_evento - ticket_dias_anticipacion()
    else null
  end                                            as fecha_limite,
  t.creado_en,
  t.actualizado_en,
  t.fecha_evento,
  t.motivo,
  (not j.servicio_match_day)                     as jugador_solo_contenido
from tickets t
join jugadores j on j.id = t.jugador_id
left join partidos p on p.id = t.partido_id
left join perfiles_publicos pc on pc.id = t.creado_por;

-- `create or replace` conserva los permisos de 0025; se re-afirman por las dudas.
revoke all on tickets_vista from anon, authenticated;
grant select on tickets_vista to authenticated;

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
  if v_cargo not in ('Administrador', 'Community Manager') then
    raise exception 'Solo el Administrador o el Community Manager pueden crear tickets.' using errcode = '42501';
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

revoke execute on function ticket_crear_evento(uuid, date, text, text) from public, anon;
grant execute on function ticket_crear_evento(uuid, date, text, text) to authenticated;

commit;
