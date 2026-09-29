# Tickets de diseño — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Admin y CM le encarguen diseños al Diseñador con tickets atados a partidos de Match Day, con estados por color, historial imborrable y avisos automáticos del sistema.

**Architecture:** Dos tablas nuevas (`tickets`, `tickets_historial`) en la migración `0025`. Toda escritura pasa por 7 funciones `security definer` que validan puesto y estado en la base; RLS solo permite leer. Triggers sobre `partidos` escriben avisos del sistema sin poder romper la sync. En el front: lógica pura en `lib/tickets/`, un repositorio de lectura, un panel lateral nuevo (`?panel=ticket`), chips coloreados en el calendario de Match Day, creación desde el panel del partido y un contador en la barra superior.

**Tech Stack:** Postgres 17 (Supabase) + plpgsql, Next.js 14 App Router + TypeScript + React 18, `@supabase/ssr` / `supabase-js`, Luxon, `node --test`, `pg` (tests de base).

**Spec:** `planeacion/specs/2026-09-28-tickets-diseno.md` — leerla entera antes de empezar cualquier tarea.

## Global Constraints

- Idioma: todo identificador, comentario y texto visible **en español** (excepción: `usePanel`, API de React). Voseo rioplatense en la UI ("Escribí", "Pegá", "Recargá").
- Cargos exactos (valores de `perfiles.cargo`): `'Administrador'`, `'Community Manager'`, `'Diseñador'`, `'Prueba'`.
- Estados exactos: `'pendiente' | 'en_revision' | 'aprobado' | 'publicado' | 'cancelado'`.
- Zona de la agencia: `America/Montevideo`. Fechas/horas visibles siempre en hora de Uruguay.
- Fecha límite = `(inicio_utc en America/Montevideo)::date − ticket_dias_anticipacion()` (hoy 2).
- Texto libre (nota, comentario, motivo, corrección): 1–2000 caracteres tras `trim`.
- Links: solo `^https://[^[:space:]]+$`, guardados sin espacios alrededor.
- CSS: **nunca** tocar `styles/demo.css` ni renombrar sus clases; lo nuevo va en `styles/app.css` con los tokens de `styles/tokens.css`. Tema oscuro: `[data-theme="dark"]`.
- Módulos testeados con `node --test` (`lib/**/*.test.ts`): solo pueden importar `luxon` y **tipos** con `@/` (el runner no resuelve `@/` en runtime). Imports relativos en los tests con extensión `.ts`.
- Cabecera de comentario en cada archivo nuevo (qué hace + "Football First. Creado 2026-09-28.").
- **Gerardo tiene `npm run dev` abierto**: prohibido `npm run build` y `next start` (pisan `.next`). Verificación: `npm test`, `npm run lint`, `npx tsc --noEmit -p . 2>&1 | grep -v TS5097` (TS5097 en `*.test.ts` es preexistente), y QA contra `http://localhost:3000`.
- Migraciones: `npm run migracion <archivo>`; si el auto-mode lo bloquea, se detiene la tarea y lo corre Gerardo. Nunca `DELETE` de datos reales.
- Commits con el trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nunca `git push` (lo hace Gerardo).

## Review Focus

1. **Partido sin hora (`inicio_utc` null):** la fecha límite es null; la tarjeta dice "Sin fecha límite" y la lista de pendientes lo pone al final. → tests en Task 1 (vista) y Task 5 (`textoVencimiento`, `pendientesDe`).
2. **Ticket cuyo partido ya no existe (`partido_id` null):** no aparece en el calendario, sí en el contador, y la tarjeta abre igual con "El partido ya no figura en la fuente". → tests en Task 3 (trigger) y Task 5 (`resumirPorPartido` lo ignora).
3. **Link pegado con espacios o con `?dl=0`:** se acepta y se guarda recortado; `http://`/`javascript:` se rechazan. → test en Task 2.
4. **Texto de solo espacios** en devolver/cancelar/comentar/nota → rechazado con mensaje humano. → test en Task 2.
5. **Doble clic en "Crear"/"Entregar"**: el botón queda deshabilitado mientras la acción está en curso (la base admite 2 tickets por partido, así que un doble envío crearía dos). → verificación explícita en el QA de Task 8 y Task 10.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0025_tickets_diseno.sql` | Esquema, vistas, funciones de acción, triggers, RLS (Tasks 1–3) |
| `scripts/tickets.test.mjs` | Tests de base con rollback (Tasks 1–4) |
| `scripts/limpiar-tickets.sql` | Limpieza de tickets de prueba para la entrega (Task 4) |
| `lib/tickets/tipos.ts` | Tipos compartidos del front (Task 5) |
| `lib/tickets/estados.ts` (+test) | Metadatos de estado, más urgente, resumen por partido (Task 5) |
| `lib/tickets/permisos.ts` (+test) | `accionesPermitidas`, `puedeCrear`, `pendientesDe` (Task 5) |
| `lib/tickets/vencimiento.ts` (+test) | `textoVencimiento`, `fechaHoraCortaUy` (Task 5) |
| `lib/tickets/errores.ts` (+test) | Mensaje humano de un error de RPC (Task 6) |
| `lib/tickets/acciones.ts` | Llamadas RPC (Task 6) |
| `lib/repositorios/repositorio-tickets.ts` | Lecturas de `tickets_vista` / `tickets_historial_vista` (Task 6) |
| `lib/tickets/cargar-detalle-ticket.ts` | Bundle del panel del ticket (Task 7) |
| `app/api/paneles/ticket/route.ts` | Endpoint del panel (Task 7) |
| `components/tickets/PastillaEstado.tsx` | Pastilla de estado (Task 7) |
| `components/tickets/PanelTicket.tsx` | Tarjeta del ticket (Task 7) |
| `components/tickets/CrearTicket.tsx` | Crear desde el panel del partido (Task 8) |
| `components/tickets/ContadorTickets.tsx` | Globito + lista "Lo que te toca" (Task 10) |
| Modificados | `lib/paneles/use-panel.ts`, `components/paneles/PanelLateral.tsx`, `components/paneles/PanelPartido.tsx`, `lib/paneles/cargar-detalle-partido.ts`, `components/calendario/Calendario.tsx`, `app/(app)/calendario/page.tsx`, `components/layout/BarraSuperior.tsx`, `app/(app)/layout.tsx`, `styles/app.css`, `package.json`, `lib/supabase/tipos-db.ts` (regenerado) |

---

### Task 1: Migración 0025 — esquema, vistas, inmutabilidad y RLS (+ harness de tests de base)

**Files:**
- Create: `supabase/migrations/0025_tickets_diseno.sql`
- Create: `scripts/tickets.test.mjs`
- Modify: `package.json` (script `test:tickets`)

**Interfaces:**
- Produces (SQL): tipos `estado_ticket`, `tipo_evento_ticket`; función `ticket_dias_anticipacion()`; tablas `tickets`, `tickets_historial`; vistas `perfiles_publicos(id, nombre_completo, cargo)`, `tickets_vista(id, partido_id, jugador_id, jugador_nombre, titulo, nota, estado, link_entrega, creado_por, creado_por_nombre, inicio_utc, estado_partido, partido_eliminado, fecha_limite, creado_en, actualizado_en)`, `tickets_historial_vista(id, ticket_id, tipo, autor_id, autor_nombre, texto, link, estado_desde, estado_hasta, creado_en)`.
- Produces (JS harness, reusado por Tasks 2–4): `enTransaccion(fn)`, `como(c, uid)`, `comoAnon(c)`, `comoDueno(c)`, `debeFallar(c, sql, params, patron)`, `partidoDePrueba(c, jugadorId, inicioIso)`, `ids` (`{ felipe, pedro, maxi, alexis, jugadorMd }`).

- [ ] **Step 1: Escribir el harness y los tests de esta tarea**

`scripts/tickets.test.mjs`:

```js
/**
 * Tests de la migración 0025 (tickets de diseño) contra la base REAL, sin dejar rastro:
 * cada test corre en una transacción que termina en ROLLBACK. Si la 0025 todavía no está
 * aplicada, el propio test la ejecuta dentro de su transacción (sin su begin/commit).
 * Imprescindible porque el historial de tickets es imborrable.
 *
 * Usuarios simulados como en PostgREST: `set local role authenticated` + claims con el `sub`.
 * Conexión `pg` directa (IPv6, ver avances.md §10b).
 *
 * Uso:  npm run test:tickets
 *
 * Football First. Creado 2026-09-28.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

process.loadEnvFile('.secretos/.env');
const require = createRequire(import.meta.url);
const { Client } = require('pg');

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DB_PASSWORD } = process.env;
const ref = new URL(NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const conexion = () =>
  new Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(SUPABASE_DB_PASSWORD)}@db.${ref}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

const MIGRACION = readFileSync(new URL('../supabase/migrations/0025_tickets_diseno.sql', import.meta.url), 'utf8')
  .replace(/^\s*begin;\s*$/m, '')
  .replace(/^\s*commit;\s*$/m, '');

const c = conexion();
let aplicada = false;
export const ids = {};

before(async () => {
  await c.connect();
  const { rows } = await c.query(`select to_regclass('public.tickets') is not null as ok`);
  aplicada = rows[0].ok;
  const usuarios = await c.query(
    `select u.email, u.id from auth.users u where u.email in
      ('felipe@footballfirst.uy','pedro@footballfirst.uy','maxi@footballfirst.uy','alexis@footballfirst.uy')`,
  );
  for (const u of usuarios.rows) ids[u.email.split('@')[0]] = u.id;
  const jug = await c.query(
    `select id from jugadores where activo and servicio_match_day order by nombre limit 1`,
  );
  ids.jugadorMd = jug.rows[0].id;
  assert.ok(ids.felipe && ids.pedro && ids.maxi && ids.alexis && ids.jugadorMd, 'faltan usuarios o jugador');
});

after(async () => {
  await c.end();
});

/** Corre `fn` en una transacción que siempre termina en rollback. */
async function enTransaccion(fn) {
  await c.query('begin');
  try {
    if (!aplicada) await c.query(MIGRACION);
    await fn(c);
  } finally {
    await c.query('rollback');
  }
}

/** Simula al usuario `uid` logueado (como PostgREST). */
async function como(cl, uid) {
  await cl.query('reset role');
  await cl.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: uid, role: 'authenticated' }),
  ]);
  await cl.query('set local role authenticated');
}

async function comoAnon(cl) {
  await cl.query('reset role');
  await cl.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'anon' })]);
  await cl.query('set local role anon');
}

async function comoServicio(cl) {
  await cl.query('reset role');
  await cl.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })]);
  await cl.query('set local role service_role');
}

async function comoDueno(cl) {
  await cl.query('reset role');
  await cl.query(`select set_config('request.jwt.claims', '', true)`);
}

/** Ejecuta `sql` esperando que falle con un mensaje que matchee `patron`; no aborta la transacción. */
async function debeFallar(cl, sql, params, patron) {
  await cl.query('savepoint s');
  try {
    await cl.query(sql, params);
  } catch (e) {
    await cl.query('rollback to savepoint s');
    assert.match(e.message, patron);
    return e;
  }
  await cl.query('rollback to savepoint s');
  assert.fail(`Se esperaba un error ${patron} y la consulta pasó: ${sql}`);
}

/** Partido falso (dentro de la transacción) con el jugador de Match Day. Como dueño. */
async function partidoDePrueba(cl, jugadorId, inicioIso = '2030-06-01T20:00:00Z') {
  await comoDueno(cl);
  const { rows } = await cl.query(
    `insert into partidos (inicio_utc, estado, origen) values ($1, 'programado', 'manual') returning id`,
    [inicioIso],
  );
  await cl.query(`insert into partidos_jugadores (partido_id, jugador_id) values ($1, $2)`, [rows[0].id, jugadorId]);
  return rows[0].id;
}

/** Ticket insertado directo como dueño (solo para fixtures de Task 1). */
async function ticketDirecto(cl, partidoId) {
  await comoDueno(cl);
  const { rows } = await cl.query(
    `insert into tickets (partido_id, jugador_id, titulo, nota, creado_por)
     values ($1, $2, 'Match Day — prueba', 'nota de prueba', $3) returning id`,
    [partidoId, ids.jugadorMd, ids.felipe],
  );
  await cl.query(
    `insert into tickets_historial (ticket_id, tipo, autor_id, texto, estado_hasta)
     values ($1, 'creado', $2, 'nota de prueba', 'pendiente')`,
    [rows[0].id, ids.felipe],
  );
  return rows[0].id;
}

// ═════════════ Task 1: esquema, vistas, inmutabilidad, RLS ═════════════

test('RLS: sin sesión no se lee ninguna tabla ni vista de tickets', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await ticketDirecto(cl, p);
    await comoAnon(cl);
    for (const rel of ['tickets', 'tickets_historial', 'tickets_vista', 'tickets_historial_vista', 'perfiles_publicos']) {
      await cl.query('savepoint s');
      try {
        const { rows } = await cl.query(`select * from ${rel}`);
        assert.equal(rows.length, 0, `${rel} devolvió filas a anon`);
      } catch (e) {
        assert.match(e.message, /permission denied/);
      }
      await cl.query('rollback to savepoint s');
    }
  }));

test('RLS: con sesión activa se leen tickets, historial y las vistas', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    const t = await ticketDirecto(cl, p);
    await como(cl, ids.maxi);
    const { rows } = await cl.query(`select * from tickets_vista where id = $1`, [t]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].creado_por_nombre, 'Felipe Merola');
    const h = await cl.query(`select * from tickets_historial_vista where ticket_id = $1`, [t]);
    assert.equal(h.rows[0].autor_nombre, 'Felipe Merola');
  }));

test('RLS: un usuario logueado no puede insertar, editar ni borrar directo', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    const t = await ticketDirecto(cl, p);
    await como(cl, ids.felipe);
    await debeFallar(
      cl,
      `insert into tickets (partido_id, jugador_id, titulo, nota, creado_por) values ($1,$2,'x','x',$3)`,
      [p, ids.jugadorMd, ids.felipe],
      /permission denied/,
    );
    await debeFallar(cl, `update tickets set estado = 'publicado' where id = $1`, [t], /permission denied/);
    await debeFallar(cl, `delete from tickets where id = $1`, [t], /permission denied/);
    await debeFallar(
      cl,
      `insert into tickets_historial (ticket_id, tipo, autor_id, texto) values ($1,'comentario',$2,'x')`,
      [t, ids.felipe],
      /permission denied/,
    );
  }));

