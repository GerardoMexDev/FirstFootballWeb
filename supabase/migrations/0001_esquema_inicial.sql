-- ============================================================================
-- Football First — Migración 0001: esquema inicial (Fase 1)
--
-- Contenido:
--   1. Extensiones
--   2. Enums (dominios cerrados)
--   3. Función/trigger de auditoría  set_updated_at()
--   4. Tabla perfiles (1:1 con auth.users) + alta automática
--   5. Tablas de dominio (clubes, jugadores, competencias, partidos, ...)
--   6. Tabla de configuración del motor de hitos (escalas_hito) + seed
--   7. Tabla de bitácora de sincronizaciones
--   8. Estructura CRM Fase 2 (SOLO tablas, sin lógica — no se usa en Fase 1)
--   9. Índices y claves naturales para upsert idempotente
--  10. RLS: enable + políticas
--  11. Vistas  proximos_partidos  y  agenda_anual
--  12. Jobs pg_cron (plantillas comentadas; se activan tras desplegar las Edge Functions)
--
-- Reglas que respeta este esquema (ver planeacion/contexto.md):
--   · Timestamps SIEMPRE timestamptz. La conexión de Postgres va en UTC.
--   · Zonas horarias: se guarda instante UTC + nombre IANA de la sede. Cero offsets fijos.
--     Toda conversión a hora de Uruguay usa  at time zone 'America/Montevideo'  (nombre IANA).
--   · Modelo híbrido: cada tabla de datos externos lleva
--     origen / proveedor_externo / id_externo / payload_crudo / sincronizado_en.
--   · NULL = "sin datos". Jamás 0 por defecto en marcadores ni estadísticas.
--   · RLS en TODAS las tablas de public. Sin política = sin acceso. Nada anónimo.
--   · service_role (salta RLS) solo desde Edge Functions y scripts de servidor.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONES
-- ----------------------------------------------------------------------------
-- pg_cron: agenda los disparos de sincronización.
-- pg_net : hace el http_post a la Edge Function (no llama a terceros ni parsea JSON).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ----------------------------------------------------------------------------
-- 2. ENUMS
-- ----------------------------------------------------------------------------
-- Dominios cerrados y estables en Fase 1. Fase 2 puede ampliar con  ALTER TYPE ... ADD VALUE.

-- Rol de acceso. En Fase 1 hay un único valor: 'usuario'.
-- Fase 2 agregará 'cm' y 'admin' para gobernar el flujo del CRM por RLS.
create type rol_usuario as enum ('usuario');

-- De dónde salió el registro.
create type origen_dato as enum ('api', 'manual', 'derivado');

create type tipo_competencia as enum ('liga', 'copa', 'continental', 'seleccion');

create type estado_partido as enum ('programado', 'en_juego', 'finalizado', 'suspendido', 'sin_datos');

create type tipo_convocatoria as enum ('club', 'seleccion');

create type tipo_hito as enum (
  'debut', 'gol_numero', 'partido_numero', 'titulo', 'traspaso',
  'cumpleanos', 'aniversario_club', 'renovacion', 'lesion', 'hito_interno', 'otro'
);

-- Configuración del motor de hitos.
create type metrica_hito as enum ('pj', 'g', 'a');   -- partidos jugados / goles / asistencias
create type base_hito    as enum ('carrera', 'seleccion');

-- Bitácora de sincronizaciones.
create type recurso_sync as enum ('partidos', 'estadisticas', 'agenda');
create type estado_sync  as enum ('ok', 'error', 'parcial');

-- ----------------------------------------------------------------------------
-- 3. AUDITORÍA: trigger set_updated_at()
-- ----------------------------------------------------------------------------
-- Mantiene actualizado_en en cada UPDATE. Se engancha a todas las tablas de dominio.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. PERFILES (1:1 con auth.users)
-- ----------------------------------------------------------------------------
-- El id es el mismo uuid que auth.users. El correo y el rol los cambia un admin
-- (en Fase 1, vía consola de Supabase / script service_role). 'cargo' es descriptivo.
create table perfiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  nombre_completo   text not null default '',
  rol               rol_usuario not null default 'usuario',
  cargo             text not null default 'Prueba'
                      check (cargo in ('Diseñador', 'Community Manager', 'Administrador', 'Prueba')),
  activo            boolean not null default true,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);

