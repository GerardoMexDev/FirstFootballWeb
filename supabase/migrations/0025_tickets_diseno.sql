-- ============================================================================
-- 0025 — Tickets de diseño (Admin / CM → Diseñador). Sesión 12, 2026-09-28.
-- Spec: planeacion/specs/2026-09-28-tickets-diseno.md
-- ============================================================================
-- Aditiva: tipos, 2 tablas, 3 vistas, funciones de acción y triggers. No toca datos
-- existentes. Las tablas de Fase 2 (piezas*, campanas) quedan sin tocar.
--
-- Seguridad:
--  - RLS: solo SELECT para usuarios activos. Nadie escribe directo: se revoca TODO (no solo
--    insert/update/delete/truncate; también trigger/references/maintain, que Postgres concede
--    por default a `authenticated` sobre lo que crea `postgres`) a anon y authenticated en las
--    2 tablas y las 3 vistas — todo pasa por las funciones ticket_*.
--  - `perfiles_publicos` es una vista de una sola tabla (auto-actualizable) que corre con los
--    permisos del dueño, no de quien consulta (no lleva security_invoker): si no se le revoca
--    TODO a `authenticated`, cualquier logueado podría escribir en `perfiles` a través de ella,
--    esquivando su RLS. `tickets_vista`/`tickets_historial_vista` son joins con
--    security_invoker = true, no auto-actualizables por estructura.
--  - Historial imborrable: trigger que rechaza UPDATE/DELETE/TRUNCATE para TODOS los roles.
--    Un ticket no se borra (se cancela). Única salida: scripts/limpiar-tickets.sql (dueño).
-- ============================================================================
begin;

-- ─── 1. Tipos ───────────────────────────────────────────────────────────────
create type estado_ticket as enum ('pendiente', 'en_revision', 'aprobado', 'publicado', 'cancelado');
create type tipo_evento_ticket as enum
  ('creado', 'comentario', 'entrega', 'aprobado', 'devuelto', 'publicado', 'cancelado', 'sistema');

-- ─── 2. Días de anticipación de la fecha límite (a confirmar con la agencia) ─
create or replace function ticket_dias_anticipacion()
returns int language sql immutable as $$ select 2 $$;

-- ─── 3. Tablas ──────────────────────────────────────────────────────────────
create table tickets (
  id                   uuid primary key default gen_random_uuid(),
  partido_id           uuid references partidos (id) on delete set null,
  -- restrict a propósito: un jugador con tickets no se borra (protege el historial).
  jugador_id           uuid not null references jugadores (id) on delete restrict,
  titulo               text not null check (char_length(titulo) between 1 and 300),
  nota                 text not null check (char_length(nota) between 1 and 2000),
  estado               estado_ticket not null default 'pendiente',
  link_entrega         text check (link_entrega is null or link_entrega ~ '^https://[^[:space:]]+$'),
  -- última fecha conocida del partido: sirve si el partido desaparece de la fuente.
  inicio_utc_conocido  timestamptz,
  creado_por           uuid not null references perfiles (id) on delete restrict,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now()
);
comment on table tickets is 'Encargos de diseño (Admin/CM → Diseñador) atados a un partido de Match Day. Se escriben solo vía funciones ticket_*.';

create index tickets_partido_idx on tickets (partido_id);
create index tickets_estado_idx on tickets (estado);
create index tickets_creado_por_idx on tickets (creado_por);

create trigger tickets_set_updated_at
  before update on tickets
  for each row execute function set_updated_at();

create table tickets_historial (
  id            bigint generated always as identity primary key,
  ticket_id     uuid not null references tickets (id) on delete restrict,
  tipo          tipo_evento_ticket not null,
  autor_id      uuid references perfiles (id) on delete restrict,
  texto         text check (texto is null or char_length(texto) <= 2000),
  link          text check (link is null or link ~ '^https://[^[:space:]]+$'),
  estado_desde  estado_ticket,
  estado_hasta  estado_ticket,
  creado_en     timestamptz not null default now(),
  -- los avisos del sistema no tienen autor; todo lo demás sí.
  check ((tipo = 'sistema') = (autor_id is null))
);
comment on table tickets_historial is 'Línea de tiempo imborrable de cada ticket (comentarios, cambios de estado, entregas, avisos del sistema).';