test('Inmutable: el historial no se edita ni se borra, ni como service_role', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    const t = await ticketDirecto(cl, p);
    await comoServicio(cl);
    await debeFallar(cl, `update tickets_historial set texto = 'otro' where ticket_id = $1`, [t], /no se puede editar ni borrar/);
    await debeFallar(cl, `delete from tickets_historial where ticket_id = $1`, [t], /no se puede editar ni borrar/);
    await comoDueno(cl);
    await debeFallar(cl, `delete from tickets_historial where ticket_id = $1`, [t], /no se puede editar ni borrar/);
  }));

test('Inmutable: un ticket no se borra (ni como service_role)', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    const t = await ticketDirecto(cl, p);
    await comoServicio(cl);
    await debeFallar(cl, `delete from tickets where id = $1`, [t], /se cancela/);
  }));

test('perfiles_publicos: con sesión activa, solo id/nombre/cargo de los activos', () =>
  enTransaccion(async (cl) => {
    await como(cl, ids.maxi);
    const { rows, fields } = await cl.query(`select * from perfiles_publicos`);
    assert.deepEqual(fields.map((f) => f.name), ['id', 'nombre_completo', 'cargo']);
    const nombres = rows.map((r) => r.nombre_completo).sort();
    assert.ok(nombres.includes('Felipe Merola') && nombres.includes('Pedro Vidal'));
  }));

test('perfiles_publicos: un perfil inactivo no ve a nadie', () =>
  enTransaccion(async (cl) => {
    await comoDueno(cl);
    await cl.query(`update perfiles set activo = false where id = $1`, [ids.alexis]);
    await como(cl, ids.alexis);
    const { rows } = await cl.query(`select * from perfiles_publicos`);
    assert.equal(rows.length, 0);
  }));

test('Fecha límite: 2 días antes del partido en hora de Uruguay; null sin hora', () =>
  enTransaccion(async (cl) => {
    // 2030-06-02 01:30 UTC = 2030-06-01 22:30 en Montevideo → límite 2030-05-30
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-02T01:30:00Z');
    const t = await ticketDirecto(cl, p);
    const sinHora = await partidoDePrueba(cl, ids.jugadorMd, null);
    const t2 = await ticketDirecto(cl, sinHora);
    await como(cl, ids.maxi);
    const { rows } = await cl.query(
      `select id, to_char(fecha_limite, 'YYYY-MM-DD') as fl from tickets_vista where id in ($1, $2)`,
      [t, t2],
    );
    const porId = Object.fromEntries(rows.map((r) => [r.id, r.fl]));
    assert.equal(porId[t], '2030-05-30');
    assert.equal(porId[t2], null);
  }));

test('Checks: link no https y texto > 2000 rechazados a nivel tabla', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    const t = await ticketDirecto(cl, p);
    await comoDueno(cl);
    await debeFallar(cl, `update tickets set link_entrega = 'http://x.com' where id = $1`, [t], /check constraint/);
    await debeFallar(
      cl,
      `insert into tickets_historial (ticket_id, tipo, autor_id, texto) values ($1, 'comentario', $2, repeat('a', 2001))`,
      [t, ids.felipe],
      /check constraint/,
    );
    await debeFallar(
      cl,
      `insert into tickets_historial (ticket_id, tipo, autor_id, texto) values ($1, 'sistema', $2, 'x')`,
      [t, ids.felipe],
      /check constraint/,
    );
  }));

export { enTransaccion, como, comoAnon, comoServicio, comoDueno, debeFallar, partidoDePrueba };
```

Nota: el `partidoDePrueba(cl, jugador, null)` inserta `inicio_utc` null (el parámetro `null` pisa el default).

`package.json` → en `"scripts"`, después de `"test:seguridad"`:

```json
    "test:tickets": "node --test scripts/tickets.test.mjs",
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm run test:tickets`
Expected: FAIL — `ENOENT … 0025_tickets_diseno.sql` (la migración no existe).

- [ ] **Step 3: Escribir la primera parte de la migración**

`supabase/migrations/0025_tickets_diseno.sql`:

```sql
-- ============================================================================
-- 0025 — Tickets de diseño (Admin / CM → Diseñador). Sesión 12, 2026-09-28.
-- Spec: planeacion/specs/2026-09-28-tickets-diseno.md
-- ============================================================================
-- Aditiva: tipos, 2 tablas, 3 vistas, funciones de acción y triggers. No toca datos
-- existentes. Las tablas de Fase 2 (piezas*, campanas) quedan sin tocar.
--
-- Seguridad:
--  - RLS: solo SELECT para usuarios activos. Nadie escribe directo (se revocan
--    insert/update/delete a anon y authenticated): todo pasa por las funciones ticket_*.
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
revoke insert, update, delete, truncate on tickets, tickets_historial from authenticated;
grant select on tickets, tickets_historial, tickets_vista, tickets_historial_vista, perfiles_publicos to authenticated;

-- (Tasks 2 y 3 agregan acá las funciones de acción y los triggers sobre partidos.)

commit;
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm run test:tickets`
Expected: PASS — 9 tests (`ℹ pass 9`, `ℹ fail 0`). Si falla la conexión con `ETIMEDOUT`: la red no tiene IPv6 (§10b) — detener y avisar; no cambiar a REST.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0025_tickets_diseno.sql scripts/tickets.test.mjs package.json
git commit -m "feat(db): 0025 tickets — esquema, vistas, historial imborrable y RLS (+tests con rollback)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Migración 0025 — las 7 funciones de acción

**Files:**
- Modify: `supabase/migrations/0025_tickets_diseno.sql` (reemplazar la línea `-- (Tasks 2 y 3 agregan acá …)` por el bloque de funciones, dejando la línea de comentario debajo para Task 3)
- Modify: `scripts/tickets.test.mjs` (agregar tests al final, antes del `export`)

**Interfaces:**
- Consumes: harness de Task 1.
- Produces (RPC, llamadas por el front en Task 6):
  - `ticket_crear(p_partido uuid, p_jugador uuid, p_nota text) returns uuid`
  - `ticket_entregar(p_ticket uuid, p_link text, p_texto text default null) returns void`
  - `ticket_aprobar(p_ticket uuid, p_texto text default null) returns void`
  - `ticket_devolver(p_ticket uuid, p_texto text) returns void`
  - `ticket_publicar(p_ticket uuid, p_texto text default null) returns void`
  - `ticket_cancelar(p_ticket uuid, p_texto text) returns void`
  - `ticket_comentar(p_ticket uuid, p_texto text) returns void`
- Mensajes de error (la UI los muestra tal cual): ver el SQL.

- [ ] **Step 1: Agregar los tests (antes de `export { … }` al final del archivo)**

```js
// ═════════════ Task 2: funciones de acción ═════════════

const crear = (cl, p, nota = 'Diseño del Match Day') =>
  cl.query(`select ticket_crear($1, $2, $3) as id`, [p, ids.jugadorMd, nota]).then((r) => r.rows[0].id);
const estadoDe = async (cl, t) => {
  await comoDueno(cl);
  return (await cl.query(`select estado from tickets where id = $1`, [t])).rows[0].estado;
};
const historialDe = async (cl, t) => {
  await comoDueno(cl);
  return (await cl.query(`select tipo, autor_id, texto, link, estado_desde, estado_hasta from tickets_historial where ticket_id = $1 order by id`, [t])).rows;
};

test('Crear: Admin y CM crean; queda pendiente con título armado e historial "creado"', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t1 = await crear(cl, p, '  Previa del partido  ');
    await como(cl, ids.pedro);
    const t2 = await crear(cl, p);
    assert.equal(await estadoDe(cl, t1), 'pendiente');
    const { rows } = await cl.query(`select titulo, nota, creado_por from tickets where id = $1`, [t1]);
    assert.match(rows[0].titulo, /^Match Day — .+ · \? vs \?$/);
    assert.equal(rows[0].nota, 'Previa del partido');
    assert.equal(rows[0].creado_por, ids.felipe);
    const h = await historialDe(cl, t1);
    assert.deepEqual(h.map((x) => [x.tipo, x.estado_hasta]), [['creado', 'pendiente']]);
    assert.ok(t2);
  }));

test('Crear: Diseñador, Prueba e inactivo no pueden', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.maxi);
    await debeFallar(cl, `select ticket_crear($1,$2,'x')`, [p, ids.jugadorMd], /Solo el Administrador o el Community Manager/);
    await como(cl, ids.alexis);
    await debeFallar(cl, `select ticket_crear($1,$2,'x')`, [p, ids.jugadorMd], /Solo el Administrador o el Community Manager/);
    await comoDueno(cl);
    await cl.query(`update perfiles set activo = false where id = $1`, [ids.pedro]);
    await como(cl, ids.pedro);
    await debeFallar(cl, `select ticket_crear($1,$2,'x')`, [p, ids.jugadorMd], /sesión activa/);
  }));

test('Crear: nota vacía o de solo espacios, jugador que no está en el partido → rechazado', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await comoDueno(cl);
    const otro = (await cl.query(`select id from jugadores where id <> $1 and activo limit 1`, [ids.jugadorMd])).rows[0].id;
    await como(cl, ids.felipe);
    await debeFallar(cl, `select ticket_crear($1,$2,'   ')`, [p, ids.jugadorMd], /Escribí qué hay que hacer/);
    await debeFallar(cl, `select ticket_crear($1,$2,repeat('a',2001))`, [p, ids.jugadorMd], /muy largo/);
    await debeFallar(cl, `select ticket_crear($1,$2,'x')`, [p, otro], /no figura en ese partido/);
  }));

test('Ciclo completo: entregar → devolver → entregar → aprobar → publicar', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t = await crear(cl, p);
    await como(cl, ids.maxi);
    await cl.query(`select ticket_entregar($1, $2)`, [t, '  https://www.dropbox.com/s/abc?dl=0  ']);
    assert.equal(await estadoDe(cl, t), 'en_revision');
    await como(cl, ids.felipe);
    await cl.query(`select ticket_devolver($1, 'Cambiá el fondo')`, [t]);
    assert.equal(await estadoDe(cl, t), 'pendiente');
    await como(cl, ids.maxi);
    await cl.query(`select ticket_entregar($1, 'https://www.dropbox.com/s/v2')`, [t]);
    await como(cl, ids.felipe);
    await cl.query(`select ticket_aprobar($1)`, [t]);
    await como(cl, ids.maxi);
    await cl.query(`select ticket_publicar($1)`, [t]);
    assert.equal(await estadoDe(cl, t), 'publicado');
    const h = await historialDe(cl, t);
    assert.deepEqual(h.map((x) => x.tipo), ['creado', 'entrega', 'devuelto', 'entrega', 'aprobado', 'publicado']);
    assert.equal(h[1].link, 'https://www.dropbox.com/s/abc?dl=0');
    assert.equal(h[2].texto, 'Cambiá el fondo');
    const { rows } = await cl.query(`select link_entrega from tickets where id = $1`, [t]);
    assert.equal(rows[0].link_entrega, 'https://www.dropbox.com/s/v2');
  }));

test('Entregar: solo Diseñador, solo desde pendiente, link https obligatorio', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t = await crear(cl, p);
    await debeFallar(cl, `select ticket_entregar($1,'https://x.com/a')`, [t], /Solo el Diseñador/);
    await como(cl, ids.maxi);
    await debeFallar(cl, `select ticket_entregar($1,'http://x.com/a')`, [t], /https:\/\//);
    await debeFallar(cl, `select ticket_entregar($1,'javascript:alert(1)')`, [t], /https:\/\//);
    await debeFallar(cl, `select ticket_entregar($1, null)`, [t], /https:\/\//);
    await cl.query(`select ticket_entregar($1,'https://x.com/a')`, [t]);
    await debeFallar(cl, `select ticket_entregar($1,'https://x.com/b')`, [t], /cambió de estado/);
  }));

test('Revisar: CM no aprueba ni devuelve un ticket de Felipe; Admin sí aprueba uno del CM', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const deFelipe = await crear(cl, p);
    await como(cl, ids.pedro);
    const dePedro = await crear(cl, p);
    await como(cl, ids.maxi);
    await cl.query(`select ticket_entregar($1,'https://x.com/a')`, [deFelipe]);
    await cl.query(`select ticket_entregar($1,'https://x.com/b')`, [dePedro]);
    await debeFallar(cl, `select ticket_aprobar($1)`, [deFelipe], /Solo quien creó el ticket o el Administrador/);
    await como(cl, ids.pedro);
    await debeFallar(cl, `select ticket_aprobar($1)`, [deFelipe], /Solo quien creó el ticket o el Administrador/);
    await debeFallar(cl, `select ticket_devolver($1,'x')`, [deFelipe], /Solo quien creó el ticket o el Administrador/);
    await como(cl, ids.felipe);
    await cl.query(`select ticket_aprobar($1)`, [dePedro]);
    assert.equal(await estadoDe(cl, dePedro), 'aprobado');
  }));

test('Saltos inválidos: pendiente → aprobado/publicado; aprobar dos veces', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t = await crear(cl, p);
    await debeFallar(cl, `select ticket_aprobar($1)`, [t], /cambió de estado/);
    await como(cl, ids.maxi);
    await debeFallar(cl, `select ticket_publicar($1)`, [t], /cambió de estado/);
    await cl.query(`select ticket_entregar($1,'https://x.com/a')`, [t]);
    await como(cl, ids.felipe);
    await cl.query(`select ticket_aprobar($1)`, [t]);
    await debeFallar(cl, `select ticket_aprobar($1)`, [t], /cambió de estado/);
  }));

test('Devolver/cancelar exigen texto (no solo espacios)', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t = await crear(cl, p);
    await debeFallar(cl, `select ticket_cancelar($1,'   ')`, [t], /por qué se cancela/);
    await como(cl, ids.maxi);
    await cl.query(`select ticket_entregar($1,'https://x.com/a')`, [t]);
    await como(cl, ids.felipe);
    await debeFallar(cl, `select ticket_devolver($1,'  ')`, [t], /qué hay que corregir/);
  }));