comment on table perfiles is 'Datos de aplicación del usuario. 1:1 con auth.users.';

create trigger perfiles_set_updated_at
  before update on perfiles
  for each row execute function set_updated_at();

-- Alta automática de perfil al crearse un usuario en auth.
-- El script seed-usuarios.ts solo tiene que fijar nombre_completo y cargo después.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre_completo)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre_completo', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper: ¿el usuario actual está autenticado y activo? Se usa en las políticas RLS de lectura.
create or replace function es_usuario_activo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.activo
  );
$$;

-- ----------------------------------------------------------------------------
-- 5. TABLAS DE DOMINIO
-- ----------------------------------------------------------------------------

-- --- clubes ---------------------------------------------------------------
create table clubes (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  pais               text,
  zona_horaria       text,                       -- IANA, p.ej. 'Europe/Brussels'
  fecha_fundacion    date,                       -- [manual] viene del Excel
  escudo_url         text,                       -- path en Storage (bucket público 'escudos')
  origen             origen_dato not null default 'api',
  proveedor_externo  text,
  id_externo         text,
  payload_crudo      jsonb,
  sincronizado_en    timestamptz,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);
comment on column clubes.zona_horaria is 'Nombre IANA de la sede del club. Nunca una sigla ni un offset.';

create trigger clubes_set_updated_at
  before update on clubes for each row execute function set_updated_at();

-- --- competencias -------------------------------------------------------
create table competencias (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  pais               text,
  tipo               tipo_competencia not null,
  codigo             text,                       -- sigla corta para la UI: 'SPL', 'MX', 'LIB'
  id_externo         text,                       -- id de liga en API-Football (GET /leagues)
  cobertura          boolean,                    -- NULL = sin verificar -> la UI muestra "Sin datos", no ceros
  origen             origen_dato not null default 'api',
  proveedor_externo  text,
  payload_crudo      jsonb,
  sincronizado_en    timestamptz,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);
comment on column competencias.cobertura is 'NULL = cobertura de datos sin verificar contra GET /leagues. La UI no debe prometer estadística.';

create trigger competencias_set_updated_at
  before update on competencias for each row execute function set_updated_at();

-- --- jugadores --------------------------------------------------------
create table jugadores (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  apellido           text,
  apodo              text,
  posicion           text,
  dorsal             int,
  nacionalidad       text,
  seleccion          text,                       -- NULL si no es internacional
  club_actual_id     uuid references clubes (id) on delete set null,
  fecha_nacimiento   date,                       -- [manual] Excel
  debut              date,
  fichaje            date,
  instagram          text,
  foto_url           text,                       -- path en Storage (bucket público 'jugadores')
  representante_id   uuid references perfiles (id) on delete set null,  -- informativo, NO controla acceso en Fase 1
  activo             boolean not null default true,
  origen             origen_dato not null default 'api',
  proveedor_externo  text,
  id_externo         text,
  payload_crudo      jsonb,
  sincronizado_en    timestamptz,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);
comment on column jugadores.representante_id is 'Solo informativo en Fase 1. El acceso NO depende de este campo.';

create trigger jugadores_set_updated_at
  before update on jugadores for each row execute function set_updated_at();