create index tickets_historial_ticket_idx on tickets_historial (ticket_id, id);

-- ─── 4. Inmutabilidad ───────────────────────────────────────────────────────
create or replace function tickets_historial_inmutable()
returns trigger language plpgsql as $$
begin
  raise exception 'El historial de tickets no se puede editar ni borrar' using errcode = '42501';
end;
$$;

create trigger tickets_historial_inmutable
  before update or delete on tickets_historial
  for each row execute function tickets_historial_inmutable();
create trigger tickets_historial_sin_truncate
  before truncate on tickets_historial
  for each statement execute function tickets_historial_inmutable();

create or replace function tickets_sin_borrado()
returns trigger language plpgsql as $$
begin
  raise exception 'Un ticket no se borra: se cancela' using errcode = '42501';
end;
$$;

create trigger tickets_sin_borrado
  before delete on tickets
  for each row execute function tickets_sin_borrado();
create trigger tickets_sin_truncate
  before truncate on tickets
  for each statement execute function tickets_sin_borrado();

-- ─── 5. Vistas ──────────────────────────────────────────────────────────────
-- perfiles: la RLS deja ver solo la fila propia. Esta vista (permisos del dueño) expone
-- SOLO id/nombre/cargo, y solo a usuarios activos, para mostrar autores en la UI.
create view perfiles_publicos as
  select p.id, p.nombre_completo, p.cargo
  from perfiles p
  where es_usuario_activo();

create view tickets_vista with (security_invoker = true) as
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
  (t.partido_id is null)                         as partido_eliminado,
  case
    when coalesce(p.inicio_utc, t.inicio_utc_conocido) is null then null
    else (coalesce(p.inicio_utc, t.inicio_utc_conocido) at time zone 'America/Montevideo')::date
         - ticket_dias_anticipacion()
  end                                            as fecha_limite,
  t.creado_en,
  t.actualizado_en
from tickets t
join jugadores j on j.id = t.jugador_id
left join partidos p on p.id = t.partido_id
left join perfiles_publicos pc on pc.id = t.creado_por;

create view tickets_historial_vista with (security_invoker = true) as
select
  h.id,
  h.ticket_id,
  h.tipo,
  h.autor_id,
  pp.nombre_completo as autor_nombre,
  h.texto,
  h.link,
  h.estado_desde,
  h.estado_hasta,
  h.creado_en
from tickets_historial h
left join perfiles_publicos pp on pp.id = h.autor_id;

-- ─── 6. RLS y permisos ──────────────────────────────────────────────────────
alter table tickets enable row level security;
alter table tickets_historial enable row level security;

create policy tickets_select on tickets for select using (es_usuario_activo());
create policy tickets_historial_select on tickets_historial for select using (es_usuario_activo());

revoke all on tickets, tickets_historial, tickets_vista, tickets_historial_vista, perfiles_publicos from anon;
revoke all on tickets, tickets_historial, tickets_vista, tickets_historial_vista, perfiles_publicos from authenticated;
grant select on tickets, tickets_historial, tickets_vista, tickets_historial_vista, perfiles_publicos to authenticated;

-- ─── 7. Funciones de acción (única vía de escritura) ────────────────────────
-- Helpers internos: no se exponen por RPC (se revoca EXECUTE a public/anon/authenticated).
-- Corren dentro de las funciones security definer, o sea con los permisos del dueño.

create or replace function ticket__cargo_actual()
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_cargo text;
begin
  select p.cargo into v_cargo from perfiles p where p.id = auth.uid() and p.activo;
  if auth.uid() is null or v_cargo is null then
    raise exception 'Necesitás una sesión activa para hacer esto.' using errcode = '42501';
  end if;
  return v_cargo;
end;
$$;