test('Cancelar: creador o Admin, solo desde pendiente; el Diseñador no', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.pedro);
    const t = await crear(cl, p);
    await como(cl, ids.maxi);
    await debeFallar(cl, `select ticket_cancelar($1,'error')`, [t], /Solo quien creó el ticket o el Administrador/);
    await como(cl, ids.felipe);
    await cl.query(`select ticket_cancelar($1,'Creado por error')`, [t]);
    assert.equal(await estadoDe(cl, t), 'cancelado');
    await debeFallar(cl, `select ticket_cancelar($1,'otra vez')`, [t], /cambió de estado/);
  }));

test('Comentar: los 3 cargos sí (en cualquier estado); Prueba no; texto vacío no', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t = await crear(cl, p);
    for (const uid of [ids.felipe, ids.pedro, ids.maxi]) {
      await como(cl, uid);
      await cl.query(`select ticket_comentar($1,'hola')`, [t]);
    }
    await como(cl, ids.alexis);
    await debeFallar(cl, `select ticket_comentar($1,'hola')`, [t], /No tenés permiso/);
    await como(cl, ids.maxi);
    await debeFallar(cl, `select ticket_comentar($1,'  ')`, [t], /Escribí un comentario/);
    const h = await historialDe(cl, t);
    assert.equal(h.filter((x) => x.tipo === 'comentario').length, 3);
  }));

test('Prueba (Alexis) no ejecuta ninguna acción', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t = await crear(cl, p);
    await como(cl, ids.alexis);
    await debeFallar(cl, `select ticket_entregar($1,'https://x.com/a')`, [t], /Solo el Diseñador/);
    await debeFallar(cl, `select ticket_cancelar($1,'x')`, [t], /Solo quien creó el ticket o el Administrador/);
  }));

test('anon no puede ejecutar las funciones', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await comoAnon(cl);
    await debeFallar(cl, `select ticket_crear($1,$2,'x')`, [p, ids.jugadorMd], /permission denied/);
  }));
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm run test:tickets`
Expected: FAIL en los tests de Task 2 con `function ticket_crear(…) does not exist`; los 9 de Task 1 siguen en PASS.

- [ ] **Step 3: Agregar las funciones a la migración**

En `0025_tickets_diseno.sql`, reemplazar la línea `-- (Tasks 2 y 3 agregan acá las funciones de acción y los triggers sobre partidos.)` por:

```sql
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
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npm run test:tickets`
Expected: PASS — 21 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0025_tickets_diseno.sql scripts/tickets.test.mjs
git commit -m "feat(db): 0025 tickets — 7 funciones de acción con permisos por puesto y estado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Migración 0025 — avisos del sistema sobre `partidos`

**Files:**
- Modify: `supabase/migrations/0025_tickets_diseno.sql` (reemplazar `-- (Task 3 agrega acá los triggers de avisos sobre partidos.)`)
- Modify: `scripts/tickets.test.mjs`

**Interfaces:**
- Consumes: `ticket_crear` (Task 2), harness (Task 1).
- Produces: triggers `tickets_aviso_partido_actualizado` (after update) y `tickets_aviso_partido_borrado` (before delete) sobre `partidos`; helpers `ticket__fecha_hora_uy(timestamptz) → text` ("sáb 4/10 20:00") y `ticket__fecha_uy(date) → text` ("vie 3/10").

- [ ] **Step 1: Agregar los tests**

```js
// ═════════════ Task 3: avisos del sistema ═════════════

const avisos = async (cl, t) => {
  await comoDueno(cl);
  return (await cl.query(`select texto from tickets_historial where ticket_id = $1 and tipo = 'sistema' order by id`, [t])).rows.map((r) => r.texto);
};
async function ticketEn(cl, p) {
  await como(cl, ids.felipe);
  return crear(cl, p);
}

test('Aviso: reprogramación ≥ 1 min → texto con antes/ahora y nueva fecha límite', () =>
  enTransaccion(async (cl) => {
    // 2030-06-01 23:00 UTC = sáb 1/6 20:00 UY
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-01T23:00:00Z');
    const t = await ticketEn(cl, p);
    await comoDueno(cl);
    await cl.query(`update partidos set inicio_utc = '2030-06-02T21:00:00Z' where id = $1`, [p]);
    assert.deepEqual(await avisos(cl, t), [
      'El partido se reprogramó: antes sáb 1/6 20:00, ahora dom 2/6 18:00 (hora Uruguay). Nueva fecha límite: vie 31/5.',
    ]);
    const { rows } = await cl.query(`select inicio_utc_conocido from tickets where id = $1`, [t]);
    assert.equal(rows[0].inicio_utc_conocido.toISOString(), '2030-06-02T21:00:00.000Z');
  }));

test('Aviso: cambio < 1 min → ningún aviso', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-01T23:00:00Z');
    const t = await ticketEn(cl, p);
    await comoDueno(cl);
    await cl.query(`update partidos set inicio_utc = '2030-06-01T23:00:30Z' where id = $1`, [p]);
    assert.deepEqual(await avisos(cl, t), []);
  }));

test('Aviso: reprogramado a una fecha cuya fecha límite ya pasó → advertencia', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-01T23:00:00Z');
    const t = await ticketEn(cl, p);
    await comoDueno(cl);
    await cl.query(`update partidos set inicio_utc = now() + interval '1 day' where id = $1`, [p]);
    const [texto] = await avisos(cl, t);
    assert.match(texto, /⚠️ La nueva fecha límite ya pasó\.$/);
  }));

test('Aviso: hora confirmada (antes sin hora)', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd, null);
    const t = await ticketEn(cl, p);
    await comoDueno(cl);
    await cl.query(`update partidos set inicio_utc = '2030-06-01T23:00:00Z' where id = $1`, [p]);
    assert.deepEqual(await avisos(cl, t), ['Hora confirmada: sáb 1/6 20:00 (hora Uruguay). Fecha límite: jue 30/5.']);
  }));

test('Aviso: suspendido y vuelta a programado; finalizado no avisa', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-01T23:00:00Z');
    const t = await ticketEn(cl, p);
    await comoDueno(cl);
    await cl.query(`update partidos set estado = 'suspendido' where id = $1`, [p]);
    await cl.query(`update partidos set estado = 'programado' where id = $1`, [p]);
    await cl.query(`update partidos set estado = 'finalizado' where id = $1`, [p]);
    assert.deepEqual(await avisos(cl, t), [
      'El partido figura como suspendido en la fuente.',
      'El partido vuelve a figurar como programado para sáb 1/6 20:00 (hora Uruguay).',
    ]);
  }));

test('Aviso: tickets publicados o cancelados no reciben avisos', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-01T23:00:00Z');
    const t = await ticketEn(cl, p);
    await cl.query(`select ticket_cancelar($1, 'no va')`, [t]);
    await comoDueno(cl);
    await cl.query(`update partidos set estado = 'suspendido' where id = $1`, [p]);
    assert.deepEqual(await avisos(cl, t), []);
  }));

test('Partido borrado: el ticket vive, queda sin partido, conserva la fecha y avisa', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-01T23:00:00Z');
    const t = await ticketEn(cl, p);
    await comoDueno(cl);
    await cl.query(`delete from partidos where id = $1`, [p]);
    const { rows } = await cl.query(`select partido_id, inicio_utc_conocido from tickets where id = $1`, [t]);
    assert.equal(rows[0].partido_id, null);
    assert.equal(rows[0].inicio_utc_conocido.toISOString(), '2030-06-01T23:00:00.000Z');
    assert.deepEqual(await avisos(cl, t), ['El partido ya no figura en la fuente de datos. El ticket se conserva.']);
    await como(cl, ids.maxi);
    const v = await cl.query(`select partido_eliminado, to_char(fecha_limite,'YYYY-MM-DD') fl from tickets_vista where id = $1`, [t]);
    assert.deepEqual(v.rows[0], { partido_eliminado: true, fl: '2030-05-30' });
  }));

test('Un error dentro del aviso NO frena el update del partido', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-01T23:00:00Z');
    const t = await ticketEn(cl, p);
    await comoDueno(cl);
    await cl.query(`create or replace function ticket__fecha_hora_uy(p timestamptz) returns text
                    language plpgsql as $$ begin raise exception 'roto a propósito'; end $$`);
    await cl.query(`update partidos set inicio_utc = '2030-06-05T23:00:00Z' where id = $1`, [p]);
    const { rows } = await cl.query(`select inicio_utc from partidos where id = $1`, [p]);
    assert.equal(rows[0].inicio_utc.toISOString(), '2030-06-05T23:00:00.000Z');
    assert.deepEqual(await avisos(cl, t), []);
  }));
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npm run test:tickets`
Expected: FAIL en los 8 tests nuevos (sin avisos: arrays vacíos / `inicio_utc_conocido` null); 21 previos en PASS.

- [ ] **Step 3: Agregar los triggers**

Reemplazar `-- (Task 3 agrega acá los triggers de avisos sobre partidos.)` por:

```sql
-- ─── 8. Avisos del sistema (triggers sobre partidos) ────────────────────────
-- REGLA DURA: un aviso nunca rompe la sincronización. Estos triggers corren dentro de las
-- Edge Functions que escriben `partidos`: todo el cuerpo va en un bloque con EXCEPTION que
-- deja un WARNING y devuelve la fila. Días de la semana con array propio (no lc_time).

create or replace function ticket__fecha_hora_uy(p timestamptz)
returns text language sql stable set search_path = public as $$
  select (array['dom','lun','mar','mié','jue','vie','sáb'])
           [extract(dow from p at time zone 'America/Montevideo')::int + 1]
         || ' ' || to_char(p at time zone 'America/Montevideo', 'FMDD/FMMM HH24:MI')
$$;

create or replace function ticket__fecha_uy(p date)
returns text language sql immutable as $$
  select (array['dom','lun','mar','mié','jue','vie','sáb'])[extract(dow from p)::int + 1]
         || ' ' || to_char(p, 'FMDD/FMMM')
$$;

create or replace function tickets_aviso_partido_actualizado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_texto  text;
  v_limite date;
begin
  begin
    if new.inicio_utc is distinct from old.inicio_utc and new.inicio_utc is not null then
      v_limite := (new.inicio_utc at time zone 'America/Montevideo')::date - ticket_dias_anticipacion();
      if old.inicio_utc is null then
        v_texto := 'Hora confirmada: ' || ticket__fecha_hora_uy(new.inicio_utc)
                   || ' (hora Uruguay). Fecha límite: ' || ticket__fecha_uy(v_limite) || '.';
      elsif abs(extract(epoch from new.inicio_utc - old.inicio_utc)) >= 60 then
        v_texto := 'El partido se reprogramó: antes ' || ticket__fecha_hora_uy(old.inicio_utc)
                   || ', ahora ' || ticket__fecha_hora_uy(new.inicio_utc)
                   || ' (hora Uruguay). Nueva fecha límite: ' || ticket__fecha_uy(v_limite) || '.';
        if v_limite < (now() at time zone 'America/Montevideo')::date then
          v_texto := v_texto || ' ⚠️ La nueva fecha límite ya pasó.';
        end if;
      end if;

      update tickets set inicio_utc_conocido = new.inicio_utc where partido_id = new.id;

      if v_texto is not null then
        insert into tickets_historial (ticket_id, tipo, texto)
        select t.id, 'sistema', v_texto
        from tickets t
        where t.partido_id = new.id and t.estado not in ('publicado', 'cancelado');
      end if;
    end if;

    if new.estado is distinct from old.estado then
      v_texto := null;
      if new.estado = 'suspendido' then
        v_texto := 'El partido figura como suspendido en la fuente.';
      elsif old.estado = 'suspendido' and new.estado = 'programado' then
        v_texto := 'El partido vuelve a figurar como programado'
                   || coalesce(' para ' || ticket__fecha_hora_uy(new.inicio_utc) || ' (hora Uruguay)', '')
                   || '.';
      end if;
      if v_texto is not null then
        insert into tickets_historial (ticket_id, tipo, texto)
        select t.id, 'sistema', v_texto
        from tickets t
        where t.partido_id = new.id and t.estado not in ('publicado', 'cancelado');
      end if;
    end if;
  exception when others then
    raise warning 'tickets: no se pudo registrar el aviso del partido % (%)', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create trigger tickets_aviso_partido_actualizado
  after update of inicio_utc, estado on partidos
  for each row
  when (old.inicio_utc is distinct from new.inicio_utc or old.estado is distinct from new.estado)
  execute function tickets_aviso_partido_actualizado();

create or replace function tickets_aviso_partido_borrado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    update tickets
       set inicio_utc_conocido = coalesce(old.inicio_utc, inicio_utc_conocido)
     where partido_id = old.id;
    insert into tickets_historial (ticket_id, tipo, texto)
    select t.id, 'sistema', 'El partido ya no figura en la fuente de datos. El ticket se conserva.'
    from tickets t
    where t.partido_id = old.id and t.estado not in ('publicado', 'cancelado');
  exception when others then
    raise warning 'tickets: no se pudo registrar el borrado del partido % (%)', old.id, sqlerrm;
  end;
  return old;
end;
$$;

create trigger tickets_aviso_partido_borrado
  before delete on partidos
  for each row execute function tickets_aviso_partido_borrado();

revoke execute on function
  ticket__fecha_hora_uy(timestamptz), ticket__fecha_uy(date),
  tickets_aviso_partido_actualizado(), tickets_aviso_partido_borrado()
  from public, anon, authenticated;
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npm run test:tickets`
Expected: PASS — 29 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0025_tickets_diseno.sql scripts/tickets.test.mjs
git commit -m "feat(db): 0025 tickets — avisos del sistema al reprogramar/suspender/borrar partidos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Aplicar la 0025, regenerar tipos, test de concurrencia y script de limpieza

> **Esta tarea la ejecuta el controlador (no un subagente)**: aplica una migración a
> producción y puede necesitar a Gerardo.

**Files:**
- Modify: `lib/supabase/tipos-db.ts` (regenerado)
- Modify: `scripts/tickets.test.mjs` (test de concurrencia)
- Create: `scripts/limpiar-tickets.sql`

**Interfaces:**
- Produces: tipos generados con `Tables['tickets']`, `Views['tickets_vista']`, `Views['tickets_historial_vista']`, `Functions['ticket_crear']`… que usan las Tasks 6–10.

- [ ] **Step 1: Aplicar la migración**

Run: `npm run migracion supabase/migrations/0025_tickets_diseno.sql`
Expected: `✅ Migración aplicada sin errores.` Si el auto-mode lo bloquea: detenerse, pedirle a Gerardo que corra ese mismo comando (o pegue el `.sql` en el SQL Editor), y anotar en `avances.md` §10b si es un bloqueo nuevo.

- [ ] **Step 2: Correr la suite con la migración aplicada**

Run: `npm run test:tickets`
Expected: PASS — 29 tests (ahora `aplicada = true`: no se re-ejecuta la migración).

- [ ] **Step 3: Regenerar tipos**

Run: `npm run tipos:db`
Expected: `lib/supabase/tipos-db.ts` contiene `tickets_vista` y `ticket_crear`. Verificar: `grep -c "tickets_vista\|ticket_crear" lib/supabase/tipos-db.ts` ≥ 2.

- [ ] **Step 4: Agregar el test de concurrencia (antes del `export`)**

```js
// ═════════════ Task 4: concurrencia (necesita la 0025 aplicada) ═════════════
// Usa datos COMMITEADOS (dos conexiones no ven lo no commiteado de la otra) sobre un
// partido falso en el año 2000 (no aparece en "próximos"), y los borra al final como
// dueño deshabilitando los triggers de inmutabilidad (igual que limpiar-tickets.sql).