-- --- partidos --------------------------------------------------------
create table partidos (
  id                   uuid primary key default gen_random_uuid(),
  competencia_id       uuid references competencias (id) on delete set null,
  club_local_id        uuid references clubes (id) on delete set null,
  club_visitante_id    uuid references clubes (id) on delete set null,
  inicio_utc           timestamptz,               -- instante absoluto del arranque
  zona_horaria_evento  text,                      -- IANA de la sede, p.ej. 'America/Mexico_City'
  estado               estado_partido not null default 'programado',
  ronda                text,
  estadio              text,
  ciudad               text,
  es_local             boolean,                   -- ¿juega de local el club del representado? NULL = sin datos
  marcador_local       int,                       -- NULL = sin datos, JAMÁS 0 por defecto
  marcador_visitante   int,                       -- idem
  tentativo            boolean not null default false,  -- true si inicio_utc está a > 90 días
  origen               origen_dato not null default 'api',
  proveedor_externo    text,
  id_externo           text,
  payload_crudo        jsonb,
  sincronizado_en      timestamptz,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now()
);
comment on column partidos.zona_horaria_evento is 'Nombre IANA de la sede. Resuelve el offset correcto con o sin horario de verano.';
comment on column partidos.marcador_local is 'NULL = sin datos. Nunca 0 por ausencia de dato.';

create trigger partidos_set_updated_at
  before update on partidos for each row execute function set_updated_at();

-- --- partidos_jugadores (puente N:N) ---------------------------------
-- Un partido puede involucrar a más de un representado (ej.: Toluca vs Atlante).
create table partidos_jugadores (
  partido_id      uuid not null references partidos (id) on delete cascade,
  jugador_id      uuid not null references jugadores (id) on delete cascade,
  convocado       boolean,                        -- NULL = sin datos
  con_seleccion   boolean not null default false, -- true si el jugador está con su selección, no con el club
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  primary key (partido_id, jugador_id)
);

create trigger partidos_jugadores_set_updated_at
  before update on partidos_jugadores for each row execute function set_updated_at();

-- --- estadisticas_partido ------------------------------------------
-- TODO NULL-able: si la fuente no lo trae, queda NULL y la UI muestra "Sin datos".
create table estadisticas_partido (
  id                 uuid primary key default gen_random_uuid(),
  partido_id         uuid not null references partidos (id) on delete cascade,
  jugador_id         uuid not null references jugadores (id) on delete cascade,
  minutos            int,
  goles              int,
  asistencias        int,
  amarillas          int,
  rojas              int,
  titular            boolean,
  valoracion         numeric,
  origen             origen_dato not null default 'api',
  proveedor_externo  text,
  payload_crudo      jsonb,
  sincronizado_en    timestamptz,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  unique (partido_id, jugador_id)                 -- clave natural para upsert idempotente
);

create trigger estadisticas_partido_set_updated_at
  before update on estadisticas_partido for each row execute function set_updated_at();

-- --- convocatorias -----------------------------------------------
create table convocatorias (
  id                 uuid primary key default gen_random_uuid(),
  jugador_id         uuid not null references jugadores (id) on delete cascade,
  tipo               tipo_convocatoria not null,
  descripcion        text,
  fecha              date,
  partido_id         uuid references partidos (id) on delete set null,
  origen             origen_dato not null default 'api',
  proveedor_externo  text,
  id_externo         text,
  payload_crudo      jsonb,
  sincronizado_en    timestamptz,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);

create trigger convocatorias_set_updated_at
  before update on convocatorias for each row execute function set_updated_at();

-- --- hitos ------------------------------------------------------
-- API + manual + derivado en una sola tabla. Los manuales empiezan verificado = false.
create table hitos (
  id                 uuid primary key default gen_random_uuid(),
  jugador_id         uuid references jugadores (id) on delete cascade,
  club_id            uuid references clubes (id) on delete cascade,
  tipo               tipo_hito not null,
  titulo             text not null,
  descripcion        text,
  fecha              date,
  fecha_utc          timestamptz,                 -- instante exacto si se conoce (p.ej. hito ligado a un partido)
  origen             origen_dato not null default 'manual',
  verificado         boolean not null default false,
  destacado          boolean not null default false,  -- candidato al hero de la vista partidos
  creado_por         uuid references perfiles (id) on delete set null,
  proveedor_externo  text,
  id_externo         text,
  metadatos          jsonb,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  -- Idempotencia: un mismo hito externo no se duplica. NULLS NOT DISTINCT (PG15+) hace que
  -- dos hitos manuales del mismo tipo para el mismo jugador (id_externo NULL) también choquen.
  constraint hitos_clave_natural
    unique nulls not distinct (jugador_id, tipo, proveedor_externo, id_externo)
);
comment on column hitos.origen is 'Los hitos de las Edge Functions son api/derivado; los que carga el equipo son manual.';