create or replace function ticket__texto(p_texto text, p_obligatorio boolean, p_mensaje text)
returns text language plpgsql immutable as $$
declare
  v text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if v is null and p_obligatorio then
    raise exception '%', p_mensaje;
  end if;
  if char_length(v) > 2000 then
    raise exception 'El texto es muy largo (máximo 2000 caracteres).';
  end if;
  return v;
end;
$$;

create or replace function ticket__bloquear(p_ticket uuid)
returns tickets language plpgsql security definer set search_path = public as $$
declare
  t tickets;
begin
  select * into t from tickets where id = p_ticket for update;
  if not found then
    raise exception 'No encontramos ese ticket.';
  end if;
  return t;
end;
$$;

-- p_quien: 'disenador' (solo Diseñador) | 'revisor' (creador del ticket o Administrador)
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
  if p_quien = 'revisor' and not (
    v_cargo = 'Administrador' or (v_cargo = 'Community Manager' and t.creado_por = auth.uid())
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
  if v_cargo not in ('Administrador', 'Community Manager') then
    raise exception 'Solo el Administrador o el Community Manager pueden crear tickets.' using errcode = '42501';
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

create or replace function ticket_entregar(p_ticket uuid, p_link text, p_texto text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_link text := btrim(coalesce(p_link, ''));
begin
  if v_link !~ '^https://[^[:space:]]+$' then
    raise exception 'Pegá el link de Dropbox del diseño (tiene que empezar con https://).';
  end if;
  perform ticket__mover(p_ticket, 'pendiente', 'en_revision', 'entrega', 'disenador',
                        ticket__texto(p_texto, false, null), v_link);
end;
$$;

create or replace function ticket_aprobar(p_ticket uuid, p_texto text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform ticket__mover(p_ticket, 'en_revision', 'aprobado', 'aprobado', 'revisor',
                        ticket__texto(p_texto, false, null));
end;
$$;

create or replace function ticket_devolver(p_ticket uuid, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform ticket__mover(p_ticket, 'en_revision', 'pendiente', 'devuelto', 'revisor',
                        ticket__texto(p_texto, true, 'Escribí qué hay que corregir.'));
end;
$$;

create or replace function ticket_publicar(p_ticket uuid, p_texto text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform ticket__mover(p_ticket, 'aprobado', 'publicado', 'publicado', 'disenador',
                        ticket__texto(p_texto, false, null));
end;
$$;

create or replace function ticket_cancelar(p_ticket uuid, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform ticket__mover(p_ticket, 'pendiente', 'cancelado', 'cancelado', 'revisor',
                        ticket__texto(p_texto, true, 'Escribí por qué se cancela.'));
end;
$$;

create or replace function ticket_comentar(p_ticket uuid, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cargo text := ticket__cargo_actual();
  v_texto text;
begin
  if v_cargo not in ('Administrador', 'Community Manager', 'Diseñador') then
    raise exception 'No tenés permiso para comentar tickets.' using errcode = '42501';
  end if;
  v_texto := ticket__texto(p_texto, true, 'Escribí un comentario.');
  perform ticket__bloquear(p_ticket);
  insert into tickets_historial (ticket_id, tipo, autor_id, texto)
  values (p_ticket, 'comentario', auth.uid(), v_texto);
end;
$$;

revoke execute on function
  ticket__cargo_actual(), ticket__texto(text, boolean, text), ticket__bloquear(uuid),
  ticket__mover(uuid, estado_ticket, estado_ticket, tipo_evento_ticket, text, text, text)
  from public, anon, authenticated;

revoke execute on function
  ticket_crear(uuid, uuid, text), ticket_entregar(uuid, text, text), ticket_aprobar(uuid, text),
  ticket_devolver(uuid, text), ticket_publicar(uuid, text), ticket_cancelar(uuid, text),
  ticket_comentar(uuid, text)
  from public, anon;
grant execute on function
  ticket_crear(uuid, uuid, text), ticket_entregar(uuid, text, text), ticket_aprobar(uuid, text),
  ticket_devolver(uuid, text), ticket_publicar(uuid, text), ticket_cancelar(uuid, text),
  ticket_comentar(uuid, text)
  to authenticated;

-- (Task 3 agrega acá los triggers de avisos sobre partidos.)

commit;