test('Concurrencia: aprobar y devolver a la vez → gana uno solo', async () => {
  // Necesita la 0025 aplicada (datos commiteados). Si no lo está, no hay nada que probar.
  if (!aplicada) return;
  const a = conexion();
  const b = conexion();
  await a.connect();
  await b.connect();
  let partido;
  let ticket;
  try {
    const r = await c.query(
      `insert into partidos (inicio_utc, estado, origen) values ('2000-01-01T20:00:00Z','programado','manual') returning id`,
    );
    partido = r.rows[0].id;
    await c.query(`insert into partidos_jugadores (partido_id, jugador_id) values ($1,$2)`, [partido, ids.jugadorMd]);
    await c.query('begin');
    await como(c, ids.felipe);
    ticket = (await c.query(`select ticket_crear($1,$2,'concurrencia') id`, [partido, ids.jugadorMd])).rows[0].id;
    await como(c, ids.maxi);
    await c.query(`select ticket_entregar($1,'https://x.com/c')`, [ticket]);
    await c.query('commit');
    await c.query('reset role');

    await a.query('begin');
    await como(a, ids.felipe);
    await a.query(`select ticket_aprobar($1)`, [ticket]); // toma el lock
    await b.query('begin');
    await como(b, ids.felipe);
    const devolver = b.query(`select ticket_devolver($1,'tarde')`, [ticket]).then(
      () => null,
      (e) => e,
    );
    await new Promise((res) => setTimeout(res, 500)); // b queda esperando el lock
    await a.query('commit');
    const error = await devolver;
    await b.query('rollback');
    assert.ok(error, 'la segunda acción debería fallar');
    assert.match(error.message, /cambió de estado/);
    const { rows } = await c.query(`select estado from tickets where id = $1`, [ticket]);
    assert.equal(rows[0].estado, 'aprobado');
  } finally {
    await c.query('rollback').catch(() => {});
    await c.query('reset role');
    await c.query('begin');
    await c.query('alter table tickets_historial disable trigger tickets_historial_inmutable');
    await c.query('alter table tickets disable trigger tickets_sin_borrado');
    if (ticket) {
      await c.query('delete from tickets_historial where ticket_id = $1', [ticket]);
      await c.query('delete from tickets where id = $1', [ticket]);
    }
    if (partido) await c.query('delete from partidos where id = $1', [partido]);
    await c.query('alter table tickets_historial enable trigger tickets_historial_inmutable');
    await c.query('alter table tickets enable trigger tickets_sin_borrado');
    await c.query('commit');
    await a.end();
    await b.end();
  }
});
```

- [ ] **Step 5: Correr y verificar**

Run: `npm run test:tickets`
Expected: PASS — 30 tests. Luego verificar que no quedó basura:
Run: `node -e "process.loadEnvFile('.secretos/.env');const {createClient}=require('@supabase/supabase-js');const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});a.from('tickets').select('id',{count:'exact',head:true}).then(r=>console.log('tickets',r.count))"`
Expected: `tickets 0`.

- [ ] **Step 6: Script de limpieza para la entrega**

`scripts/limpiar-tickets.sql`:

```sql
-- ============================================================================
-- Limpieza de TODOS los tickets (para la entrega: borra los de prueba/QA).
-- Lo corre Gerardo en el SQL Editor de Supabase (dueño de la base: es el único que puede
-- deshabilitar los triggers de inmutabilidad). Junto con:
--   npm run seed:usuarios -- --reset-clave
-- Todo en una transacción: si algo falla, no se borra nada.
-- Football First. Creado 2026-09-28.
-- ============================================================================
begin;
select 'antes' as momento, (select count(*) from tickets) as tickets, (select count(*) from tickets_historial) as historial;

alter table tickets_historial disable trigger tickets_historial_inmutable;
alter table tickets disable trigger tickets_sin_borrado;

delete from tickets_historial;
delete from tickets;

alter table tickets_historial enable trigger tickets_historial_inmutable;
alter table tickets enable trigger tickets_sin_borrado;

select 'después' as momento, (select count(*) from tickets) as tickets, (select count(*) from tickets_historial) as historial;
commit;
```

- [ ] **Step 7: Commit**

```bash
git add lib/supabase/tipos-db.ts scripts/tickets.test.mjs scripts/limpiar-tickets.sql
git commit -m "feat(db): 0025 aplicada — tipos regenerados, test de concurrencia y limpieza de entrega

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Lógica pura del front (`lib/tickets/`)

**Files:**
- Create: `lib/tickets/tipos.ts`, `lib/tickets/estados.ts`, `lib/tickets/permisos.ts`, `lib/tickets/vencimiento.ts`
- Test: `lib/tickets/estados.test.ts`, `lib/tickets/permisos.test.ts`, `lib/tickets/vencimiento.test.ts`

**Interfaces:**
- Produces:
  - `tipos.ts`: `EstadoTicket`, `Cargo`, `Accion`, `ResumenTicket`, `DetalleTicket`, `EventoHistorial`, `TipoEventoTicket`.
  - `estados.ts`: `META_ESTADO: Record<EstadoTicket, { etiqueta: string; corta: string; simbolo: string }>`, `estadoMasUrgente(estados: EstadoTicket[]): EstadoTicket | null`, `resumirPorPartido(tickets: ResumenTicket[]): Record<string, ResumenPartido>` con `ResumenPartido = { estado: EstadoTicket; ticketIds: string[] }`.
  - `permisos.ts`: `puedeCrear(cargo: string): boolean`, `accionesPermitidas(p: { cargo: string; esCreador: boolean; estado: EstadoTicket }): Accion[]`, `pendientesDe(cargo: string, usuarioId: string, tickets: ResumenTicket[]): ResumenTicket[]`.
  - `vencimiento.ts`: `textoVencimiento(fechaLimite: string | null, estado: EstadoTicket, hoyUy: string): { texto: string; vencido: boolean } | null`, `fechaCortaUy(dia: string): string` ("vie 2/10"), `fechaHoraCortaUy(iso: string): string` ("sáb 4/10 20:15").

- [ ] **Step 1: Escribir los tests**

`lib/tickets/estados.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoMasUrgente, resumirPorPartido, META_ESTADO } from './estados.ts';
import type { ResumenTicket } from './tipos.ts';

const t = (id: string, partidoId: string | null, estado: ResumenTicket['estado']): ResumenTicket => ({
  id,
  partidoId,
  jugadorId: 'j',
  jugadorNombre: 'Nández',
  titulo: `Ticket ${id}`,
  estado,
  creadoPor: 'u',
  creadoPorNombre: 'Felipe',
  inicioUtc: null,
  fechaLimite: null,
  partidoEliminado: partidoId === null,
});

test('estadoMasUrgente: pendiente > en_revision > aprobado > publicado; cancelado no cuenta', () => {
  assert.equal(estadoMasUrgente(['publicado', 'en_revision', 'aprobado']), 'en_revision');
  assert.equal(estadoMasUrgente(['aprobado', 'pendiente']), 'pendiente');
  assert.equal(estadoMasUrgente(['publicado']), 'publicado');
  assert.equal(estadoMasUrgente(['cancelado']), null);
  assert.equal(estadoMasUrgente([]), null);
});

test('resumirPorPartido: agrupa por partido, ignora cancelados y tickets sin partido', () => {
  const r = resumirPorPartido([
    t('1', 'p1', 'publicado'),
    t('2', 'p1', 'pendiente'),
    t('3', 'p2', 'cancelado'),
    t('4', null, 'pendiente'),
    t('5', 'p3', 'aprobado'),
  ]);
  assert.deepEqual(r, {
    p1: { estado: 'pendiente', ticketIds: ['1', '2'] },
    p3: { estado: 'aprobado', ticketIds: ['5'] },
  });
});

test('META_ESTADO: cada estado tiene etiqueta, versión corta y símbolo (no solo color)', () => {
  for (const m of Object.values(META_ESTADO)) {
    assert.ok(m.etiqueta && m.corta && m.simbolo);
  }
});
```

`lib/tickets/permisos.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accionesPermitidas, pendientesDe, puedeCrear } from './permisos.ts';
import type { ResumenTicket } from './tipos.ts';

test('puedeCrear: solo Administrador y Community Manager', () => {
  assert.equal(puedeCrear('Administrador'), true);
  assert.equal(puedeCrear('Community Manager'), true);
  assert.equal(puedeCrear('Diseñador'), false);
  assert.equal(puedeCrear('Prueba'), false);
});

test('Diseñador: entregar en pendiente, publicar en aprobado, siempre comentar', () => {
  const d = (estado: ResumenTicket['estado']) => accionesPermitidas({ cargo: 'Diseñador', esCreador: false, estado });
  assert.deepEqual(d('pendiente'), ['entregar', 'comentar']);
  assert.deepEqual(d('en_revision'), ['comentar']);
  assert.deepEqual(d('aprobado'), ['publicar', 'comentar']);
  assert.deepEqual(d('publicado'), ['comentar']);
});

test('Revisor: creador CM o cualquier Admin aprueba/devuelve en revisión y cancela en pendiente', () => {
  assert.deepEqual(
    accionesPermitidas({ cargo: 'Community Manager', esCreador: true, estado: 'en_revision' }),
    ['aprobar', 'devolver', 'comentar'],
  );
  assert.deepEqual(
    accionesPermitidas({ cargo: 'Administrador', esCreador: false, estado: 'pendiente' }),
    ['cancelar', 'comentar'],
  );
  assert.deepEqual(
    accionesPermitidas({ cargo: 'Community Manager', esCreador: false, estado: 'en_revision' }),
    ['comentar'],
  );
});

test('Prueba: ninguna acción', () => {
  assert.deepEqual(accionesPermitidas({ cargo: 'Prueba', esCreador: false, estado: 'pendiente' }), []);
});

const r = (id: string, estado: ResumenTicket['estado'], creadoPor: string, fechaLimite: string | null): ResumenTicket => ({
  id, partidoId: 'p', jugadorId: 'j', jugadorNombre: 'N', titulo: id, estado, creadoPor,
  creadoPorNombre: null, inicioUtc: null, fechaLimite, partidoEliminado: false,
});

test('pendientesDe: qué le toca a cada cargo, ordenado por fecha límite (sin fecha al final)', () => {
  const lista = [
    r('a', 'pendiente', 'felipe', '2026-10-05'),
    r('b', 'en_revision', 'pedro', '2026-10-01'),
    r('c', 'aprobado', 'felipe', null),
    r('d', 'en_revision', 'felipe', '2026-09-30'),
    r('e', 'pendiente', 'pedro', '2026-09-29'),
    r('f', 'publicado', 'felipe', '2026-09-20'),
  ];
  assert.deepEqual(pendientesDe('Diseñador', 'maxi', lista).map((x) => x.id), ['e', 'a', 'c']);
  assert.deepEqual(pendientesDe('Community Manager', 'pedro', lista).map((x) => x.id), ['b']);
  assert.deepEqual(pendientesDe('Administrador', 'felipe', lista).map((x) => x.id), ['d', 'b']);
  assert.deepEqual(pendientesDe('Prueba', 'alexis', lista), []);
});
```

`lib/tickets/vencimiento.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fechaCortaUy, fechaHoraCortaUy, textoVencimiento } from './vencimiento.ts';

const HOY = '2026-09-28'; // lunes

test('textoVencimiento: futuro, mañana, hoy, vencido', () => {
  assert.deepEqual(textoVencimiento('2026-10-02', 'pendiente', HOY), { texto: 'Vence en 4 días · vie 2/10', vencido: false });
  assert.deepEqual(textoVencimiento('2026-09-29', 'en_revision', HOY), { texto: 'Vence mañana · mar 29/9', vencido: false });
  assert.deepEqual(textoVencimiento('2026-09-28', 'pendiente', HOY), { texto: 'Vence hoy', vencido: false });
  assert.deepEqual(textoVencimiento('2026-09-27', 'pendiente', HOY), { texto: 'Vencido hace 1 día · dom 27/9', vencido: true });
  assert.deepEqual(textoVencimiento('2026-09-25', 'pendiente', HOY), { texto: 'Vencido hace 3 días · vie 25/9', vencido: true });
});

test('textoVencimiento: sin fecha → "Sin fecha límite"; aprobado/publicado/cancelado → null', () => {
  assert.deepEqual(textoVencimiento(null, 'pendiente', HOY), { texto: 'Sin fecha límite', vencido: false });
  assert.equal(textoVencimiento('2026-09-20', 'aprobado', HOY), null);
  assert.equal(textoVencimiento('2026-09-20', 'publicado', HOY), null);
  assert.equal(textoVencimiento('2026-09-20', 'cancelado', HOY), null);
});

test('fechas cortas en hora de Uruguay', () => {
  assert.equal(fechaCortaUy('2026-10-02'), 'vie 2/10');
  // 2026-10-03 23:15 UTC = sáb 3/10 20:15 en Montevideo
  assert.equal(fechaHoraCortaUy('2026-10-03T23:15:00Z'), 'sáb 3/10 20:15');
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `node --test lib/tickets/*.test.ts`
Expected: FAIL — `Cannot find module './estados.ts'` (y los otros).

- [ ] **Step 3: Implementar**

`lib/tickets/tipos.ts`:

```ts
/**
 * Tipos del front para los tickets de diseño (ver planeacion/specs/2026-09-28-tickets-diseno.md).
 * Espejo de `tickets_vista` / `tickets_historial_vista` (migración 0025), en camelCase.
 *
 * Football First. Creado 2026-09-28.
 */