create trigger hitos_set_updated_at
  before update on hitos for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. escalas_hito  (config del motor de hitos — en la demo era el array ESCALAS)
-- ----------------------------------------------------------------------------
create table escalas_hito (
  id               uuid primary key default gen_random_uuid(),
  metrica          metrica_hito not null,
  base             base_hito not null,
  paso             int not null check (paso > 0),   -- cada cuántas unidades hay hito
  aviso            int not null check (aviso >= 0), -- cuántas unidades antes se empieza a mostrar
  plantilla_frase  text not null,                   -- usa {n} como marcador del número objetivo
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (metrica, base)
);

create trigger escalas_hito_set_updated_at
  before update on escalas_hito for each row execute function set_updated_at();

-- Seed: las 5 escalas de la demo (demo-fase1.html -> const ESCALAS).
insert into escalas_hito (metrica, base, paso, aviso, plantilla_frase) values
  ('pj', 'carrera',   50, 5, 'Partido {n}'),
  ('g',  'carrera',   25, 3, 'Gol {n}'),
  ('a',  'carrera',   25, 3, 'Asistencia {n}'),
  ('pj', 'seleccion', 25, 3, 'Partido {n} con la selección'),
  ('g',  'seleccion', 10, 2, 'Gol {n} con la selección');

-- ----------------------------------------------------------------------------
-- 7. sincronizaciones  (bitácora — alimenta el badge "Datos actualizados el {fecha}")
-- ----------------------------------------------------------------------------
create table sincronizaciones (
  id                   uuid primary key default gen_random_uuid(),
  proveedor            text not null,
  recurso              recurso_sync not null,
  iniciado_en          timestamptz not null default now(),
  finalizado_en        timestamptz,
  estado               estado_sync,
  registros_afectados  int,
  error_detalle        text,
  parametros           jsonb
);
comment on table sincronizaciones is 'Una fila por corrida de Edge Function. Si estado = error, los datos previos NO se tocaron.';

-- ----------------------------------------------------------------------------
-- 8. CRM — ESTRUCTURA FASE 2 (no se usa en Fase 1; se crea para no re-migrar después)
-- ----------------------------------------------------------------------------
create type estado_pieza as enum
  ('borrador', 'en_revision', 'cambios_pedidos', 'aprobada', 'publicada', 'archivada');

