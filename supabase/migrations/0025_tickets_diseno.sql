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

-- (Tasks 2 y 3 agregan acá las funciones de acción y los triggers sobre partidos.)

commit;