export type EstadoTicket = 'pendiente' | 'en_revision' | 'aprobado' | 'publicado' | 'cancelado';

export type TipoEventoTicket =
  | 'creado' | 'comentario' | 'entrega' | 'aprobado' | 'devuelto' | 'publicado' | 'cancelado' | 'sistema';

/** Valores de `perfiles.cargo`. */
export type Cargo = 'Administrador' | 'Community Manager' | 'Diseñador' | 'Prueba';

export type Accion = 'entregar' | 'aprobar' | 'devolver' | 'publicar' | 'cancelar' | 'comentar';

/** Lo que necesitan el calendario, el contador y la pastilla del panel del partido. */
export interface ResumenTicket {
  id: string;
  partidoId: string | null;
  jugadorId: string;
  jugadorNombre: string;
  titulo: string;
  estado: EstadoTicket;
  creadoPor: string;
  creadoPorNombre: string | null;
  /** ISO UTC del partido (o la última fecha conocida si el partido desapareció). */
  inicioUtc: string | null;
  /** YYYY-MM-DD (hora de Uruguay). */
  fechaLimite: string | null;
  partidoEliminado: boolean;
}

/** La tarjeta del ticket. */
export interface DetalleTicket extends ResumenTicket {
  nota: string;
  linkEntrega: string | null;
  estadoPartido: string | null;
}

export interface EventoHistorial {
  id: number;
  tipo: TipoEventoTicket;
  autorNombre: string | null;
  texto: string | null;
  link: string | null;
  estadoDesde: EstadoTicket | null;
  estadoHasta: EstadoTicket | null;
  /** ISO UTC. */
  creadoEn: string;
}
```

`lib/tickets/estados.ts`:

```ts
/**
 * Metadatos visibles de cada estado de ticket y reglas de "cuál manda" cuando un partido
 * tiene más de un ticket (hay un chip por partido en el calendario). Puro.
 *
 * Football First. Creado 2026-09-28.
 */
import type { EstadoTicket, ResumenTicket } from '@/lib/tickets/tipos';

/** El símbolo acompaña al color: el estado se lee aunque no se distingan los colores. */
export const META_ESTADO: Record<EstadoTicket, { etiqueta: string; corta: string; simbolo: string }> = {
  pendiente: { etiqueta: 'Pendiente', corta: 'Pendiente', simbolo: '●' },
  en_revision: { etiqueta: 'En revisión', corta: 'Revisión', simbolo: '◐' },
  aprobado: { etiqueta: 'Aprobado', corta: 'Aprobado', simbolo: '✓' },
  publicado: { etiqueta: 'Publicado', corta: 'Publicado', simbolo: '✓✓' },
  cancelado: { etiqueta: 'Cancelado', corta: 'Cancelado', simbolo: '○' },
};

const URGENCIA: EstadoTicket[] = ['pendiente', 'en_revision', 'aprobado', 'publicado'];

/** El estado más urgente de la lista (cancelado no cuenta). `null` si no queda ninguno. */
export function estadoMasUrgente(estados: EstadoTicket[]): EstadoTicket | null {
  for (const e of URGENCIA) if (estados.includes(e)) return e;
  return null;
}

export interface ResumenPartido {
  estado: EstadoTicket;
  /** Tickets no cancelados del partido, en el orden recibido. */
  ticketIds: string[];
}

/** `{ partidoId: { estado más urgente, ids } }` — sin cancelados ni tickets sin partido. */
export function resumirPorPartido(tickets: ResumenTicket[]): Record<string, ResumenPartido> {
  const porPartido: Record<string, ResumenTicket[]> = {};
  for (const t of tickets) {
    if (!t.partidoId || t.estado === 'cancelado') continue;
    (porPartido[t.partidoId] ??= []).push(t);
  }
  const resumen: Record<string, ResumenPartido> = {};
  for (const [partidoId, lista] of Object.entries(porPartido)) {
    const estado = estadoMasUrgente(lista.map((t) => t.estado));
    if (estado) resumen[partidoId] = { estado, ticketIds: lista.map((t) => t.id) };
  }
  return resumen;
}
```

`lib/tickets/permisos.ts`:

```ts
/**
 * Qué puede hacer cada cargo con un ticket — ESPEJO de las reglas de la base (0025,
 * `ticket__mover`). La base es la que manda: esto solo decide qué botones mostrar. Puro.
 *
 * Football First. Creado 2026-09-28.
 */
import type { Accion, EstadoTicket, ResumenTicket } from '@/lib/tickets/tipos';

const CREADORES = ['Administrador', 'Community Manager'];
const COMENTAN = ['Administrador', 'Community Manager', 'Diseñador'];

export function puedeCrear(cargo: string): boolean {
  return CREADORES.includes(cargo);
}

export function accionesPermitidas(p: { cargo: string; esCreador: boolean; estado: EstadoTicket }): Accion[] {
  const acciones: Accion[] = [];
  const esRevisor = p.cargo === 'Administrador' || (p.cargo === 'Community Manager' && p.esCreador);
  if (p.cargo === 'Diseñador') {
    if (p.estado === 'pendiente') acciones.push('entregar');
    if (p.estado === 'aprobado') acciones.push('publicar');
  }
  if (esRevisor) {
    if (p.estado === 'en_revision') acciones.push('aprobar', 'devolver');
    if (p.estado === 'pendiente') acciones.push('cancelar');
  }
  if (COMENTAN.includes(p.cargo)) acciones.push('comentar');
  return acciones;
}

/** Lo que "le toca" a cada cargo (contador de la barra), por fecha límite; sin fecha al final. */
export function pendientesDe(cargo: string, usuarioId: string, tickets: ResumenTicket[]): ResumenTicket[] {
  const filtro: (t: ResumenTicket) => boolean =
    cargo === 'Diseñador'
      ? (t) => t.estado === 'pendiente' || t.estado === 'aprobado'
      : cargo === 'Community Manager'
        ? (t) => t.estado === 'en_revision' && t.creadoPor === usuarioId
        : cargo === 'Administrador'
          ? (t) => t.estado === 'en_revision'
          : () => false;
  return tickets
    .filter(filtro)
    .sort(
      (a, b) =>
        (a.fechaLimite ?? '9999-12-31').localeCompare(b.fechaLimite ?? '9999-12-31') ||
        a.titulo.localeCompare(b.titulo, 'es'),
    );
}
```

`lib/tickets/vencimiento.ts`:

```ts
/**
 * Textos de fecha de los tickets: "Vence en 4 días · vie 2/10", "⚠️ Vencido…", y fechas
 * cortas en hora de Uruguay para el historial. Puro (solo luxon).
 *
 * Football First. Creado 2026-09-28.
 */
import { DateTime } from 'luxon';
import type { EstadoTicket } from '@/lib/tickets/tipos';

const ZONA = 'America/Montevideo';
const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']; // Luxon: weekday 1 = lunes

/** "vie 2/10" para una fecha civil YYYY-MM-DD. */
export function fechaCortaUy(dia: string): string {
  const d = DateTime.fromISO(dia, { zone: ZONA });
  return `${DIAS[d.weekday - 1]} ${d.day}/${d.month}`;
}

/** "sáb 4/10 20:15" para un instante ISO, en hora de Uruguay. */
export function fechaHoraCortaUy(iso: string): string {
  const d = DateTime.fromISO(iso, { zone: 'utc' }).setZone(ZONA);
  return `${DIAS[d.weekday - 1]} ${d.day}/${d.month} ${d.toFormat('HH:mm')}`;
}

/**
 * Texto de vencimiento. `null` cuando ya no aplica (aprobado, publicado, cancelado).
 * `vencido` pinta en rojo.
 */
export function textoVencimiento(
  fechaLimite: string | null,
  estado: EstadoTicket,
  hoyUy: string,
): { texto: string; vencido: boolean } | null {
  if (estado === 'aprobado' || estado === 'publicado' || estado === 'cancelado') return null;
  if (!fechaLimite) return { texto: 'Sin fecha límite', vencido: false };
  const dias = Math.round(
    DateTime.fromISO(fechaLimite, { zone: 'utc' }).diff(DateTime.fromISO(hoyUy, { zone: 'utc' }), 'days').days,
  );
  const fecha = fechaCortaUy(fechaLimite);
  if (dias === 0) return { texto: 'Vence hoy', vencido: false };
  if (dias === 1) return { texto: `Vence mañana · ${fecha}`, vencido: false };
  if (dias > 1) return { texto: `Vence en ${dias} días · ${fecha}`, vencido: false };
  const atraso = -dias;
  return { texto: `Vencido hace ${atraso} día${atraso === 1 ? '' : 's'} · ${fecha}`, vencido: true };
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `node --test lib/tickets/*.test.ts` → Expected: PASS, 0 fail.
Run: `npm test` → Expected: todos PASS (143 previos + los nuevos).

- [ ] **Step 5: Commit**

```bash
git add lib/tickets/
git commit -m "feat(tickets): lógica pura — estados, permisos, pendientes por cargo y vencimientos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Repositorio de lectura + llamadas RPC + mensajes de error

**Files:**
- Create: `lib/repositorios/repositorio-tickets.ts`, `lib/tickets/acciones.ts`, `lib/tickets/errores.ts`
- Test: `lib/tickets/errores.test.ts`

**Interfaces:**
- Consumes: tipos de Task 5; tipos generados de Task 4.
- Produces:
  - `class RepositorioTicketsSupabase { constructor(supabase); listarResumen(): Promise<ResumenTicket[]>; listarPorPartido(partidoId: string): Promise<ResumenTicket[]>; obtenerDetalle(id: string): Promise<{ ticket: DetalleTicket; historial: EventoHistorial[] } | null> }` — `listarResumen` excluye cancelados.
  - `mensajeError(error: { message?: string; code?: string } | null): string`
  - `type Resultado<T> = { ok: true; valor: T } | { ok: false; mensaje: string }`
  - `crearTicket(supabase: SupabaseClient, partidoId: string, jugadorId: string, nota: string): Promise<Resultado<string>>`
  - `ejecutarAccion(supabase: SupabaseClient, accion: Accion, ticketId: string, datos: { texto?: string; link?: string }): Promise<Resultado<null>>`

- [ ] **Step 1: Test de `mensajeError`**

`lib/tickets/errores.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensajeError } from './errores.ts';

test('mensajes de la base (español, con mayúscula) se muestran tal cual', () => {
  assert.equal(
    mensajeError({ message: 'Solo el Diseñador puede hacer esto.', code: '42501' }),
    'Solo el Diseñador puede hacer esto.',
  );
  assert.equal(
    mensajeError({ message: 'El ticket cambió de estado (ahora está "aprobado"). Recargá para ver lo último.', code: 'P0001' }),
    'El ticket cambió de estado (ahora está "aprobado"). Recargá para ver lo último.',
  );
});