create table campanas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  descripcion     text,
  creado_por      uuid references perfiles (id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create table piezas (
  id              uuid primary key default gen_random_uuid(),
  campana_id      uuid references campanas (id) on delete cascade,
  jugador_id      uuid references jugadores (id) on delete set null,
  titulo          text not null,
  estado          estado_pieza not null default 'borrador',
  creado_por      uuid references perfiles (id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- Solo metadatos de la imagen. NUNCA binarios en Postgres: la imagen vive en Storage.
create table piezas_versiones (
  id              uuid primary key default gen_random_uuid(),
  pieza_id        uuid not null references piezas (id) on delete cascade,
  imagen_url      text not null,
  ancho           int,
  alto            int,
  peso_bytes      bigint,
  formato         text,
  hash            text,
  creado_por      uuid references perfiles (id) on delete set null,
  creado_en       timestamptz not null default now()
);

create table piezas_comentarios (
  id              uuid primary key default gen_random_uuid(),
  pieza_id        uuid not null references piezas (id) on delete cascade,
  autor_id        uuid references perfiles (id) on delete set null,
  texto           text not null,
  creado_en       timestamptz not null default now()
);

create table piezas_aprobaciones (
  id              uuid primary key default gen_random_uuid(),
  pieza_id        uuid not null references piezas (id) on delete cascade,
  aprobador_id    uuid references perfiles (id) on delete set null,
  estado_destino  estado_pieza not null,
  comentario      text,
  creado_en       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 9. ÍNDICES
-- ----------------------------------------------------------------------------
-- Claves naturales para upsert idempotente (parciales: solo cuando hay id_externo).
create unique index clubes_externo_uidx
  on clubes (proveedor_externo, id_externo) where id_externo is not null;
create unique index jugadores_externo_uidx
  on jugadores (proveedor_externo, id_externo) where id_externo is not null;
create unique index competencias_externo_uidx
  on competencias (id_externo) where id_externo is not null;
create unique index partidos_externo_uidx
  on partidos (proveedor_externo, id_externo) where id_externo is not null;
create unique index convocatorias_externo_uidx
  on convocatorias (proveedor_externo, id_externo) where id_externo is not null;

-- Accesos frecuentes del frontend y de las vistas.
create index partidos_inicio_idx            on partidos (inicio_utc);
create index partidos_competencia_idx       on partidos (competencia_id);
create index partidos_jugadores_jugador_idx on partidos_jugadores (jugador_id);
create index partidos_jugadores_partido_idx on partidos_jugadores (partido_id);
create index estadisticas_jugador_idx       on estadisticas_partido (jugador_id);
create index convocatorias_jugador_idx      on convocatorias (jugador_id);
create index convocatorias_fecha_idx        on convocatorias (fecha);
create index hitos_jugador_idx              on hitos (jugador_id);
create index hitos_fecha_idx               on hitos (fecha);
create index jugadores_club_idx             on jugadores (club_actual_id);

-- ----------------------------------------------------------------------------
-- 10. RLS
-- ----------------------------------------------------------------------------
-- Enable en TODAS las tablas de public. Sin política = sin acceso.
alter table perfiles              enable row level security;
alter table clubes                enable row level security;
alter table competencias          enable row level security;
alter table jugadores             enable row level security;
alter table partidos              enable row level security;
alter table partidos_jugadores    enable row level security;
alter table estadisticas_partido  enable row level security;
alter table convocatorias         enable row level security;
alter table hitos                 enable row level security;
alter table escalas_hito          enable row level security;
alter table sincronizaciones      enable row level security;
alter table campanas              enable row level security;
alter table piezas                enable row level security;
alter table piezas_versiones      enable row level security;
alter table piezas_comentarios    enable row level security;
alter table piezas_aprobaciones   enable row level security;

-- --- perfiles ---
-- Cada quien ve y edita su propia fila. El rol NO se puede cambiar desde el cliente
-- (se compara con el valor anterior). Cambiar rol/correo => solo service_role (admin).
create policy perfiles_select_propio on perfiles
  for select using (id = auth.uid());
create policy perfiles_update_propio on perfiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and rol = (select p.rol from perfiles p where p.id = auth.uid()));

-- --- Lectura de datos deportivos: cualquier usuario autenticado y activo ---
create policy clubes_select              on clubes               for select using (es_usuario_activo());
create policy competencias_select        on competencias         for select using (es_usuario_activo());
create policy jugadores_select           on jugadores            for select using (es_usuario_activo());
create policy partidos_select            on partidos             for select using (es_usuario_activo());
create policy partidos_jugadores_select  on partidos_jugadores   for select using (es_usuario_activo());
create policy estadisticas_select        on estadisticas_partido for select using (es_usuario_activo());
create policy convocatorias_select       on convocatorias        for select using (es_usuario_activo());
create policy hitos_select               on hitos                for select using (es_usuario_activo());
create policy escalas_hito_select        on escalas_hito         for select using (es_usuario_activo());
create policy sincronizaciones_select    on sincronizaciones     for select using (es_usuario_activo());

-- --- Escritura de datos manuales (Fase 1: cualquier usuario autenticado y activo) ---
-- hitos: solo se pueden insertar/editar/borrar los de origen 'manual'.
-- Los de origen api/derivado los maneja solo service_role (no hay política que los habilite).
create policy hitos_insert_manual on hitos
  for insert with check (es_usuario_activo() and origen = 'manual' and creado_por = auth.uid());
create policy hitos_update_manual on hitos
  for update using (es_usuario_activo() and origen = 'manual')
  with check (origen = 'manual');
create policy hitos_delete_manual on hitos
  for delete using (es_usuario_activo() and origen = 'manual');

-- clubes.fecha_fundacion y jugadores.fecha_nacimiento son datos manuales del Excel.
-- En Fase 1 el equipo (6 filas, riesgo bajo) puede corregirlos. INSERT/DELETE quedan
-- para el script de importación (service_role). Fase 2 restringe esto a rol admin.
create policy clubes_update_manual on clubes
  for update using (es_usuario_activo()) with check (true);
create policy jugadores_update_manual on jugadores
  for update using (es_usuario_activo()) with check (true);

-- --- CRM Fase 2: RLS habilitada pero SIN políticas todavía => nadie accede desde el cliente ---
--     Las políticas del flujo diseñador -> community manager se agregan en la migración de Fase 2.

-- ----------------------------------------------------------------------------
-- 11. VISTAS
-- ----------------------------------------------------------------------------

-- --- proximos_partidos -------------------------------------------------
-- La consume el frontend (nombre ya usado en la demo).
-- Una fila por (partido, representado involucrado). El club se resuelve DESDE el jugador:
-- si el jugador cambia de club, sus partidos históricos lo siguen mostrando con su club actual.
-- Expone el instante UTC (para formatear con Luxon) + la hora de pared en Uruguay + el día en
-- Uruguay (para agrupar/filtrar barato). Cero offsets fijos: se usa el nombre IANA.
create view proximos_partidos
with (security_invoker = true) as
select
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
  -- Hora de pared en la sede y en Uruguay. timestamp (sin tz) que representa esa hora local.
  (p.inicio_utc at time zone p.zona_horaria_evento)      as inicio_local_sede,
  (p.inicio_utc at time zone 'America/Montevideo')       as inicio_local_uy,
  (p.inicio_utc at time zone 'America/Montevideo')::date as dia_uy,
  p.estado,
  p.ronda,
  p.estadio,
  p.ciudad,
  p.marcador_local,
  p.marcador_visitante,
  -- Tentativo se recalcula en vivo: el fixture se confirma por semestre.
  (p.inicio_utc is not null and p.inicio_utc > now() + interval '90 days') as tentativo,
  p.sincronizado_en
from partidos p
join partidos_jugadores pj on pj.partido_id = p.id
join jugadores j           on j.id = pj.jugador_id
left join competencias c   on c.id = p.competencia_id
left join clubes cl        on cl.id = j.club_actual_id
-- El rival es el otro club del partido respecto del club actual del jugador.
left join clubes riv on riv.id = case
  when j.club_actual_id = p.club_local_id then p.club_visitante_id
  else p.club_local_id
end;

comment on view proximos_partidos is 'Fuente única de la vista partidos del frontend. Una fila por representado por partido.';

-- --- agenda_anual ----------------------------------------------------
-- UNION ALL de todo lo que ocupa una fecha en el calendario:
--   partidos + convocatorias + hitos con fecha + cumpleaños + aniversarios de club.
-- Los cumpleaños/aniversarios se proyectan sobre una ventana de años [-1, +2] respecto de hoy,
-- para que el calendario funcione al cruzar el cambio de año. Se fija el mediodía de Uruguay
-- para que la conversión a día no se corra.
-- Densidad del calendario (la calcula el frontend):
--   select dia_uy, count(*) from agenda_anual where dia_uy between $1 and $2 group by dia_uy;
create view agenda_anual
with (security_invoker = true) as
-- 1) Partidos (una fila por representado involucrado)
select
  'partido'::text            as fuente,
  p.id                       as ref_id,
  pj.jugador_id,
  j.club_actual_id           as club_id,
  coalesce(cl.nombre, '?') || ' vs ' || coalesce(riv.nombre, '?') as titulo,
  p.inicio_utc               as cuando_utc,
  (p.inicio_utc at time zone 'America/Montevideo')::date as dia_uy,
  c.codigo                   as competencia_codigo,
  (c.tipo in ('continental', 'seleccion')) as es_internacional,
  (p.inicio_utc is not null and p.inicio_utc > now() + interval '90 days') as tentativo
from partidos p
join partidos_jugadores pj on pj.partido_id = p.id
join jugadores j           on j.id = pj.jugador_id
left join competencias c   on c.id = p.competencia_id
left join clubes cl        on cl.id = j.club_actual_id
left join clubes riv on riv.id = case
  when j.club_actual_id = p.club_local_id then p.club_visitante_id
  else p.club_local_id
end
where p.inicio_utc is not null

union all

-- 2) Convocatorias
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
  false
from convocatorias cv
where cv.fecha is not null

union all

-- 3) Hitos con fecha
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
  false
from hitos h
where h.fecha is not null or h.fecha_utc is not null

union all

-- 4) Cumpleaños de jugadores, proyectados a la ventana de años
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
  false
from (
  select
    jg.id, jg.apodo, jg.nombre, jg.club_actual_id as club_id_placeholder,
    (make_date(yr.y, 1, 1) + (jg.fecha_nacimiento - make_date(extract(year from jg.fecha_nacimiento)::int, 1, 1)))::date as proj
  from jugadores jg
  cross join (
    select generate_series(
      extract(year from now())::int - 1,
      extract(year from now())::int + 2
    ) as y
  ) yr
  where jg.fecha_nacimiento is not null
) j

union all

-- 5) Aniversarios de fundación de club, proyectados a la ventana de años
select
  'aniversario_club'::text,
  cb.id,
  null::uuid,
  cb.id,
  'Aniversario de ' || cb.nombre,
  (cb.proj + time '12:00') at time zone 'America/Montevideo',
  cb.proj,
  null::text,
  false,
  false
from (
  select
    cbb.id, cbb.nombre,
    (make_date(yr.y, 1, 1) + (cbb.fecha_fundacion - make_date(extract(year from cbb.fecha_fundacion)::int, 1, 1)))::date as proj
  from clubes cbb
  cross join (
    select generate_series(
      extract(year from now())::int - 1,
      extract(year from now())::int + 2
    ) as y
  ) yr
  where cbb.fecha_fundacion is not null
) cb;