test('errores técnicos en inglés → mensaje genérico en español', () => {
  assert.equal(mensajeError({ message: 'permission denied for function ticket_crear', code: '42501' }), 'No tenés permiso para hacer esto.');
  assert.equal(mensajeError({ message: 'Failed to fetch' }), 'No se pudo completar. Revisá la conexión y probá de nuevo.');
  assert.equal(mensajeError({ message: 'Could not find the function', code: 'PGRST202' }), 'Esta función todavía no está disponible. Avisale a Gerardo.');
  assert.equal(mensajeError(null), 'No se pudo completar. Probá de nuevo.');
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `node --test lib/tickets/errores.test.ts` → Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

`lib/tickets/errores.ts`:

```ts
/**
 * Traduce el error de una llamada RPC de tickets a un mensaje para la UI. Los mensajes de
 * la base (0025) ya vienen en español y se muestran tal cual; lo técnico en inglés se
 * reemplaza por un texto humano (doc 19: content design). Puro.
 *
 * Football First. Creado 2026-09-28.
 */

export function mensajeError(error: { message?: string; code?: string } | null): string {
  if (!error) return 'No se pudo completar. Probá de nuevo.';
  if (error.code === 'PGRST202') return 'Esta función todavía no está disponible. Avisale a Gerardo.';
  const m = error.message ?? '';
  // Los mensajes propios empiezan con mayúscula (con o sin tilde) y no son de red.
  if (/^[A-ZÁÉÍÓÚÑ¿¡]/.test(m) && !/fetch|network/i.test(m)) return m;
  if (error.code === '42501' || /permission denied/i.test(m)) return 'No tenés permiso para hacer esto.';
  if (/fetch|network/i.test(m)) return 'No se pudo completar. Revisá la conexión y probá de nuevo.';
  return 'No se pudo completar. Probá de nuevo.';
}
```

`lib/tickets/acciones.ts`:

```ts
/**
 * Escrituras de tickets: SIEMPRE por las funciones de la base (0025), nunca a las tablas.
 * Reciben el cliente de Supabase del navegador (sesión del usuario → la base valida
 * puesto y estado). Devuelven `Resultado` con un mensaje listo para mostrar.
 *
 * Football First. Creado 2026-09-28.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { mensajeError } from '@/lib/tickets/errores';
import type { Accion } from '@/lib/tickets/tipos';

export type Resultado<T> = { ok: true; valor: T } | { ok: false; mensaje: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>;

export async function crearTicket(
  supabase: Cliente,
  partidoId: string,
  jugadorId: string,
  nota: string,
): Promise<Resultado<string>> {
  const { data, error } = await supabase.rpc('ticket_crear', {
    p_partido: partidoId,
    p_jugador: jugadorId,
    p_nota: nota,
  });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  return { ok: true, valor: data as string };
}

const FUNCION: Record<Accion, string> = {
  entregar: 'ticket_entregar',
  aprobar: 'ticket_aprobar',
  devolver: 'ticket_devolver',
  publicar: 'ticket_publicar',
  cancelar: 'ticket_cancelar',
  comentar: 'ticket_comentar',
};

export async function ejecutarAccion(
  supabase: Cliente,
  accion: Accion,
  ticketId: string,
  datos: { texto?: string; link?: string },
): Promise<Resultado<null>> {
  const args: Record<string, string | null> = { p_ticket: ticketId, p_texto: datos.texto ?? null };
  if (accion === 'entregar') args.p_link = datos.link ?? '';
  const { error } = await supabase.rpc(FUNCION[accion], args);
  if (error) return { ok: false, mensaje: mensajeError(error) };
  return { ok: true, valor: null };
}
```

`lib/repositorios/repositorio-tickets.ts`:

```ts
/**
 * Lecturas de tickets (vistas `tickets_vista` y `tickets_historial_vista`, 0025). Las
 * escrituras NO están acá: van por `lib/tickets/acciones.ts` (funciones de la base).
 * RLS: solo usuarios activos leen.
 *
 * Football First. Creado 2026-09-28.
 */
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import type { DetalleTicket, EstadoTicket, EventoHistorial, ResumenTicket, TipoEventoTicket } from '@/lib/tickets/tipos';

type ClienteSupabase = ReturnType<typeof crearClienteServidor>;

interface FilaTicket {
  id: string;
  partido_id: string | null;
  jugador_id: string;
  jugador_nombre: string;
  titulo: string;
  nota: string;
  estado: EstadoTicket;
  link_entrega: string | null;
  creado_por: string;
  creado_por_nombre: string | null;
  inicio_utc: string | null;
  estado_partido: string | null;
  partido_eliminado: boolean;
  fecha_limite: string | null;
}

interface FilaHistorial {
  id: number;
  tipo: TipoEventoTicket;
  autor_nombre: string | null;
  texto: string | null;
  link: string | null;
  estado_desde: EstadoTicket | null;
  estado_hasta: EstadoTicket | null;
  creado_en: string;
}

const CAMPOS =
  'id, partido_id, jugador_id, jugador_nombre, titulo, nota, estado, link_entrega, creado_por, creado_por_nombre, inicio_utc, estado_partido, partido_eliminado, fecha_limite';

function aResumen(f: FilaTicket): ResumenTicket {
  return {
    id: f.id,
    partidoId: f.partido_id,
    jugadorId: f.jugador_id,
    jugadorNombre: f.jugador_nombre,
    titulo: f.titulo,
    estado: f.estado,
    creadoPor: f.creado_por,
    creadoPorNombre: f.creado_por_nombre,
    inicioUtc: f.inicio_utc,
    fechaLimite: f.fecha_limite,
    partidoEliminado: f.partido_eliminado,
  };
}

export class RepositorioTicketsSupabase {
  constructor(private readonly supabase: ClienteSupabase) {}

  /** Todos los tickets no cancelados (tabla chica: 3 usuarios). */
  async listarResumen(): Promise<ResumenTicket[]> {
    const { data, error } = await this.supabase
      .from('tickets_vista')
      .select(CAMPOS)
      .neq('estado', 'cancelado')
      .order('creado_en', { ascending: true })
      .returns<FilaTicket[]>();
    if (error) throw new Error(`No se pudo leer tickets: ${error.message}`);
    return (data ?? []).map(aResumen);
  }

  /** Tickets no cancelados de un partido (pastillas del panel del partido). */
  async listarPorPartido(partidoId: string): Promise<ResumenTicket[]> {
    const { data, error } = await this.supabase
      .from('tickets_vista')
      .select(CAMPOS)
      .eq('partido_id', partidoId)
      .neq('estado', 'cancelado')
      .order('creado_en', { ascending: true })
      .returns<FilaTicket[]>();
    if (error) throw new Error(`No se pudo leer tickets del partido: ${error.message}`);
    return (data ?? []).map(aResumen);
  }

  async obtenerDetalle(id: string): Promise<{ ticket: DetalleTicket; historial: EventoHistorial[] } | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [{ data: fila, error: e1 }, { data: filas, error: e2 }] = await Promise.all([
      this.supabase.from('tickets_vista').select(CAMPOS).eq('id', id).maybeSingle<FilaTicket>(),
      this.supabase
        .from('tickets_historial_vista')
        .select('id, tipo, autor_nombre, texto, link, estado_desde, estado_hasta, creado_en')
        .eq('ticket_id', id)
        .order('id', { ascending: true })
        .returns<FilaHistorial[]>(),
    ]);
    if (e1) throw new Error(`No se pudo leer el ticket: ${e1.message}`);
    if (e2) throw new Error(`No se pudo leer el historial: ${e2.message}`);
    if (!fila) return null;
    return {
      ticket: { ...aResumen(fila), nota: fila.nota, linkEntrega: fila.link_entrega, estadoPartido: fila.estado_partido },
      historial: (filas ?? []).map((h) => ({
        id: h.id,
        tipo: h.tipo,
        autorNombre: h.autor_nombre,
        texto: h.texto,
        link: h.link,
        estadoDesde: h.estado_desde,
        estadoHasta: h.estado_hasta,
        creadoEn: h.creado_en,
      })),
    };
  }
}
```

- [ ] **Step 4: Verificar**

Run: `node --test lib/tickets/errores.test.ts` → PASS.
Run: `npm test && npm run lint && npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | grep -v "npm notice"` → tests PASS, lint sin errores, tsc sin salida.
Si `supabase.rpc('ticket_crear', …)` da error de tipos por el nombre de la función, verificar que Task 4 regeneró los tipos; si igual falla, castear el nombre: `supabase.rpc(FUNCION[accion] as never, args as never)` (mismo patrón `as never` que ya usa `PanelPerfil`).

- [ ] **Step 5: Commit**

```bash
git add lib/repositorios/repositorio-tickets.ts lib/tickets/acciones.ts lib/tickets/errores.ts lib/tickets/errores.test.ts
git commit -m "feat(tickets): repositorio de lectura, acciones por RPC y mensajes de error humanos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Panel del ticket (`?panel=ticket&id=…`)

**Files:**
- Create: `lib/tickets/cargar-detalle-ticket.ts`, `app/api/paneles/ticket/route.ts`, `components/tickets/PastillaEstado.tsx`, `components/tickets/PanelTicket.tsx`
- Modify: `lib/paneles/use-panel.ts` (tipo `'ticket'`), `components/paneles/PanelLateral.tsx`, `styles/app.css`

**Interfaces:**
- Consumes: `RepositorioTicketsSupabase.obtenerDetalle`, `ejecutarAccion`, `accionesPermitidas`, `textoVencimiento`, `fechaHoraCortaUy`, `META_ESTADO`, `sesionActual()`.
- Produces:
  - `interface DetalleTicketBundle { ticket: DetalleTicket; historial: EventoHistorial[]; usuario: { id: string; cargo: string }; hoyUy: string }`
  - `<PastillaEstado estado={EstadoTicket} />`
  - `<PanelTicket bundle={DetalleTicketBundle} onActualizar={() => void} />`
  - `TipoPanel` incluye `'ticket'`.

- [ ] **Step 1: Loader + endpoint**

`lib/tickets/cargar-detalle-ticket.ts`:

```ts
/**
 * Bundle del panel del ticket: el ticket + su historial + quién mira (para decidir botones).
 * Cliente SSR con cookies → RLS aplica.
 *
 * Football First. Creado 2026-09-28.
 */
import { DateTime } from 'luxon';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import { RepositorioTicketsSupabase } from '@/lib/repositorios/repositorio-tickets';
import { sesionActual } from '@/lib/sesion/sesion-actual';
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import type { DetalleTicket, EventoHistorial } from '@/lib/tickets/tipos';

export interface DetalleTicketBundle {
  ticket: DetalleTicket;
  historial: EventoHistorial[];
  usuario: { id: string; cargo: string };
  hoyUy: string;
}

export async function cargarDetalleTicket(
  supabase: ReturnType<typeof crearClienteServidor>,
  id: string,
): Promise<DetalleTicketBundle | null> {
  const [detalle, sesion] = await Promise.all([
    new RepositorioTicketsSupabase(supabase).obtenerDetalle(id),
    sesionActual(),
  ]);
  if (!detalle || !sesion) return null;
  return {
    ...detalle,
    usuario: { id: sesion.usuarioId, cargo: sesion.cargo },
    hoyUy: DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '',
  };
}
```

`app/api/paneles/ticket/route.ts`:

```ts
/**
 * Datos del panel del ticket, como JSON para el panel lateral. Cliente SSR (cookies del
 * usuario) → RLS aplica. 404 si no existe o no se puede leer.
 *
 * Football First. Creado 2026-09-28.
 */
import { NextResponse } from 'next/server';
import { cargarDetalleTicket } from '@/lib/tickets/cargar-detalle-ticket';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el parámetro id.' }, { status: 400 });

  const bundle = await cargarDetalleTicket(crearClienteServidor(), id);
  if (!bundle) return NextResponse.json({ error: 'Ticket no encontrado.' }, { status: 404 });

  return NextResponse.json(bundle);
}
```

- [ ] **Step 2: `use-panel.ts` y `PanelLateral.tsx`**

En `lib/paneles/use-panel.ts`:
- `export type TipoPanel = 'jugador' | 'partido' | 'perfil' | 'jugador-contenido' | 'ticket';`
- `const TIPOS: readonly TipoPanel[] = ['jugador', 'partido', 'perfil', 'jugador-contenido', 'ticket'];`

En `components/paneles/PanelLateral.tsx`:
1. Imports: `import { PanelTicket } from '@/components/tickets/PanelTicket';` y `import type { DetalleTicketBundle } from '@/lib/tickets/cargar-detalle-ticket';`
2. `type Contenido` suma `| { fase: 'ticket'; datos: DetalleTicketBundle }`.
3. `ETIQUETA_TIPO` suma `ticket: 'ticket',`.
4. Estado de recarga: debajo de `const [contenido, setContenido] = …` agregar `const [version, setVersion] = useState(0);` y en el `useEffect` de carga agregar `version` a las dependencias (`[abierto, tipo, id, version]`).
5. En el `.then`, antes del `else setContenido({ fase: 'perfil', datos })`: `else if (tipo === 'ticket') setContenido({ fase: 'ticket', datos });`
6. `titulo`: agregar el caso `tipo === 'ticket' ? 'Ticket de diseño' :` antes de `tipo === 'perfil'`.
7. `<aside className=…>`: `className={\`panel ${abierto ? 'on' : ''} ${contenido?.fase === 'ticket' ? \`panel--t-${contenido.datos.ticket.estado}\` : ''}\`}`
8. En `panel__b`: `{contenido?.fase === 'ticket' && (<PanelTicket bundle={contenido.datos} onActualizar={() => setVersion((v) => v + 1)} />)}`

- [ ] **Step 3: `PastillaEstado.tsx`**

```tsx
/**
 * Pastilla de estado de un ticket: color + símbolo + palabra (el estado se lee aunque no
 * se distingan los colores). Clases `.tk .tk--<estado>` en app.css.
 *
 * Football First. Creado 2026-09-28.
 */
import { META_ESTADO } from '@/lib/tickets/estados';
import type { EstadoTicket } from '@/lib/tickets/tipos';

export function PastillaEstado({ estado }: { estado: EstadoTicket }) {
  const m = META_ESTADO[estado];
  return (
    <span className={`tk tk--${estado}`}>
      <span aria-hidden="true">{m.simbolo}</span> {m.etiqueta}
    </span>
  );
}
```

- [ ] **Step 4: `PanelTicket.tsx`**

```tsx
/**
 * Tarjeta del ticket de diseño (panel lateral, `?panel=ticket&id=…`). De arriba a abajo:
 * estado + título + partido + fecha límite, nota, "Abrir diseño", botones según quién mira
 * (`accionesPermitidas`, espejo de la base), conversación imborrable y caja de comentario.
 *
 * Toda escritura va por `ejecutarAccion` (funciones de la base). Después de cada acción:
 * `onActualizar()` (recarga el panel) + `router.refresh()` (chip del calendario y contador).
 *
 * Football First. Creado 2026-09-28.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ico } from '@/components/comunes/Ico';
import { PastillaEstado } from '@/components/tickets/PastillaEstado';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import { ejecutarAccion } from '@/lib/tickets/acciones';
import { accionesPermitidas } from '@/lib/tickets/permisos';
import { fechaHoraCortaUy, textoVencimiento } from '@/lib/tickets/vencimiento';
import type { DetalleTicketBundle } from '@/lib/tickets/cargar-detalle-ticket';
import type { Accion, EventoHistorial } from '@/lib/tickets/tipos';

/** Acciones que abren un campo obligatorio antes de confirmar. */
const CON_CAMPO: Partial<Record<Accion, { etiqueta: string; placeholder: string; boton: string; esLink?: boolean }>> = {
  entregar: { etiqueta: 'Link de Dropbox del diseño', placeholder: 'https://www.dropbox.com/…', boton: 'Entregar para revisión', esLink: true },
  devolver: { etiqueta: 'Qué hay que corregir', placeholder: 'Ej.: cambiá el fondo por el de local', boton: 'Devolver al Diseñador' },
  cancelar: { etiqueta: 'Por qué se cancela', placeholder: 'Ej.: el partido no se cubre', boton: 'Cancelar ticket' },
};

const BOTON: Record<Exclude<Accion, 'comentar'>, { texto: string; clase: string }> = {
  entregar: { texto: 'Entregar', clase: 'btn btn--a' },
  aprobar: { texto: 'Aprobar', clase: 'btn btn--a' },
  devolver: { texto: 'Devolver', clase: 'btn btn--g' },
  publicar: { texto: 'Marcar publicado', clase: 'btn btn--a' },
  cancelar: { texto: 'Cancelar ticket', clase: 'btn btn--g' },
};

const TITULO_EVENTO: Record<EventoHistorial['tipo'], string> = {
  creado: 'creó el ticket',
  comentario: 'comentó',
  entrega: 'entregó el diseño',
  aprobado: 'aprobó',
  devuelto: 'lo devolvió con correcciones',
  publicado: 'lo marcó como publicado',
  cancelado: 'lo canceló',
  sistema: 'Aviso del sistema',
};

export function PanelTicket({ bundle, onActualizar }: { bundle: DetalleTicketBundle; onActualizar: () => void }) {
  const router = useRouter();
  const { ticket, historial, usuario, hoyUy } = bundle;
  const acciones = accionesPermitidas({
    cargo: usuario.cargo,
    esCreador: ticket.creadoPor === usuario.id,
    estado: ticket.estado,
  });
  const vence = textoVencimiento(ticket.fechaLimite, ticket.estado, hoyUy);

  const [abierta, setAbierta] = useState<Accion | null>(null);
  const [campo, setCampo] = useState('');
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function correr(accion: Accion, datos: { texto?: string; link?: string }) {
    setEnviando(true);
    setError(null);
    const r = await ejecutarAccion(crearClienteNavegador(), accion, ticket.id, datos);
    setEnviando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setAbierta(null);
    setCampo('');
    setComentario('');
    onActualizar();
    router.refresh();
  }

  function alBoton(accion: Accion) {
    if (CON_CAMPO[accion]) {
      setAbierta(accion);
      setCampo('');
      setError(null);
      return;
    }
    void correr(accion, {});
  }

  const formulario = abierta ? CON_CAMPO[abierta] : undefined;

  return (
    <>
      <div className="linea" style={{ marginBottom: 14 }}>
        <PastillaEstado estado={ticket.estado} />
        {vence && (
          <span className={vence.vencido ? 'tk__vence tk__vence--mal' : 'tk__vence'}>
            {vence.vencido ? '⚠️ ' : ''}
            {vence.texto}
          </span>
        )}
      </div>
      <h2 className="d2" style={{ marginBottom: 10 }}>{ticket.titulo}</h2>
      <p className="meta" style={{ marginBottom: 24 }}>
        {ticket.partidoEliminado
          ? 'El partido ya no figura en la fuente de datos.'
          : ticket.inicioUtc
            ? `Partido: ${fechaHoraCortaUy(ticket.inicioUtc)} (hora Uruguay)`
            : 'Partido sin hora confirmada'}
        {ticket.creadoPorNombre ? ` · Lo pidió ${ticket.creadoPorNombre}` : ''}
      </p>

      <div className="bloque">
        <span className="label">Qué hay que hacer</span>
        <p className="tk__nota">{ticket.nota}</p>
      </div>

      {ticket.linkEntrega && (
        <a href={ticket.linkEntrega} target="_blank" rel="noopener noreferrer" className="btn btn--g" style={{ marginBottom: 24 }}>
          Abrir diseño
        </a>
      )}

      {acciones.some((a) => a !== 'comentar') && !formulario && (
        <div className="linea" style={{ gap: 10, marginBottom: 24 }}>
          {acciones
            .filter((a): a is Exclude<Accion, 'comentar'> => a !== 'comentar')
            .map((a) => (
              <button key={a} type="button" className={BOTON[a].clase} disabled={enviando} onClick={() => alBoton(a)}>
                {BOTON[a].texto}
              </button>
            ))}
        </div>
      )}

      {formulario && abierta && (
        <div className="bloque">
          <div className="campo">
            <label htmlFor="tk-campo">{formulario.etiqueta}</label>
            {formulario.esLink ? (
              <input id="tk-campo" type="url" inputMode="url" placeholder={formulario.placeholder} value={campo} onChange={(e) => setCampo(e.target.value)} />
            ) : (
              <textarea id="tk-campo" rows={3} maxLength={2000} placeholder={formulario.placeholder} value={campo} onChange={(e) => setCampo(e.target.value)} />
            )}
          </div>
          <div className="linea" style={{ gap: 10 }}>
            <button
              type="button"
              className="btn btn--a"
              disabled={enviando}
              onClick={() => correr(abierta, formulario.esLink ? { link: campo } : { texto: campo })}
            >
              {enviando ? 'Guardando…' : formulario.boton}
            </button>
            <button type="button" className="btn btn--g" disabled={enviando} onClick={() => setAbierta(null)}>
              Volver
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="aviso" role="alert" style={{ marginBottom: 20 }}>
          <Ico nombre="alerta" clase="ico ico--sm" />
          <span>{error}</span>
        </div>
      )}

      <div className="bloque">
        <span className="label">Conversación</span>
        <ol className="tkh">
          {historial.map((h) => (
            <li key={h.id} className={`tkh__i tkh__i--${h.tipo}`}>
              <div className="tkh__c">
                <b>{h.tipo === 'sistema' ? TITULO_EVENTO.sistema : `${h.autorNombre ?? 'Alguien'} ${TITULO_EVENTO[h.tipo]}`}</b>
                <time dateTime={h.creadoEn}>{fechaHoraCortaUy(h.creadoEn)}</time>
              </div>
              {h.texto && <p>{h.texto}</p>}
              {h.link && (
                <a href={h.link} target="_blank" rel="noopener noreferrer">
                  Ver esta entrega
                </a>
              )}
            </li>
          ))}
        </ol>
      </div>

      {acciones.includes('comentar') && (
        <div className="bloque">
          <div className="campo">
            <label htmlFor="tk-comentario">Escribir en la conversación</label>
            <textarea id="tk-comentario" rows={3} maxLength={2000} value={comentario} onChange={(e) => setComentario(e.target.value)} />
          </div>
          <button type="button" className="btn btn--g" disabled={enviando || !comentario.trim()} onClick={() => correr('comentar', { texto: comentario })}>
            {enviando ? 'Enviando…' : 'Comentar'}
          </button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 5: CSS en `styles/app.css` (al final)**

```css
/* ============================================================
   Tickets de diseño (0025). Colores por estado con tokens propios (claro/oscuro).
   El color nunca va solo: siempre con símbolo + palabra (META_ESTADO).
   ============================================================ */
:root {
  --tk-rojo: #B42318;     --tk-rojo-bg: #FDECEA;     --tk-rojo-borde: #E64227;
  --tk-amarillo: #7A5200; --tk-amarillo-bg: #FFF4D6; --tk-amarillo-borde: #E0A100;
  --tk-verde: #1E6B35;    --tk-verde-bg: #E6F4EA;    --tk-verde-borde: #2E9E55;
  --tk-pub: #14532D;      --tk-pub-bg: #D1F0DC;      --tk-pub-borde: #1E7B3A;
}
[data-theme="dark"] {
  --tk-rojo: #FF8A75;     --tk-rojo-bg: #2A1411;     --tk-rojo-borde: #F55437;
  --tk-amarillo: #F5C451; --tk-amarillo-bg: #2A220E; --tk-amarillo-borde: #E0A100;
  --tk-verde: #6FD39A;    --tk-verde-bg: #0F2618;    --tk-verde-borde: #2E9E55;
  --tk-pub: #9BE3B8;      --tk-pub-bg: #0C2215;      --tk-pub-borde: #3DBB6E;
}

.tk { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 999px; font-size: var(--t-xs); font-weight: 700; white-space: nowrap; }
.tk--pendiente { background: var(--tk-rojo-bg); color: var(--tk-rojo); }
.tk--en_revision { background: var(--tk-amarillo-bg); color: var(--tk-amarillo); }
.tk--aprobado { background: var(--tk-verde-bg); color: var(--tk-verde); }
.tk--publicado { background: var(--tk-pub-bg); color: var(--tk-pub); }
.tk--cancelado { background: var(--surface-3); color: var(--text-3); }
.tk__vence { font-size: var(--t-sm); color: var(--text-2); }
.tk__vence--mal { color: var(--tk-rojo); font-weight: 600; }
.tk__nota { font-size: var(--t-base); line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }

/* Borde del panel lateral con el color del estado */
.panel.panel--t-pendiente { border-left: 5px solid var(--tk-rojo-borde); }
.panel.panel--t-en_revision { border-left: 5px solid var(--tk-amarillo-borde); }
.panel.panel--t-aprobado { border-left: 5px solid var(--tk-verde-borde); }
.panel.panel--t-publicado { border-left: 5px solid var(--tk-pub-borde); }
.panel.panel--t-cancelado { border-left: 5px solid var(--surface-3); }

/* Conversación */
.tkh { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.tkh__i { padding: 12px 14px; border-radius: var(--r-sm); background: var(--surface); }
.tkh__i p { margin-top: 6px; font-size: var(--t-md); line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
.tkh__i a { display: inline-block; margin-top: 6px; font-size: var(--t-sm); color: var(--accent); font-weight: 600; }
.tkh__c { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: var(--t-sm); }
.tkh__c b { font-weight: 600; }
.tkh__c time { color: var(--text-3); }
.tkh__i--sistema { background: transparent; border: 1px dashed var(--line-2); }
.tkh__i--devuelto { background: var(--tk-rojo-bg); }
.tkh__i--aprobado, .tkh__i--publicado { background: var(--tk-verde-bg); }
.tkh__i--entrega { background: var(--tk-amarillo-bg); }
```

- [ ] **Step 6: Verificar**

Run: `npm test && npm run lint && npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | grep -v "npm notice"` → PASS / sin errores.
QA mínima contra el dev de Gerardo (`http://localhost:3000`): crear un ticket de prueba con SQL como Felipe no es posible sin UI (llega en Task 8); en esta tarea verificar solo que `GET /api/paneles/ticket?id=00000000-0000-0000-0000-000000000000` logueado devuelve 404 y que `?panel=ticket&id=…` muestra "No encontramos ese ticket." sin errores de consola (script de `browser-automation` con login `maxi`/`demo1234`).

- [ ] **Step 7: Commit**

```bash
git add lib/tickets/cargar-detalle-ticket.ts app/api/paneles/ticket/route.ts components/tickets/ lib/paneles/use-panel.ts components/paneles/PanelLateral.tsx styles/app.css
git commit -m "feat(tickets): panel del ticket con estado, vencimiento, acciones y conversación

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Crear ticket desde el panel del partido

**Files:**
- Create: `components/tickets/CrearTicket.tsx`
- Modify: `lib/paneles/cargar-detalle-partido.ts`, `components/paneles/PanelPartido.tsx`, `styles/app.css`

**Interfaces:**
- Consumes: `RepositorioTicketsSupabase.listarPorPartido`, `crearTicket`, `puedeCrear`, `PastillaEstado`, `usePanel`.
- Produces: `DetallePartidoBundle` suma `tickets: ResumenTicket[]` y `usuario: { id: string; cargo: string } | null`; `<CrearTicket partidoId jugadorId jugadorNombre />`.

- [ ] **Step 1: Bundle del partido**

En `lib/paneles/cargar-detalle-partido.ts`:
- Imports: `import { RepositorioTicketsSupabase } from '@/lib/repositorios/repositorio-tickets';`, `import { sesionActual } from '@/lib/sesion/sesion-actual';`, `import type { ResumenTicket } from '@/lib/tickets/tipos';`
- `DetallePartidoBundle` suma:
  ```ts
  /** Tickets de diseño no cancelados de este partido (0025). */
  tickets: ResumenTicket[];
  /** Quién mira (para "Crear ticket"). */
  usuario: { id: string; cargo: string } | null;
  ```
- En el `Promise.all`, agregar al final `new RepositorioTicketsSupabase(supabase).listarPorPartido(partidoId).catch(() => [] as ResumenTicket[]),` y `sesionActual(),`, desestructurando `tickets, sesion`.
- En el `return`: `tickets, usuario: sesion ? { id: sesion.usuarioId, cargo: sesion.cargo } : null,`

- [ ] **Step 2: `CrearTicket.tsx`**

```tsx
/**
 * "Crear ticket de diseño" para un jugador de un partido (panel del partido). Solo lo
 * renderiza el padre para Admin/CM. Al crear, abre la tarjeta del ticket nuevo.
 * El botón se deshabilita mientras envía: la base admite 2 tickets por partido, así que
 * un doble clic crearía dos.
 *
 * Football First. Creado 2026-09-28.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ico } from '@/components/comunes/Ico';
import { usePanel } from '@/lib/paneles/use-panel';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import { crearTicket } from '@/lib/tickets/acciones';

export function CrearTicket({ partidoId, jugadorId, jugadorNombre }: { partidoId: string; jugadorId: string; jugadorNombre: string }) {
  const router = useRouter();
  const { abrir } = usePanel();
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idCampo = `nota-${jugadorId}`;

  async function crear() {
    setEnviando(true);
    setError(null);
    const r = await crearTicket(crearClienteNavegador(), partidoId, jugadorId, nota);
    if (!r.ok) {
      setEnviando(false);
      setError(r.mensaje);
      return;
    }
    router.refresh();
    abrir('ticket', r.valor);
  }

  if (!abierto) {
    return (
      <button type="button" className="btn btn--g btn--sm" onClick={() => setAbierto(true)}>
        Crear ticket de diseño
      </button>
    );
  }

  return (
    <div className="tkn">
      <div className="campo">
        <label htmlFor={idCampo}>Qué hay que hacer para {jugadorNombre}</label>
        <textarea
          id={idCampo}
          rows={3}
          maxLength={2000}
          placeholder="Ej.: diseño del Match Day con la foto de local"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
      </div>
      {error && (
        <div className="aviso" role="alert" style={{ marginBottom: 12 }}>
          <Ico nombre="alerta" clase="ico ico--sm" />
          <span>{error}</span>
        </div>
      )}
      <div className="linea" style={{ gap: 10 }}>
        <button type="button" className="btn btn--a btn--sm" disabled={enviando || !nota.trim()} onClick={crear}>
          {enviando ? 'Creando…' : 'Crear ticket'}
        </button>
        <button type="button" className="btn btn--g btn--sm" disabled={enviando} onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `PanelPartido.tsx`**

- Imports: `import { CrearTicket } from '@/components/tickets/CrearTicket';`, `import { PastillaEstado } from '@/components/tickets/PastillaEstado';`, `import { puedeCrear } from '@/lib/tickets/permisos';`
- Dentro de `d.jugadores.map((j) => (<div key={j.jugadorId}> … <BotonesDropbox …/>` agregar, **después** de `<BotonesDropbox … />`:

```tsx
              <div className="tkp">
                {(bundle.tickets ?? [])
                  .filter((t) => t.jugadorId === j.jugadorId)
                  .map((t) => (
                    <button key={t.id} type="button" className="tkp__t" onClick={() => abrir('ticket', t.id)}>
                      <PastillaEstado estado={t.estado} />
                      <span>Ver ticket</span>
                    </button>
                  ))}
                {bundle.usuario &&
                  puedeCrear(bundle.usuario.cargo) &&
                  !(bundle.tickets ?? []).some((t) => t.jugadorId === j.jugadorId) && (
                    <CrearTicket partidoId={d.partidoId} jugadorId={j.jugadorId} jugadorNombre={j.nombre} />
                  )}
              </div>
```

(`abrir` ya existe en el componente: `const { abrir } = usePanel();`, línea 34. `d.partidoId` es el id del partido en `DetallePartido`, `lib/paneles/detalle-partido.ts:36`.)

- [ ] **Step 4: CSS (al final de `styles/app.css`)**

```css
/* Tickets en el panel del partido */
.tkp { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 4px 16px 10px; }
.tkp__t { display: inline-flex; align-items: center; gap: 8px; font-size: var(--t-sm); color: var(--text-2); border-radius: 999px; }
.tkp__t:hover span:last-child { text-decoration: underline; }
.tkn { width: 100%; padding: 12px; border-radius: var(--r-sm); background: var(--surface); }
```

- [ ] **Step 5: Verificar (QA contra el dev de Gerardo, `http://localhost:3000`)**

Run: `npm test && npm run lint && npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | grep -v "npm notice"`.
QA con `browser-automation` (script propio en el scratchpad):
1. Login `felipe`/`demo1234` → abrir un partido desde `/partidos` → "Crear ticket de diseño" visible bajo el jugador.
2. Nota vacía → botón "Crear ticket" deshabilitado. Escribir "QA — no hacer" → Crear → se abre `?panel=ticket&id=…` con pastilla "Pendiente", borde rojo, conversación con "Felipe Merola creó el ticket".
3. **Doble clic** rápido en "Crear ticket" (otro partido) → verificar con service role que se creó **1** ticket, no 2.
4. Volver al panel del partido → en lugar del botón, la pastilla "● Pendiente · Ver ticket".
5. Login `maxi` → mismo partido → sin "Crear ticket de diseño"; sí la pastilla.
6. Cancelar los tickets de QA desde la tarjeta (Felipe → "Cancelar ticket", motivo "QA").
0 errores de consola; mobile 390 sin scroll horizontal.

- [ ] **Step 6: Commit**

```bash
git add components/tickets/CrearTicket.tsx lib/paneles/cargar-detalle-partido.ts components/paneles/PanelPartido.tsx styles/app.css
git commit -m "feat(tickets): crear ticket desde el panel del partido (Admin/CM) + pastilla de estado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Chips coloreados en el calendario de Match Day

**Files:**
- Modify: `components/calendario/Calendario.tsx`, `app/(app)/calendario/page.tsx`, `styles/app.css`

**Interfaces:**
- Consumes: `RepositorioTicketsSupabase.listarResumen`, `resumirPorPartido`, `META_ESTADO`, `ResumenPartido`.
- Produces: `<Calendario eventos hoyUy ticketsPorPartido? />` con `ticketsPorPartido?: Record<string, ResumenPartido>` (opcional: `/calendario-general` no lo pasa y queda igual).

- [ ] **Step 1: Página `/calendario`**

En `app/(app)/calendario/page.tsx`:
- Imports: `import { RepositorioTicketsSupabase } from '@/lib/repositorios/repositorio-tickets';`, `import { resumirPorPartido } from '@/lib/tickets/estados';`
- Reemplazar `const repo = new RepositorioAgendaSupabase(crearClienteServidor());` por:
  ```ts
  const supabase = crearClienteServidor();
  const repo = new RepositorioAgendaSupabase(supabase);
  ```
- En el `Promise.all`, agregar como 3er elemento (degradación elegante: si la lectura de tickets falla, el calendario se ve como antes):
  ```ts
    new RepositorioTicketsSupabase(supabase).listarResumen().catch(() => []),
  ```
  desestructurando `[eventosNota, eventos, tickets]`.
- `<Calendario eventos={eventos} hoyUy={hoyUy} ticketsPorPartido={resumirPorPartido(tickets)} />`

- [ ] **Step 2: `Calendario.tsx`**

- Imports: `import { META_ESTADO, type ResumenPartido } from '@/lib/tickets/estados';`
- Firma: `export function Calendario({ eventos, hoyUy, ticketsPorPartido = {} }: { eventos: EventoCalendario[]; hoyUy: string; ticketsPorPartido?: Record<string, ResumenPartido> }) {`
- Reemplazar el bloque `if (e.fuente === 'partido' && e.refId) { … }` por:

```tsx
                if (e.fuente === 'partido' && e.refId) {
                  const refId = e.refId;
                  const tk = ticketsPorPartido[refId];
                  const soloUno = tk && tk.ticketIds.length === 1 ? tk.ticketIds[0] : null;
                  return (
                    <button
                      key={clave}
                      type="button"
                      className={`${clase} ${tk ? `ev--t ev--t-${tk.estado}` : ''}`}
                      onClick={() => (soloUno ? abrir('ticket', soloUno) : abrir('partido', refId))}
                    >
                      {tk && (
                        <small className="ev__tk">
                          <span aria-hidden="true">{META_ESTADO[tk.estado].simbolo}</span> {META_ESTADO[tk.estado].corta}
                          {tk.ticketIds.length > 1 ? ` · ${tk.ticketIds.length}` : ''}
                        </small>
                      )}
                      <b>{etiqueta}</b>
                      {texto}
                    </button>
                  );
                }
```

- [ ] **Step 3: CSS (al final de `styles/app.css`)**

```css
/* Chip de partido con ticket (calendario de Match Day) */
.ev.ev--t { border-left: 4px solid transparent; }
.ev.ev--t-pendiente { background: var(--tk-rojo-bg); border-left-color: var(--tk-rojo-borde); }
.ev.ev--t-en_revision { background: var(--tk-amarillo-bg); border-left-color: var(--tk-amarillo-borde); }
.ev.ev--t-aprobado { background: var(--tk-verde-bg); border-left-color: var(--tk-verde-borde); }
.ev.ev--t-publicado { background: var(--tk-pub-bg); border-left-color: var(--tk-pub-borde); }
.ev__tk { display: block; font-size: 10.5px; font-weight: 700; margin-bottom: 2px; }
.ev--t-pendiente .ev__tk { color: var(--tk-rojo); }
.ev--t-en_revision .ev__tk { color: var(--tk-amarillo); }
.ev--t-aprobado .ev__tk { color: var(--tk-verde); }
.ev--t-publicado .ev__tk { color: var(--tk-pub); }
```

- [ ] **Step 4: Verificar**

Run: `npm test && npm run lint && npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | grep -v "npm notice"`.
QA contra el dev (`browser-automation`): con un ticket de QA creado por Felipe en un partido de este mes → `/calendario` muestra el chip con clase `ev--t-pendiente` y el texto "● Pendiente"; clic → `?panel=ticket&id=…`. Un partido sin ticket abre `?panel=partido` como antes. `/calendario-general` sin cambios (ningún `.ev--t`). Tema oscuro: legible. Mobile 390. Cancelar el ticket de QA al final.

- [ ] **Step 5: Commit**

```bash
git add components/calendario/Calendario.tsx "app/(app)/calendario/page.tsx" styles/app.css
git commit -m "feat(tickets): chips del calendario de Match Day con el color y el estado del ticket

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Contador "Lo que te toca" en la barra superior

**Files:**
- Create: `components/tickets/ContadorTickets.tsx`
- Modify: `components/layout/BarraSuperior.tsx`, `app/(app)/layout.tsx`, `styles/app.css`

**Interfaces:**
- Consumes: `listarResumen`, `pendientesDe`, `textoVencimiento`, `META_ESTADO`, `rutaPanel`.
- Produces: `<ContadorTickets pendientes={ResumenTicket[]} hoyUy={string} />`; `BarraSuperior` recibe `pendientes: ResumenTicket[]` y `hoyUy: string`.

- [ ] **Step 1: Layout**

En `app/(app)/layout.tsx`:
- Imports: `import { RepositorioTicketsSupabase } from '@/lib/repositorios/repositorio-tickets';`, `import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';`, `import { pendientesDe } from '@/lib/tickets/permisos';`
- Después de `const nombre = primerNombre(…);`:
  ```ts
  const hoyUy = DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '';
  // Degradación elegante: si la lectura de tickets falla, la barra se ve sin contador.
  const tickets = await new RepositorioTicketsSupabase(crearClienteServidor()).listarResumen().catch(() => []);
  const pendientes = pendientesDe(sesion.cargo, sesion.usuarioId, tickets);
  ```
- `<BarraSuperior perfil={…} pendientes={pendientes} hoyUy={hoyUy} />`

- [ ] **Step 2: `ContadorTickets.tsx`**

```tsx
/**
 * Globito con la cantidad de tickets que "te tocan" (ver `pendientesDe`) + desplegable
 * "Lo que te toca", por fecha límite. Cada ítem abre la tarjeta del ticket. Sin pendientes
 * no se renderiza nada. Reusa `.drop` de la demo para el desplegable.
 *
 * Football First. Creado 2026-09-28.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { rutaPanel } from '@/lib/paneles/use-panel';
import { META_ESTADO } from '@/lib/tickets/estados';
import { textoVencimiento } from '@/lib/tickets/vencimiento';
import type { ResumenTicket } from '@/lib/tickets/tipos';

export function ContadorTickets({ pendientes, hoyUy }: { pendientes: ResumenTicket[]; hoyUy: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    document.addEventListener('click', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('click', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  if (!pendientes.length) return null;
  const n = pendientes.length;

  return (
    <div className="tkc" ref={ref}>
      <button
        type="button"
        className="tkc__btn"
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-label={`${n} ticket${n === 1 ? '' : 's'} te espera${n === 1 ? '' : 'n'}`}
        onClick={() => setAbierto((v) => !v)}
      >
        <span aria-hidden="true">🎫</span>
        <b>{n}</b>
      </button>
      <div className={abierto ? 'drop on' : 'drop'}>
        <div className="drop__h">
          <div>
            <b>Lo que te toca</b>
            <span>Ordenado por fecha límite</span>
          </div>
        </div>
        {pendientes.map((t) => {
          const vence = textoVencimiento(t.fechaLimite, t.estado, hoyUy);
          return (
            <button
              key={t.id}
              type="button"
              className="tkc__i"
              onClick={() => {
                setAbierto(false);
                router.push(rutaPanel(pathname, 'ticket', t.id), { scroll: false });
              }}
            >
              <span className={`tk tk--${t.estado}`}>
                <span aria-hidden="true">{META_ESTADO[t.estado].simbolo}</span> {META_ESTADO[t.estado].corta}
              </span>
              <span className="tkc__t">
                <b>{t.titulo}</b>
                {vence && <small className={vence.vencido ? 'tk__vence--mal' : ''}>{vence.texto}</small>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `BarraSuperior.tsx`**

- Imports: `import { ContadorTickets } from '@/components/tickets/ContadorTickets';`, `import type { ResumenTicket } from '@/lib/tickets/tipos';`
- Firma: `export function BarraSuperior({ perfil, pendientes, hoyUy }: { perfil: PerfilBarra; pendientes: ResumenTicket[]; hoyUy: string }) {`
- En `.top__acc`, justo antes de `<div className="who" ref={contenedorRef}>`: `<ContadorTickets pendientes={pendientes} hoyUy={hoyUy} />`

- [ ] **Step 4: CSS (al final de `styles/app.css`)**

```css
/* Contador de tickets en la barra superior */
.tkc { position: relative; }
.tkc__btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border-radius: 999px; background: var(--tk-rojo-bg); color: var(--tk-rojo); font-size: var(--t-md); }
.tkc__btn:hover { box-shadow: var(--sh-1); }
.tkc__btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.tkc .drop { width: min(340px, calc(100vw - 32px)); max-height: 70vh; overflow-y: auto; }
.tkc__i { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 11px 13px; border-radius: var(--r-xs); text-align: left; }
.tkc__i:hover { background: var(--surface-2); }
.tkc__t { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tkc__t b { font-size: var(--t-sm); font-weight: 600; overflow-wrap: anywhere; }
.tkc__t small { font-size: var(--t-xs); color: var(--text-3); }
```

- [ ] **Step 5: Verificar (QA contra el dev de Gerardo)**

Run: `npm test && npm run lint && npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | grep -v "npm notice"`.
QA `browser-automation`:
1. Sin tickets activos: ningún usuario ve el globito.
2. Felipe crea un ticket de QA → login `maxi`: globito "1"; clic → desplegable con el título y "Vence…"; clic en el ítem → tarjeta.
3. Maxi entrega (link `https://www.dropbox.com/s/qa`) → **doble clic** en "Entregar para revisión": un solo evento `entrega` en la conversación → Maxi ya no tiene globito; login `felipe`: globito "1" (Admin ve todos los en revisión); login `pedro`: sin globito (no es suyo).
4. Escape y clic afuera cierran el desplegable. Mobile 390: el desplegable no se sale de la pantalla.
5. Cancelar/terminar el ticket de QA (Felipe devuelve → Felipe cancela).

- [ ] **Step 6: Commit**

```bash
git add components/tickets/ContadorTickets.tsx components/layout/BarraSuperior.tsx "app/(app)/layout.tsx" styles/app.css
git commit -m "feat(tickets): contador 'Lo que te toca' en la barra superior

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: QA del ciclo completo, documentación y cierre

> **La ejecuta el controlador.**

**Files:**
- Modify: `planeacion/avances.md`

- [ ] **Step 1: Suites**

Run: `npm test` → PASS. `npm run test:seguridad` → 23/23. `npm run test:tickets` → 30/30. `npm run lint` → sin errores. `npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | grep -v "npm notice"` → sin salida.

- [ ] **Step 2: QA de navegador del ciclo completo (spec §8.3), contra el dev de Gerardo**

Felipe crea (partido de esta semana) → chip 🔴 en `/calendario` → Maxi entrega con link → 🟡 → Felipe devuelve "Cambiá el fondo" → 🔴 → Maxi entrega de nuevo → 🟡 → Felipe aprueba → 🟢 → Maxi marca publicado → ✅. En cada paso: color y texto del chip, globito de cada uno, conversación (6 eventos + autores + horas UY). Además: Pedro crea uno → Felipe (Admin) lo aprueba; Pedro no ve "Aprobar" en el de Felipe; Alexis no ve botones ni caja de comentario. Desktop 1280 + mobile 390 + tema oscuro, 0 errores de consola. Al final, **cancelar** los tickets de QA que no estén publicados.

- [ ] **Step 3: `avances.md`**

Registrar en §4 (Sesión 12): qué se construyó, migración 0025 (quién la aplicó), tests (unitarios / seguridad / tickets), QA, tickets de QA que quedaron en la base (se borran con `scripts/limpiar-tickets.sql` al entregar), y en §5 pasar "Tickets de diseño" a "✅ HECHO — falta `git push`". Si algo falló en el camino, anotarlo en §10b en el momento.

- [ ] **Step 4: Commit**

```bash
git add planeacion/avances.md
git commit -m "avances: tickets de diseño implementados y verificados

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Avisar a Gerardo** que haga `git push`, y después verificar en producción (login real, un ticket de QA de punta a punta, y cancelarlo).