comment on view agenda_anual is 'Todo lo fechado del calendario, unificado. dia_uy ya está en zona de Uruguay.';

-- ----------------------------------------------------------------------------
-- 12. JOBS pg_cron  (PLANTILLAS — activar tras desplegar las Edge Functions)
-- ----------------------------------------------------------------------------
-- pg_cron solo agenda y dispara. pg_net hace el POST. La Edge Function hace el resto.
-- Reemplazar <PROJECT_REF> y usar el secreto del service_role desde Vault, NUNCA en texto plano.
--
-- Guardar el service key una sola vez:
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--
-- Fixture + convocatorias — 1x/día 03:00 UTC
-- select cron.schedule('sync-partidos-diario', '0 3 * * *', $cron$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.functions.supabase.co/sync-partidos',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
--     ),
--     body    := '{}'::jsonb
--   );
-- $cron$);
--
-- Días con partido de un representado — cada 15 min (la Edge Function filtra la ventana ±3 h)
-- select cron.schedule('sync-partidos-ventana', '*/15 * * * *', $cron$
--   select net.http_post(url := 'https://<PROJECT_REF>.functions.supabase.co/sync-partidos',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
--     body := '{"modo":"ventana"}'::jsonb);
-- $cron$);
--
-- Estadísticas — cada 30 min (la Edge Function decide qué partidos ya cerraron hace 2 h / 12 h)
-- select cron.schedule('sync-estadisticas', '*/30 * * * *', $cron$
--   select net.http_post(url := 'https://<PROJECT_REF>.functions.supabase.co/sync-estadisticas',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
--     body := '{}'::jsonb);
-- $cron$);
--
-- Agenda (cumpleaños, fundaciones, hitos derivados) — 1x/día 04:00 UTC
-- select cron.schedule('sync-agenda-diario', '0 4 * * *', $cron$
--   select net.http_post(url := 'https://<PROJECT_REF>.functions.supabase.co/sync-agenda',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
--     body := '{}'::jsonb);
-- $cron$);

commit;
