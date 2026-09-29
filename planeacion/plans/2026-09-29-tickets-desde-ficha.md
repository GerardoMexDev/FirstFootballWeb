# Tickets de diseño desde la ficha del jugador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear tickets de diseño atados a una fecha (cumpleaños, aniversarios, "Otra fecha") desde la ficha del jugador, con el mismo ciclo que los de partido, visibles en la ficha, la pantalla Tickets, el globito y el Calendario general.

**Architecture:** La migración 0028 suma `fecha_evento` + `motivo` a `tickets` (partido **o** fecha), recalcula `fecha_limite`/`partido_eliminado` en `tickets_vista` y agrega la RPC `ticket_crear_evento`. El front suma lógica pura testeada (`proximasFechas`, `textoEvento`, `ticketsPorDia`, `alertasPorTicket`), un bloque `TicketsJugador` en las dos fichas (vía un "slot" opcional), el caso "evento" en el panel del ticket y chips de ticket en el Calendario general.

**Tech Stack:** Postgres 17 / Supabase (RLS, `security definer`), `pg` para tests de base con ROLLBACK (`npm run test:tickets`), Next.js 14 App Router, React 18, TypeScript, Luxon, `node --test`.

**Spec:** `planeacion/specs/2026-09-29-tickets-desde-ficha.md`

## Global Constraints

- CSS nuevo SOLO en `styles/app.css` con tokens; nunca `styles/demo.css`.
- Módulos de `lib/` con tests: solo imports de paquetes o `import type` (`@/` no resuelve en `node --test`; los tests importan `./x.ts`).
- Cabecera de documentación en todo archivo nuevo que no sea test ("Football First. Creado 2026-09-29.").
- WCAG 2.2 AA: labels asociados, foco visible, errores en `role="alert"`, contraste ≥ 4.5:1.
- Textos exactos: botón "Crear ticket de diseño"; leyenda "¿Para qué fecha?"; opción "Otra fecha"; label "Motivo"; placeholder "Convocado a la selección: Uruguay vs Brasil"; label "¿Qué hay que hacer?"; botón "Crear ticket"; botón "Ver jugador"; errores de la base: "Solo el Administrador o el Community Manager pueden crear tickets.", "Escribí el motivo (hasta 120 caracteres).", "La fecha del evento no puede ser anterior a hoy.", "Ese jugador no está en el servicio de Contenido.".
- Título del ticket: `Contenido — <apodo o nombre> · <motivo> (<d>/<m>)`.
- Fecha límite = fecha del evento − `ticket_dias_anticipacion()` (2).
- Las migraciones las aplica **Gerardo** (SQL Editor). Claude las prueba en transacción con ROLLBACK y verifica después con lecturas reales (`select('col').limit(1)`, exigir `data` no nulo — ver §10b).
- NUNCA `npm run build`/`next start`. QA con `npx next dev -p 3100` y al terminar `TaskStop` + matar el hijo (`*next*dev*-p*3100*`).
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nunca `git push`.

## Review Focus

1. **Jugador sin ninguna fecha de Contenido cargada:** el formulario muestra solo "Otra fecha" (no queda vacío ni roto). → test de `proximasFechas` con todo `null` (Task 2) + QA.
2. **Motivo con solo espacios o de 121 caracteres:** la base lo rechaza con "Escribí el motivo (hasta 120 caracteres)." y el formulario lo muestra. → tests de base (Task 1).
3. **Ticket de fecha cancelado:** no aparece como chip en el Calendario general ni en el bloque de la ficha. → test de `ticketsPorDia` (Task 2) + `listarPorJugador` excluye cancelados (Task 2).
4. **Doble clic en "Crear ticket":** crea uno solo (botón deshabilitado mientras envía). → QA (Task 5).
5. **Ticket de fecha visto desde la lista "Lo que te toca" del Admin/CM:** no aparece como "huérfano" (antes: `partido_id` nulo = partido borrado). → test de base `partido_eliminado = false` (Task 1) + test de `pendientesDe` (Task 2).

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/0028_tickets_evento.sql` (nuevo) | Columnas, checks, vista, RPC `ticket_crear_evento` |
| `scripts/tickets.test.mjs` (mod) | Tests de base de 0028 (ROLLBACK) |
| `lib/supabase/tipos-db.ts` (regenerado) | Tipos de la base |
| `lib/tickets/tipos.ts` (mod) | `fechaEvento`, `motivo` en `ResumenTicket`; `jugadorSoloContenido` en `DetalleTicket` |
| `lib/repositorios/repositorio-tickets.ts` (mod) | Columnas nuevas; `listarPorJugador`, `listarEventosEntre` |
| `lib/tickets/acciones.ts` (mod) | `crearTicketEvento` |
| `lib/jugadores/datos-contenido.ts` (mod) + test | `ProximaFecha`, `proximasFechas` |
| `lib/jugadores/cargar-ficha-contenido.ts` (mod) | Usa `proximasFechas`; suma `ticketsJugador` |
| `lib/jugadores/cargar-ficha.ts` (mod) | Suma `ticketsJugador` |
| `lib/tickets/cargar-tickets-jugador.ts` (nuevo) | Bundle del bloque de tickets de la ficha |
| `lib/tickets/vencimiento.ts` (mod) + test | `textoEvento` |
| `lib/tickets/estados.ts` (mod) + test | `ticketsPorDia`, `alertasPorTicket` |
| `components/tickets/TicketsJugador.tsx` (nuevo) | Bloque "Tickets de diseño" de la ficha |
| `components/tickets/CrearTicketEvento.tsx` (nuevo) | Formulario de creación |
| `components/jugadores/FichaJugador.tsx`, `FichaContenido.tsx` (mod) | Slot opcional `tickets` |
| `components/paneles/PanelJugador.tsx`, `PanelJugadorContenido.tsx` (mod) | Pasan `<TicketsJugador>` |
| `components/tickets/PanelTicket.tsx` (mod) | Caso evento: texto + "Ver jugador" |
| `components/calendario/Calendario.tsx` (mod) | Chips de tickets por día |
| `app/(app)/calendario-general/page.tsx` (mod) | Lee tickets de evento + alertas |
| `styles/app.css` (mod) | Estilos del formulario |

---

### Task 1: Migración 0028 + tests de base

**Files:**
- Create: `supabase/migrations/0028_tickets_evento.sql`
- Modify: `scripts/tickets.test.mjs` (antes de la línea final `export { … }`)

**Interfaces:**
- Produces: columnas `tickets.fecha_evento date`, `tickets.motivo text`; `tickets_vista` + `fecha_evento`, `motivo`, `jugador_solo_contenido`; RPC `ticket_crear_evento(p_jugador uuid, p_fecha date, p_motivo text, p_nota text) returns uuid`.

- [ ] **Step 1: Tests de base (fallan: la función no existe)**

En `scripts/tickets.test.mjs`, antes de `export { enTransaccion, … }`, agregar:

```js
// ═════════════ 0028: tickets de fecha (sin partido), desde la ficha del jugador ═════════════

const MIGRACION_0028 = readFileSync(new URL('../supabase/migrations/0028_tickets_evento.sql', import.meta.url), 'utf8')
  .replace(/^\s*begin;\s*$/m, '')
  .replace(/^\s*commit;\s*$/m, '');
let aplicada0028 = false;
before(async () => {
  const { rows } = await c.query(`select to_regprocedure('public.ticket_crear_evento(uuid,date,text,text)') is not null as ok`);
  aplicada0028 = rows[0].ok;
  const j = await c.query(`select id from jugadores where activo and servicio_contenido order by nombre limit 1`);
  ids.jugadorContenido = j.rows[0].id;
});

/** Como enTransaccion, aplicando 0028 adentro si todavía no está en la base. */
async function enTransaccion0028(fn) {
  await c.query('begin');
  try {
    if (!aplicada) await c.query(MIGRACION);
    if (!aplicada0028) await c.query(MIGRACION_0028);
    await fn(c);
  } finally {
    await c.query('rollback');
  }
}

const HOY_UY = `(now() at time zone 'America/Montevideo')::date`;

test('0028: Admin crea un ticket de fecha; título, fecha límite y no-huérfano', () =>
  enTransaccion0028(async (cl) => {
    await como(cl, ids.felipe);
    const { rows } = await cl.query(
      `select ticket_crear_evento($1, ${HOY_UY} + 10, 'Cumpleaños', 'Diseño del cumple') id`,
      [ids.jugadorContenido],
    );
    const v = await cl.query(
      `select titulo, fecha_evento, motivo, fecha_limite, partido_eliminado, partido_id, estado,
              (fecha_evento - fecha_limite) as anticipacion, ${HOY_UY} + 10 as esperado
       from tickets_vista where id = $1`,
      [rows[0].id],
    );
    const t = v.rows[0];
    assert.match(t.titulo, /^Contenido — .+ · Cumpleaños \(\d{1,2}\/\d{1,2}\)$/);
    assert.equal(t.motivo, 'Cumpleaños');
    assert.equal(t.anticipacion, 2);
    assert.equal(t.partido_eliminado, false);
    assert.equal(t.partido_id, null);
    assert.equal(t.estado, 'pendiente');
    assert.equal(t.fecha_evento.toISOString(), t.esperado.toISOString());
    const h = await cl.query(`select tipo from tickets_historial_vista where ticket_id = $1`, [rows[0].id]);
    assert.deepEqual(h.rows.map((x) => x.tipo), ['creado']);
  }));

test('0028: el CM también crea; Diseñador y Prueba no (42501)', () =>
  enTransaccion0028(async (cl) => {
    await como(cl, ids.pedro);
    await cl.query(`select ticket_crear_evento($1, ${HOY_UY} + 3, 'Convocado a la selección', 'Pieza de convocatoria')`, [ids.jugadorContenido]);
    for (const quien of [ids.maxi, ids.alexis]) {
      await como(cl, quien);
      const e = await debeFallar(
        cl,
        `select ticket_crear_evento($1, ${HOY_UY} + 3, 'Cumpleaños', 'x')`,
        [ids.jugadorContenido],
        /Solo el Administrador o el Community Manager pueden crear tickets\./,
      );
      assert.equal(e.code, '42501');
    }
  }));

test('0028: fecha pasada, motivo vacío o largo, nota vacía → error', () =>
  enTransaccion0028(async (cl) => {
    await como(cl, ids.felipe);
    await debeFallar(cl, `select ticket_crear_evento($1, ${HOY_UY} - 1, 'Cumpleaños', 'x')`, [ids.jugadorContenido], /La fecha del evento no puede ser anterior a hoy\./);
    await debeFallar(cl, `select ticket_crear_evento($1, null, 'Cumpleaños', 'x')`, [ids.jugadorContenido], /La fecha del evento no puede ser anterior a hoy\./);
    await debeFallar(cl, `select ticket_crear_evento($1, ${HOY_UY} + 1, '   ', 'x')`, [ids.jugadorContenido], /Escribí el motivo \(hasta 120 caracteres\)\./);
    await debeFallar(cl, `select ticket_crear_evento($1, ${HOY_UY} + 1, repeat('a', 121), 'x')`, [ids.jugadorContenido], /Escribí el motivo \(hasta 120 caracteres\)\./);
    await debeFallar(cl, `select ticket_crear_evento($1, ${HOY_UY} + 1, 'Cumpleaños', '  ')`, [ids.jugadorContenido], /Escribí qué hay que hacer\./);
    // hoy mismo sí se puede
    await cl.query(`select ticket_crear_evento($1, ${HOY_UY}, 'Cumpleaños', 'hoy')`, [ids.jugadorContenido]);
  }));

test('0028: jugador sin Contenido o inactivo → error', () =>
  enTransaccion0028(async (cl) => {
    await comoDueno(cl);
    await cl.query(`update jugadores set servicio_contenido = false where id = $1`, [ids.jugadorContenido]);
    await como(cl, ids.felipe);
    await debeFallar(cl, `select ticket_crear_evento($1, ${HOY_UY} + 1, 'Cumpleaños', 'x')`, [ids.jugadorContenido], /Ese jugador no está en el servicio de Contenido\./);
    await comoDueno(cl);
    await cl.query(`update jugadores set servicio_contenido = true, activo = false where id = $1`, [ids.jugadorContenido]);
    await como(cl, ids.felipe);
    await debeFallar(cl, `select ticket_crear_evento($1, ${HOY_UY} + 1, 'Cumpleaños', 'x')`, [ids.jugadorContenido], /Ese jugador no está en el servicio de Contenido\./);
  }));

test('0028: un ticket no puede tener partido y fecha a la vez; fecha y motivo van juntos', () =>
  enTransaccion0028(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await comoDueno(cl);
    await debeFallar(
      cl,
      `insert into tickets (partido_id, jugador_id, titulo, nota, creado_por, fecha_evento, motivo)
       values ($1, $2, 't', 'n', $3, current_date, 'Cumpleaños')`,
      [p, ids.jugadorMd, ids.felipe],
      /tickets_partido_o_fecha/,
    );
    await debeFallar(
      cl,
      `insert into tickets (jugador_id, titulo, nota, creado_por, fecha_evento) values ($1, 't', 'n', $2, current_date)`,
      [ids.jugadorMd, ids.felipe],
      /tickets_fecha_con_motivo/,
    );
  }));

test('0028: ciclo completo sobre un ticket de fecha (entregar → aprobar → publicar)', () =>
  enTransaccion0028(async (cl) => {
    await como(cl, ids.felipe);
    const { rows } = await cl.query(`select ticket_crear_evento($1, ${HOY_UY} + 5, 'Cumpleaños', 'cumple') id`, [ids.jugadorContenido]);
    const id = rows[0].id;
    await como(cl, ids.maxi);
    await cl.query(`select ticket_entregar($1, 'https://www.dropbox.com/s/cumple')`, [id]);
    await como(cl, ids.felipe);
    await cl.query(`select ticket_aprobar($1)`, [id]);
    await como(cl, ids.maxi);
    await cl.query(`select ticket_publicar($1)`, [id]);
    const v = await cl.query(`select estado from tickets_vista where id = $1`, [id]);
    assert.equal(v.rows[0].estado, 'publicado');
  }));

test('0028: la vista sigue sin leerse sin sesión y la función no la ejecuta anon', () =>
  enTransaccion0028(async (cl) => {
    await comoAnon(cl);
    await debeFallar(cl, `select ticket_crear_evento($1, current_date + 1, 'x', 'x')`, [ids.jugadorContenido], /permission denied/);
    await cl.query('savepoint s');
    try {
      const { rows } = await cl.query(`select * from tickets_vista`);
      assert.equal(rows.length, 0);
    } catch (e) {
      assert.match(e.message, /permission denied/);
    }
    await cl.query('rollback to savepoint s');
  }));
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npm run test:tickets 2>&1 | grep -E "^ℹ (pass|fail)|not ok|ENOENT" | head`
Expected: falla por `ENOENT` (no existe `0028_tickets_evento.sql`).

- [ ] **Step 3: La migración**

`supabase/migrations/0028_tickets_evento.sql`:

```sql
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
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `npm run test:tickets 2>&1 | grep -E "^ℹ (pass|fail)|not ok"`
Expected: `ℹ fail 0` (33 anteriores + 7 nuevos = 40).
Si la conexión `pg` da `ETIMEDOUT` (IPv6, §10b): anotarlo y avisar a Gerardo; no seguir sin estos tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0028_tickets_evento.sql scripts/tickets.test.mjs
git commit -m "feat(db): 0028 tickets de fecha (sin partido) — columnas, vista y ticket_crear_evento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Gerardo aplica la migración (PARADA)**

Pedirle a Gerardo: Supabase → SQL Editor → pegar `supabase/migrations/0028_tickets_evento.sql` → Run.
Verificar (lectura real):
```bash
node -e "
process.loadEnvFile('.secretos/.env');
const { createClient } = require('@supabase/supabase-js');
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
a.from('tickets_vista').select('id, fecha_evento, motivo, jugador_solo_contenido').limit(1).then(r => console.log(r.error ? 'NO: ' + JSON.stringify(r.error) : 'OK ' + JSON.stringify(r.data)));"
```
Expected: `OK [...]` (sin `PGRST` en error). Después: `npm run test:tickets` → `ℹ fail 0`.

---

### Task 2: Tipos, lecturas, acción y lógica pura

**Files:**
- Regenerate: `lib/supabase/tipos-db.ts` (`npm run tipos:db`)
- Modify: `lib/tickets/tipos.ts`, `lib/repositorios/repositorio-tickets.ts`, `lib/tickets/acciones.ts`
- Modify + Test: `lib/jugadores/datos-contenido.ts` / `.test.ts`; `lib/tickets/vencimiento.ts` / `.test.ts`; `lib/tickets/estados.ts` / `.test.ts`; `lib/tickets/permisos.test.ts`; `lib/tickets/pantalla.test.ts`
- Modify: `lib/jugadores/cargar-ficha-contenido.ts`

**Interfaces:**
- Consumes: Task 1 (columnas y RPC).
- Produces:
  - `ResumenTicket.fechaEvento: string | null`, `ResumenTicket.motivo: string | null`; `DetalleTicket.jugadorSoloContenido: boolean`.
  - `RepositorioTicketsSupabase.listarPorJugador(jugadorId: string): Promise<ResumenTicket[]>` (no cancelados, `creado_en` desc).
  - `RepositorioTicketsSupabase.listarEventosEntre(desdeIso: string, hastaIso: string): Promise<ResumenTicket[]>` (no cancelados, con `fecha_evento` en rango).
  - `crearTicketEvento(supabase, datos: { jugadorId: string; fecha: string; motivo: string; nota: string }): Promise<Resultado<string>>`.
  - `interface ProximaFecha { etiqueta: string; proximaIso: string }` y `proximasFechas(j: { fechaNacimiento: string | null; clubNombre: string | null; clubFechaFundacion: string | null; debutSeleccion: string | null; debut: string | null }, hoyUy: string): ProximaFecha[]` en `lib/jugadores/datos-contenido.ts`.
  - `textoEvento(motivo: string, fechaEvento: string): string` en `lib/tickets/vencimiento.ts` → "Cumpleaños · jue 1/10".
  - `ticketsPorDia(tickets: ResumenTicket[]): Record<string, ResumenTicket[]>` y `alertasPorTicket(pendientes: ResumenTicket[]): Record<string, string>` en `lib/tickets/estados.ts`.

- [ ] **Step 1: Regenerar tipos y sumar los campos (RED de tipos)**

Run: `npm run tipos:db` → Expected: `✅ lib/supabase/tipos-db.ts generado`, y `grep -c "ticket_crear_evento\|fecha_evento" lib/supabase/tipos-db.ts` ≥ 2.

En `lib/tickets/tipos.ts`, en `ResumenTicket` después de `creadoEn: string;`:
```ts
  /** Tickets de fecha (0028): yyyy-mm-dd del evento y qué se celebra. `null` en los de partido. */
  fechaEvento: string | null;
  motivo: string | null;
```
En `DetalleTicket` después de `estadoPartido: string | null;`:
```ts
  /** Para "Ver jugador": abre la ficha de Contenido si el jugador no es de Match Day. */
  jugadorSoloContenido: boolean;
```
Run: `npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | grep -v "npm notice"` → Expected: errores `TS2741 … 'fechaEvento'` en `repositorio-tickets.ts` y en los helpers de test (`estados.test.ts`, `permisos.test.ts`, `pantalla.test.ts`).

- [ ] **Step 2: Arreglar helpers de test y el repositorio**

En los tres helpers que arman `ResumenTicket` (`t(...)` de `estados.test.ts`, `r(...)` de `permisos.test.ts`, `tk(...)` de `pantalla.test.ts`), agregar `fechaEvento: null, motivo: null,` junto a `creadoEn`.

En `lib/repositorios/repositorio-tickets.ts`:
1. `interface FilaTicket` suma `fecha_evento: string | null; motivo: string | null; jugador_solo_contenido: boolean;`.
2. `type FilaResumen = Omit<FilaTicket, 'nota' | 'link_entrega' | 'estado_partido' | 'jugador_solo_contenido'>;`
3. `CAMPOS_RESUMEN` agrega `, fecha_evento, motivo`; `CAMPOS` agrega `, fecha_evento, motivo, jugador_solo_contenido`.
4. `aResumen` agrega `fechaEvento: f.fecha_evento, motivo: f.motivo,`.
5. En `obtenerDetalle`, el objeto `ticket` agrega `jugadorSoloContenido: fila.jugador_solo_contenido,`.
6. Después de `listarParaPantalla` agregar:

```ts
  /** Tickets no cancelados de un jugador (de partido y de fecha): bloque de la ficha (0028). */
  async listarPorJugador(jugadorId: string): Promise<ResumenTicket[]> {
    const { data, error } = await this.supabase
      .from('tickets_vista')
      .select(CAMPOS_RESUMEN)
      .eq('jugador_id', jugadorId)
      .neq('estado', 'cancelado')
      .order('creado_en', { ascending: false })
      .limit(50)
      .returns<FilaResumen[]>();
    if (error) throw new Error(`No se pudo leer los tickets del jugador: ${error.message}`);
    return (data ?? []).map(aResumen);
  }

  /** Tickets de fecha no cancelados con el evento entre dos días (Calendario general, 0028). */
  async listarEventosEntre(desdeIso: string, hastaIso: string): Promise<ResumenTicket[]> {
    const { data, error } = await this.supabase
      .from('tickets_vista')
      .select(CAMPOS_RESUMEN)
      .gte('fecha_evento', desdeIso)
      .lte('fecha_evento', hastaIso)
      .neq('estado', 'cancelado')
      .order('fecha_evento', { ascending: true })
      .returns<FilaResumen[]>();
    if (error) throw new Error(`No se pudo leer los tickets de fecha: ${error.message}`);
    return (data ?? []).map(aResumen);
  }
```

En `lib/tickets/acciones.ts`, después de `crearTicket`:

```ts
/** Ticket atado a una fecha (cumpleaños, aniversario, "Otra fecha") — 0028. `fecha` yyyy-mm-dd. */
export async function crearTicketEvento(
  supabase: Cliente,
  datos: { jugadorId: string; fecha: string; motivo: string; nota: string },
): Promise<Resultado<string>> {
  const { data, error } = await supabase.rpc('ticket_crear_evento', {
    p_jugador: datos.jugadorId,
    p_fecha: datos.fecha,
    p_motivo: datos.motivo,
    p_nota: datos.nota,
  });
  if (error) return { ok: false, mensaje: mensajeError(error) };
  return { ok: true, valor: data as string };
}
```

Run: `npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | grep -v "npm notice"` → Expected: sin salida.

- [ ] **Step 3: Tests de la lógica pura (RED)**

Agregar al final de `lib/jugadores/datos-contenido.test.ts` (y sumar `proximasFechas` al import existente de `./datos-contenido.ts`):

```ts
test('proximasFechas: las 4 fechas de Contenido, próxima ocurrencia y ordenadas', () => {
  const j = { fechaNacimiento: '1994-10-01', clubNombre: 'Tigres UANL', clubFechaFundacion: '1960-03-07', debutSeleccion: '2024-11-15', debut: '2011-09-04' };
  assert.deepEqual(proximasFechas(j, '2026-09-29'), [
    { etiqueta: 'Cumpleaños', proximaIso: '2026-10-01' },
    { etiqueta: 'Debut en selección', proximaIso: '2026-11-15' },
    { etiqueta: 'Aniversario de Tigres UANL', proximaIso: '2027-03-07' },
    { etiqueta: 'Debut profesional', proximaIso: '2027-09-04' },
  ]);
});

test('proximasFechas: sin fechas cargadas → lista vacía; club sin nombre → "Aniversario de club"', () => {
  const vacio = { fechaNacimiento: null, clubNombre: null, clubFechaFundacion: null, debutSeleccion: null, debut: null };
  assert.deepEqual(proximasFechas(vacio, '2026-09-29'), []);
  assert.deepEqual(proximasFechas({ ...vacio, clubFechaFundacion: '1899-05-14' }, '2026-09-29'), [
    { etiqueta: 'Aniversario de club', proximaIso: '2027-05-14' },
  ]);
});
```

Agregar al final de `lib/tickets/vencimiento.test.ts` (sumar `textoEvento` al import):

```ts
test('textoEvento: motivo · fecha corta', () => {
  assert.equal(textoEvento('Cumpleaños', '2026-10-01'), 'Cumpleaños · jue 1/10');
});
```

Agregar al final de `lib/tickets/estados.test.ts` (sumar `ticketsPorDia, alertasPorTicket` al import):

```ts
const ev = (id: string, fechaEvento: string | null, estado: ResumenTicket['estado']): ResumenTicket => ({
  ...t(id, null, estado), partidoEliminado: false, fechaEvento, motivo: fechaEvento ? 'Cumpleaños' : null,
});

test('ticketsPorDia: agrupa por fecha del evento; sin fecha o cancelados no entran', () => {
  const r = ticketsPorDia([ev('a', '2026-10-01', 'pendiente'), ev('b', '2026-10-01', 'aprobado'), ev('c', '2026-10-05', 'cancelado'), ev('d', null, 'pendiente')]);
  assert.deepEqual(Object.keys(r), ['2026-10-01']);
  assert.deepEqual(r['2026-10-01'].map((x) => x.id), ['a', 'b']);
});

test('alertasPorTicket: texto por id, solo tickets de fecha', () => {
  assert.deepEqual(alertasPorTicket([ev('a', '2026-10-01', 'pendiente'), ev('b', '2026-10-02', 'en_revision'), t('c', 'p1', 'pendiente')]), {
    a: 'Ticket pendiente',
    b: 'Para revisar',
  });
});
```

Agregar al final de `lib/tickets/permisos.test.ts`:

```ts
test('pendientesDe: un ticket de fecha (0028) no es huérfano — el CM no lo ve si está pendiente', () => {
  const deFecha: ResumenTicket = { ...r('f', 'pendiente', 'pedro', '2026-10-01'), partidoId: null, partidoEliminado: false, fechaEvento: '2026-10-03', motivo: 'Cumpleaños' };
  assert.deepEqual(pendientesDe('Community Manager', 'pedro', [deFecha]), []);
  assert.deepEqual(pendientesDe('Diseñador', 'maxi', [deFecha]).map((x) => x.id), ['f']);
});
```

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)|not ok"` → Expected: fallan los de `proximasFechas`, `textoEvento`, `ticketsPorDia`, `alertasPorTicket` (no existen); el de `pendientesDe` pasa (el código ya usa `partidoEliminado`).

- [ ] **Step 4: Implementar (GREEN)**

En `lib/jugadores/datos-contenido.ts`, al final:

```ts
/** Una fecha de Contenido con su próxima ocurrencia (>= hoy). */
export interface ProximaFecha {
  /** "Cumpleaños", "Aniversario de <club>", "Debut en selección", "Debut profesional". */
  etiqueta: string;
  /** YYYY-MM-DD de la próxima ocurrencia. */
  proximaIso: string;
}

/**
 * Próximas fechas de Contenido de un jugador, ordenadas. Las usan la ficha de Contenido y el
 * formulario de tickets de fecha (0028); la etiqueta es también el motivo del ticket.
 */
export function proximasFechas(
  j: { fechaNacimiento: string | null; clubNombre: string | null; clubFechaFundacion: string | null; debutSeleccion: string | null; debut: string | null },
  hoyUy: string,
): ProximaFecha[] {
  const crudas: Array<{ etiqueta: string; fecha: string | null }> = [
    { etiqueta: 'Cumpleaños', fecha: j.fechaNacimiento },
    { etiqueta: `Aniversario de ${j.clubNombre ?? 'club'}`, fecha: j.clubFechaFundacion },
    { etiqueta: 'Debut en selección', fecha: j.debutSeleccion },
    { etiqueta: 'Debut profesional', fecha: j.debut },
  ];
  return crudas
    .map((c) => ({ etiqueta: c.etiqueta, proximaIso: proximoAniversario(c.fecha, hoyUy) }))
    .filter((c): c is ProximaFecha => c.proximaIso !== null)
    .sort((a, b) => a.proximaIso.localeCompare(b.proximaIso));
}
```

En `lib/jugadores/cargar-ficha-contenido.ts`: borrar `interface ProximaFecha` y el bloque `crudas`/`proximas`; importar `proximasFechas` y `type ProximaFecha` de `@/lib/jugadores/datos-contenido`; re-exportar `export type { ProximaFecha };`; y `const proximas = proximasFechas(jugador, hoyUy);`.

En `lib/tickets/vencimiento.ts`, al final:

```ts
/** "Cumpleaños · jue 1/10": el evento de un ticket de fecha (0028). */
export function textoEvento(motivo: string, fechaEvento: string): string {
  return `${motivo} · ${fechaCortaUy(fechaEvento)}`;
}
```

En `lib/tickets/estados.ts`, al final:

```ts
/** `{ yyyy-mm-dd: tickets }` de los tickets de fecha no cancelados (Calendario general, 0028). */
export function ticketsPorDia(tickets: ResumenTicket[]): Record<string, ResumenTicket[]> {
  const porDia: Record<string, ResumenTicket[]> = {};
  for (const t of tickets) {
    if (!t.fechaEvento || t.estado === 'cancelado') continue;
    (porDia[t.fechaEvento] ??= []).push(t);
  }
  return porDia;
}

/** `{ ticketId: texto }` de la lucecita para tickets de fecha que esperan algo de quien mira. */
export function alertasPorTicket(pendientes: ResumenTicket[]): Record<string, string> {
  const alertas: Record<string, string> = {};
  for (const t of pendientes) {
    const texto = TEXTO_ALERTA[t.estado];
    if (t.fechaEvento && texto) alertas[t.id] = texto;
  }
  return alertas;
}
```

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)|not ok"` → Expected: `ℹ fail 0`.
Run: `npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | grep -v "npm notice"` → Expected: sin salida.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/tipos-db.ts lib/tickets lib/repositorios/repositorio-tickets.ts lib/jugadores/datos-contenido.ts lib/jugadores/datos-contenido.test.ts lib/jugadores/cargar-ficha-contenido.ts
git commit -m "feat(tickets): tipos, lecturas y lógica de tickets de fecha (0028)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Bloque "Tickets de diseño" en la ficha + formulario

**Files:**
- Create: `lib/tickets/cargar-tickets-jugador.ts`, `components/tickets/TicketsJugador.tsx`, `components/tickets/CrearTicketEvento.tsx`
- Modify: `lib/jugadores/cargar-ficha.ts`, `lib/jugadores/cargar-ficha-contenido.ts`, `components/jugadores/FichaJugador.tsx`, `components/jugadores/FichaContenido.tsx`, `components/paneles/PanelJugador.tsx`, `components/paneles/PanelJugadorContenido.tsx`, `styles/app.css`

**Interfaces:**
- Consumes: Task 2 (`listarPorJugador`, `crearTicketEvento`, `proximasFechas`, `ProximaFecha`); existentes: `sesionActual()`, `puedeCrear(cargo)`, `debeActuar(cargo, usuarioId, t)`, `TEXTO_ALERTA`, `PastillaEstado`, `AlertaTicket`, `usePanel().abrir`, `crearClienteNavegador()`.
- Produces: `interface TicketsJugadorBundle { tickets: ResumenTicket[]; ticketsError: boolean; usuario: { id: string; cargo: string } | null; proximas: ProximaFecha[]; hoyUy: string }`; `cargarTicketsJugador(supabase, jugador: JugadorFicha, hoyUy: string): Promise<TicketsJugadorBundle>`; `FichaJugadorBundle.ticketsJugador` y `FichaContenidoBundle.ticketsJugador`.

- [ ] **Step 1: Loader**

`lib/tickets/cargar-tickets-jugador.ts`:

```ts
/**
 * Datos del bloque "Tickets de diseño" de la ficha del jugador (0028): sus tickets no
 * cancelados, quién mira (para ofrecer "Crear") y sus próximas fechas de Contenido (para
 * el formulario). Si la lectura de tickets falla, `ticketsError` y no se ofrece crear
 * (mismo criterio que el panel del partido: evita duplicados a ciegas).
 *
 * Football First. Creado 2026-09-29.
 */
import { RepositorioTicketsSupabase } from '@/lib/repositorios/repositorio-tickets';
import { sesionActual } from '@/lib/sesion/sesion-actual';
import { proximasFechas, type ProximaFecha } from '@/lib/jugadores/datos-contenido';
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import type { JugadorFicha } from '@/lib/repositorios/tipos';
import type { ResumenTicket } from '@/lib/tickets/tipos';

export interface TicketsJugadorBundle {
  tickets: ResumenTicket[];
  ticketsError: boolean;
  usuario: { id: string; cargo: string } | null;
  proximas: ProximaFecha[];
  hoyUy: string;
}

export async function cargarTicketsJugador(
  supabase: ReturnType<typeof crearClienteServidor>,
  jugador: JugadorFicha,
  hoyUy: string,
): Promise<TicketsJugadorBundle> {
  let ticketsError = false;
  const [tickets, sesion] = await Promise.all([
    new RepositorioTicketsSupabase(supabase).listarPorJugador(jugador.id).catch((e) => {
      console.error('tickets (ficha del jugador):', e);
      ticketsError = true;
      return [] as ResumenTicket[];
    }),
    sesionActual(),
  ]);
  return {
    tickets,
    ticketsError,
    usuario: sesion ? { id: sesion.usuarioId, cargo: sesion.cargo } : null,
    proximas: proximasFechas(jugador, hoyUy),
    hoyUy,
  };
}
```

En `lib/jugadores/cargar-ficha.ts`: importar `cargarTicketsJugador` y `type TicketsJugadorBundle`; `FichaJugadorBundle` suma `ticketsJugador: TicketsJugadorBundle;`; calcular `const hoyUy = DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '';` antes del `Promise.all`, sumar `cargarTicketsJugador(supabase, jugador, hoyUy)` como último elemento del `Promise.all` (desestructurar `ticketsJugador`) y devolver `hoyUy` y `ticketsJugador`.

En `lib/jugadores/cargar-ficha-contenido.ts`: `FichaContenidoBundle` suma `ticketsJugador: TicketsJugadorBundle;`; antes del return `const ticketsJugador = await cargarTicketsJugador(supabase, jugador, hoyUy);` y devolverlo.

- [ ] **Step 2: Formulario `CrearTicketEvento`**

`components/tickets/CrearTicketEvento.tsx`:

```tsx
/**
 * "Crear ticket de diseño" desde la ficha del jugador (0028): se elige una de sus próximas
 * fechas de Contenido o "Otra fecha" (fecha + motivo a mano, p. ej. una convocatoria), y la
 * nota. La base valida todo (cargo, fecha no pasada, motivo, Contenido) y el mensaje se
 * muestra tal cual. Botón deshabilitado mientras envía (un doble clic crearía dos).
 *
 * Football First. Creado 2026-09-29.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ico } from '@/components/comunes/Ico';
import { usePanel } from '@/lib/paneles/use-panel';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import { crearTicketEvento } from '@/lib/tickets/acciones';
import { textoEvento } from '@/lib/tickets/vencimiento';
import type { ProximaFecha } from '@/lib/jugadores/datos-contenido';

const OTRA = 'otra';

export function CrearTicketEvento({
  jugadorId,
  jugadorNombre,
  proximas,
  hoyUy,
}: {
  jugadorId: string;
  jugadorNombre: string;
  proximas: ProximaFecha[];
  hoyUy: string;
}) {
  const router = useRouter();
  const { abrir } = usePanel();
  const [abierto, setAbierto] = useState(false);
  const [eleccion, setEleccion] = useState<string>(proximas.length ? '0' : OTRA);
  const [fecha, setFecha] = useState('');
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primerCampoRef = useRef<HTMLInputElement>(null);
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const yaAbierto = useRef(false);

  // Foco: al abrir va a la primera opción; al cancelar vuelve al botón que lo abrió.
  useEffect(() => {
    if (abierto) {
      yaAbierto.current = true;
      primerCampoRef.current?.focus();
    } else if (yaAbierto.current) {
      disparadorRef.current?.focus();
    }
  }, [abierto]);

  const esOtra = eleccion === OTRA;
  const elegida = esOtra ? null : proximas[Number(eleccion)];
  const fechaFinal = esOtra ? fecha : (elegida?.proximaIso ?? '');
  const motivoFinal = esOtra ? motivo : (elegida?.etiqueta ?? '');
  const listo = !!fechaFinal && !!motivoFinal.trim() && !!nota.trim();

  async function crear() {
    setEnviando(true);
    setError(null);
    const r = await crearTicketEvento(crearClienteNavegador(), { jugadorId, fecha: fechaFinal, motivo: motivoFinal, nota });
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
      <button ref={disparadorRef} type="button" className="btn btn--g btn--sm" onClick={() => setAbierto(true)}>
        Crear ticket de diseño
      </button>
    );
  }

  return (
    <div className="tkn tke">
      <fieldset className="tke__f">
        <legend>¿Para qué fecha?</legend>
        {proximas.map((p, i) => (
          <label key={p.etiqueta} className="tke__o">
            <input
              ref={i === 0 ? primerCampoRef : undefined}
              type="radio"
              name={`fecha-${jugadorId}`}
              value={String(i)}
              checked={eleccion === String(i)}
              onChange={() => setEleccion(String(i))}
            />
            {textoEvento(p.etiqueta, p.proximaIso)}
          </label>
        ))}
        <label className="tke__o">
          <input
            ref={proximas.length ? undefined : primerCampoRef}
            type="radio"
            name={`fecha-${jugadorId}`}
            value={OTRA}
            checked={esOtra}
            onChange={() => setEleccion(OTRA)}
          />
          Otra fecha
        </label>
      </fieldset>

      {esOtra && (
        <div className="tke__otra">
          <div className="campo">
            <label htmlFor={`fecha-otra-${jugadorId}`}>Fecha</label>
            <input id={`fecha-otra-${jugadorId}`} type="date" min={hoyUy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor={`motivo-${jugadorId}`}>Motivo</label>
            <input
              id={`motivo-${jugadorId}`}
              type="text"
              maxLength={120}
              placeholder="Convocado a la selección: Uruguay vs Brasil"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="campo">
        <label htmlFor={`nota-evento-${jugadorId}`}>¿Qué hay que hacer?</label>
        <textarea
          id={`nota-evento-${jugadorId}`}
          rows={3}
          maxLength={2000}
          placeholder={`Ej.: pieza para redes por el cumpleaños de ${jugadorNombre}`}
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
        <button type="button" className="btn btn--a btn--sm" disabled={enviando || !listo} onClick={crear}>
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

- [ ] **Step 3: Bloque `TicketsJugador`**

`components/tickets/TicketsJugador.tsx`:

```tsx
/**
 * Bloque "Tickets de diseño" de la ficha del jugador (0028): sus tickets abiertos (pastilla +
 * título + lucecita si le toca a quien mira; clic abre el ticket) y, para Admin/CM, el botón
 * de crear un ticket de fecha. Si no se pudieron leer los tickets, no se ofrece crear.
 *
 * Football First. Creado 2026-09-29.
 */
'use client';

import { PastillaEstado } from '@/components/tickets/PastillaEstado';
import { AlertaTicket } from '@/components/tickets/AlertaTicket';
import { CrearTicketEvento } from '@/components/tickets/CrearTicketEvento';
import { usePanel } from '@/lib/paneles/use-panel';
import { debeActuar, puedeCrear } from '@/lib/tickets/permisos';
import { TEXTO_ALERTA } from '@/lib/tickets/estados';
import type { TicketsJugadorBundle } from '@/lib/tickets/cargar-tickets-jugador';

export function TicketsJugador({
  jugadorId,
  jugadorNombre,
  datos,
}: {
  jugadorId: string;
  jugadorNombre: string;
  datos: TicketsJugadorBundle;
}) {
  const { abrir } = usePanel();
  const { tickets, ticketsError, usuario, proximas, hoyUy } = datos;
  const abiertos = tickets.filter((t) => t.estado !== 'publicado');

  return (
    <div className="bloque">
      <span className="label">Tickets de diseño</span>
      {ticketsError && <p className="meta">No pudimos cargar los tickets de este jugador. Recargá para crear uno.</p>}
      {abiertos.length > 0 && (
        <div className="tkj">
          {abiertos.map((t) => {
            const alerta = usuario && debeActuar(usuario.cargo, usuario.id, t) ? TEXTO_ALERTA[t.estado] : undefined;
            return (
              <button
                key={t.id}
                type="button"
                className="tkj__t"
                aria-label={`${t.titulo}. ${alerta ?? ''}`.trim()}
                onClick={() => abrir('ticket', t.id)}
              >
                <PastillaEstado estado={t.estado} />
                <span className="tkj__n">{t.titulo}</span>
                {alerta && <AlertaTicket texto={alerta} />}
              </button>
            );
          })}
        </div>
      )}
      {!ticketsError && !abiertos.length && <p className="meta">Sin tickets abiertos.</p>}
      {usuario && !ticketsError && puedeCrear(usuario.cargo) && (
        <CrearTicketEvento jugadorId={jugadorId} jugadorNombre={jugadorNombre} proximas={proximas} hoyUy={hoyUy} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Slot en las fichas y paneles**

`components/jugadores/FichaJugador.tsx`: sumar a las props `tickets,` y en el tipo `/** Bloque de tickets de diseño (solo en el panel; la página SSR no lo pasa). */ tickets?: React.ReactNode;`; renderizar `{tickets}` justo después de `<BotonesDropbox … />`.
`components/jugadores/FichaContenido.tsx`: igual, renderizando `{tickets}` justo después del `<div className="linea" …>` de identidad (antes de "Datos para contenido").
`components/paneles/PanelJugador.tsx`: importar `TicketsJugador` y pasar a `<FichaJugador … tickets={<TicketsJugador jugadorId={bundle.jugador.id} jugadorNombre={bundle.jugador.nombre} datos={bundle.ticketsJugador} />} />`.
`components/paneles/PanelJugadorContenido.tsx`: igual con `<FichaContenido … tickets={…} />`.

- [ ] **Step 5: CSS**

Agregar al final de `styles/app.css`:

```css
/* Tickets de diseño en la ficha del jugador y formulario de ticket de fecha (0028, 2026-09-29). */
.tkj { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.tkj__t { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; width: 100%; padding: 10px 12px; border-radius: var(--r-sm); background: var(--surface-2); text-align: left; cursor: pointer; }
.tkj__t:hover { background: var(--surface-3); }
.tkj__t:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.tkj__n { flex: 1; min-width: 0; font-size: var(--t-sm); font-weight: 600; overflow-wrap: anywhere; }
.tke__f { border: 0; padding: 0; margin: 0 0 14px; display: flex; flex-direction: column; gap: 8px; }
.tke__f legend { font-size: var(--t-sm); font-weight: 600; margin-bottom: 8px; }
.tke__o { display: flex; align-items: center; gap: 10px; min-height: 36px; font-size: var(--t-md); cursor: pointer; }
.tke__o input { width: 18px; height: 18px; accent-color: var(--accent); }
.tke__otra { display: grid; grid-template-columns: 180px 1fr; gap: 12px; }
@media (max-width: 620px) { .tke__otra { grid-template-columns: 1fr; } }
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | grep -v "npm notice"` → sin salida. `npm run lint 2>&1 | tail -1` → sin errores. `npm test 2>&1 | grep -E "^ℹ (pass|fail)"` → `fail 0`.

- [ ] **Step 7: Commit**

```bash
git add lib/tickets/cargar-tickets-jugador.ts components/tickets/TicketsJugador.tsx components/tickets/CrearTicketEvento.tsx lib/jugadores/cargar-ficha.ts lib/jugadores/cargar-ficha-contenido.ts components/jugadores/FichaJugador.tsx components/jugadores/FichaContenido.tsx components/paneles/PanelJugador.tsx components/paneles/PanelJugadorContenido.tsx styles/app.css
git commit -m "feat(tickets): bloque de tickets y crear ticket de fecha en la ficha del jugador

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Panel del ticket (evento) + Calendario general

**Files:**
- Modify: `components/tickets/PanelTicket.tsx`, `components/calendario/Calendario.tsx`, `app/(app)/calendario-general/page.tsx`

**Interfaces:**
- Consumes: Task 2 (`textoEvento`, `ticketsPorDia`, `alertasPorTicket`, `listarEventosEntre`, `jugadorSoloContenido`), `pendientesDeSesion()`.
- Produces: props nuevas de `Calendario`: `ticketsPorDia?: Record<string, ResumenTicket[]>`, `alertasPorTicket?: Record<string, string>`.

- [ ] **Step 1: Panel del ticket**

En `components/tickets/PanelTicket.tsx` importar `textoEvento` de `@/lib/tickets/vencimiento` (junto a `fechaHoraCortaUy`). Reemplazar el `<p className="meta" …>` de la fecha por:

```tsx
      <p className="meta" style={{ marginBottom: 24 }}>
        {ticket.fechaEvento && ticket.motivo
          ? textoEvento(ticket.motivo, ticket.fechaEvento)
          : ticket.partidoEliminado
            ? 'El partido ya no figura en la fuente de datos.'
            : ticket.inicioUtc
              ? `Partido: ${fechaHoraCortaUy(ticket.inicioUtc)} (hora Uruguay)`
              : 'Partido sin hora confirmada'}
        {ticket.creadoPorNombre ? ` · Lo pidió ${ticket.creadoPorNombre}` : ''}
      </p>
```

Y el bloque de botones "Abrir diseño / Ver partido" por:

```tsx
      {(ticket.linkEntrega || (ticket.partidoId && !ticket.partidoEliminado) || ticket.fechaEvento) && (
        <div className="linea" style={{ gap: 10, marginBottom: 24 }}>
          {ticket.linkEntrega && (
            <a href={ticket.linkEntrega} target="_blank" rel="noopener noreferrer" className="btn btn--g">
              Abrir diseño
            </a>
          )}
          {ticket.partidoId && !ticket.partidoEliminado && (
            <button type="button" className="btn btn--g" onClick={() => abrir('partido', ticket.partidoId!)}>
              Ver partido
            </button>
          )}
          {ticket.fechaEvento && (
            <button
              type="button"
              className="btn btn--g"
              onClick={() => abrir(ticket.jugadorSoloContenido ? 'jugador-contenido' : 'jugador', ticket.jugadorId)}
            >
              Ver jugador
            </button>
          )}
        </div>
      )}
```

- [ ] **Step 2: Calendario — chips de tickets por día**

En `components/calendario/Calendario.tsx`:
1. Import: `import type { ResumenTicket } from '@/lib/tickets/tipos';`.
2. Props: sumar `ticketsPorDia = {}, alertasPorTicket = {},` y en el tipo:
```ts
  /** Tickets de fecha por día (Calendario general, 0028). */
  ticketsPorDia?: Record<string, ResumenTicket[]>;
  /** `{ ticketId: texto }` de la lucecita para esos tickets. */
  alertasPorTicket?: Record<string, string>;
```
3. En el `map` de celdas, después de `const evs = porDia.get(c.fecha) ?? [];` agregar `const tks = ticketsPorDia[c.fecha] ?? [];` y cambiar `${evs.length ? 'celda--con' : ''}` por `${evs.length || tks.length ? 'celda--con' : ''}`.
4. Después del cierre del `{evs.map(...)}` (antes del `</div>` de la celda) agregar:

```tsx
              {tks.map((t) => (
                <button
                  key={`tk-${t.id}`}
                  type="button"
                  className={`ev ev--t ev--t-${t.estado}`}
                  onClick={() => abrir('ticket', t.id)}
                >
                  <small className="ev__tk">
                    {alertasPorTicket[t.id] ? (
                      <span className="tka__luz" aria-hidden="true" />
                    ) : (
                      <span aria-hidden="true">{META_ESTADO[t.estado].simbolo}</span>
                    )}{' '}
                    <span className="ev__w">{alertasPorTicket[t.id] ?? META_ESTADO[t.estado].corta}</span>
                  </small>
                  <b>{t.jugadorNombre}</b>
                  {t.motivo}
                </button>
              ))}
```

- [ ] **Step 3: Página del Calendario general**

En `app/(app)/calendario-general/page.tsx`:
1. Imports: `RepositorioTicketsSupabase` (`@/lib/repositorios/repositorio-tickets`), `ticketsPorDia, alertasPorTicket` (`@/lib/tickets/estados`), `pendientesDeSesion` (`@/lib/tickets/pendientes-de-sesion`).
2. Reemplazar el `Promise.all` por:

```tsx
  const supabase = crearClienteServidor();
  const repo = new RepositorioAgendaSupabase(supabase, 'agenda_contenido');
  const [eventosNota, eventos, ticketsFecha, pendientes] = await Promise.all([
    repo.listarEventosParaNotas(hoyUy),
    repo.listarEventos(`${anio - 1}-01-01`, `${anio + 2}-12-31`),
    // Tickets de fecha (0028). Si la lectura falla, el calendario se ve como antes.
    new RepositorioTicketsSupabase(supabase).listarEventosEntre(`${anio - 1}-01-01`, `${anio + 2}-12-31`).catch((e) => {
      console.error('tickets (calendario general):', e);
      return [];
    }),
    pendientesDeSesion(),
  ]);
```
(y quitar la creación previa de `repo` con `crearClienteServidor()` inline).
3. `<Calendario eventos={eventos} hoyUy={hoyUy} ticketsPorDia={ticketsPorDia(ticketsFecha)} alertasPorTicket={alertasPorTicket(pendientes)} />`.
4. Sumar a la cabecera del archivo: "Desde 2026-09-29 muestra además los tickets de diseño de fecha (0028)".

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | grep -v "npm notice"` → sin salida. `npm run lint 2>&1 | tail -1` → sin errores. `npm test 2>&1 | grep -E "^ℹ (pass|fail)"` → `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add components/tickets/PanelTicket.tsx components/calendario/Calendario.tsx "app/(app)/calendario-general/page.tsx"
git commit -m "feat(tickets): tickets de fecha en el panel del ticket y en el Calendario general

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: QA en navegador + avances

**Files:**
- Create (scratchpad, no se commitea): `qa-ficha-tickets.mjs`
- Modify: `planeacion/avances.md`

- [ ] **Step 1: Script de QA**

En el scratchpad, `qa-ficha-tickets.mjs`:

```js
// QA de tickets de fecha desde la ficha (dev :3100). Crea 2 tickets "QA —" y los cancela.
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Gerardo/Desktop/FirstUY/WebFirst/package.json');
const { createClient } = require('@supabase/supabase-js');
process.loadEnvFile('C:/Users/Gerardo/Desktop/FirstUY/WebFirst/.secretos/.env');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = 'http://localhost:3100';
const T = 180000;
const AGUIRRE = 'f507a3a4-a5fe-4779-8e1f-b611d72af6f8';

async function login(page, u) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill('#usuario', u);
  await page.fill('#pass', 'demo1234');
  await page.click('button[type=submit]');
  await page.waitForURL('**/partidos', { timeout: T });
}
async function ficha(page) {
  await page.goto(`${BASE}/jugadores?panel=jugador-contenido&id=${AGUIRRE}`);
  await page.waitForSelector('.panel.on h2', { timeout: T });
  await page.waitForTimeout(800);
}
async function accion(page, boton, campo, confirmar) {
  await page.getByRole('button', { name: boton, exact: true }).first().click();
  if (campo !== undefined) {
    await page.fill('#tk-campo', campo);
    await page.getByRole('button', { name: confirmar, exact: true }).last().click();
  }
  await page.waitForFunction(() => /Listo|agregado/i.test(document.querySelector('[role=status]')?.textContent ?? ''), null, { timeout: T });
}

export default async function run(page) {
  const r = { errores: [] };
  page.on('pageerror', (e) => r.errores.push(String(e)));

  // Felipe: crea por el cumpleaños (primera opción) con doble clic
  await login(page, 'felipe');
  await ficha(page);
  await page.getByRole('button', { name: 'Crear ticket de diseño' }).click();
  r.opciones = await page.$$eval('.tke__o', (ls) => ls.map((l) => l.textContent.trim()));
  await page.fill('textarea[id^="nota-evento-"]', 'QA — cumpleaños desde la ficha (se cancela)');
  await page.getByRole('button', { name: 'Crear ticket', exact: true }).dblclick();
  await page.waitForFunction(() => location.search.includes('panel=ticket'), null, { timeout: T });
  const id1 = new URL(page.url()).searchParams.get('id');
  await page.waitForSelector('.panel.on h2', { timeout: T });
  r.t1_titulo = await page.locator('.panel.on h2').textContent();
  r.t1_meta = await page.locator('.panel.on .meta').first().textContent();
  r.t1_verJugador = await page.getByRole('button', { name: 'Ver jugador' }).count();
  const { count: creados } = await admin.from('tickets').select('id', { count: 'exact', head: true }).ilike('nota', 'QA — cumpleaños desde la ficha%');
  r.t1_unoSolo = creados === 1;

  // Pedro: "Otra fecha" con el ejemplo de la selección
  await login(page, 'pedro');
  await ficha(page);
  await page.getByRole('button', { name: 'Crear ticket de diseño' }).click();
  await page.getByLabel('Otra fecha').check();
  const d = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
  await page.fill('input[type=date]', d);
  await page.fill('input[id^="motivo-"]', 'Convocado a la selección: Uruguay vs Brasil');
  await page.fill('textarea[id^="nota-evento-"]', 'QA — otra fecha (se cancela)');
  await page.getByRole('button', { name: 'Crear ticket', exact: true }).click();
  await page.waitForFunction(() => location.search.includes('panel=ticket'), null, { timeout: T });
  const id2 = new URL(page.url()).searchParams.get('id');
  r.t2_titulo = await page.locator('.panel.on h2').textContent();

  // Maxi: bloque de la ficha con lucecita, pantalla Tickets, Calendario general; entrega el 1
  await login(page, 'maxi');
  await ficha(page);
  r.maxi_bloque = await page.$$eval('.tkj__t', (bs) => bs.map((b) => b.getAttribute('aria-label')));
  r.maxi_sinCrear = await page.getByRole('button', { name: 'Crear ticket de diseño' }).count();
  await page.goto(`${BASE}/tickets`);
  await page.waitForSelector('#v-tickets', { timeout: T });
  r.maxi_pantalla = await page.$$eval('.tkf', (fs) => fs.map((f) => f.getAttribute('aria-label')).filter((l) => l.includes('Contenido —')));
  await page.goto(`${BASE}/calendario-general`);
  await page.waitForSelector('.cal__grid', { timeout: T });
  let chip = 0;
  for (let i = 0; i < 3 && !chip; i++) {
    chip = await page.locator('button.ev--t').count();
    if (!chip) await page.getByRole('button', { name: 'Mes siguiente' }).click();
  }
  r.maxi_chipCalendario = chip ? await page.locator('button.ev--t').first().textContent() : null;
  await page.goto(`${BASE}/tickets?panel=ticket&id=${id1}`);
  await page.waitForSelector('.panel.on h2', { timeout: T });
  await accion(page, 'Entregar', 'https://www.dropbox.com/s/qa-cumple', 'Entregar para revisión');

  // Felipe ve "Para revisar"; Alexis no ve el botón
  await login(page, 'felipe');
  await ficha(page);
  r.felipe_bloque = await page.$$eval('.tkj__t', (bs) => bs.map((b) => b.getAttribute('aria-label')));
  await page.getByRole('button', { name: 'Ver jugador' }).count();
  await login(page, 'alexis');
  await ficha(page);
  r.alexis_crear = await page.getByRole('button', { name: 'Crear ticket de diseño' }).count();

  // Celular
  await login(page, 'felipe');
  await page.setViewportSize({ width: 390, height: 844 });
  await ficha(page);
  await page.getByRole('button', { name: 'Crear ticket de diseño' }).click();
  await page.getByLabel('Otra fecha').check();
  r.movil_scrollX = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await page.locator('.panel.on').screenshot({ path: 'ficha-ticket-390.png' });
  await page.setViewportSize({ width: 1280, height: 900 });

  // Limpieza: devolver el 1 y cancelar ambos
  await page.goto(`${BASE}/tickets?panel=ticket&id=${id1}`);
  await page.waitForSelector('.panel.on h2', { timeout: T });
  await accion(page, 'Devolver', 'QA', 'Devolver al Diseñador');
  await accion(page, 'Cancelar ticket', 'QA', 'Cancelar ticket');
  await page.goto(`${BASE}/tickets?panel=ticket&id=${id2}`);
  await page.waitForSelector('.panel.on h2', { timeout: T });
  await accion(page, 'Cancelar ticket', 'QA', 'Cancelar ticket');
  const { data: fin } = await admin.from('tickets').select('id, estado').in('id', [id1, id2]);
  r.estados_finales = fin.map((x) => x.estado);
  return r;
}
```

- [ ] **Step 2: Correr**

Levantar `npx next dev -p 3100` (segundo plano), esperar 200 en `/login`, correr
`node C:/Users/Gerardo/.claude/skills/browser-automation/browser.mjs http://localhost:3100/login --script qa-ficha-tickets.mjs` (desde el scratchpad).

Expected:
- `errores: []`; `opciones` incluye "Cumpleaños · jue 1/10" (o la próxima ocurrencia) y termina en "Otra fecha".
- `t1_titulo` = "Contenido — Rodrigo Aguirre · Cumpleaños (1/10)"; `t1_meta` empieza con "Cumpleaños · "; `t1_verJugador: 1`; `t1_unoSolo: true`.
- `t2_titulo` empieza con "Contenido — Rodrigo Aguirre · Convocado a la selección: Uruguay vs Brasil (".
- `maxi_bloque` tiene 2 filas terminadas en "Ticket pendiente"; `maxi_sinCrear: 0`; `maxi_pantalla` con 2 filas; `maxi_chipCalendario` contiene "Rodrigo Aguirre" o "Aguirre".
- `felipe_bloque`: la del cumpleaños termina en "Para revisar".
- `alexis_crear: 0`; `movil_scrollX: false`; `estados_finales` = `['cancelado','cancelado']`.
Mirar `ficha-ticket-390.png`. Si algo falla: arreglar en la Task dueña, re-correr tests/lint/tsc, commit `fix(tickets): …`, repetir.

- [ ] **Step 3: Apagar el dev** (`TaskStop` + `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*next*dev*-p*3100*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`).

- [ ] **Step 4: Avances**

En `planeacion/avances.md`, al final de la sección de la pantalla Tickets, agregar:

```markdown

### 🎫 Tickets desde la ficha del jugador (fecha, sin partido) — ✅ HECHO en rama `tickets-ficha` (2026-09-29, Sesión 14)
- Spec/plan `2026-09-29-tickets-desde-ficha`. Migración 0028 (aplicada por Gerardo): `fecha_evento` + `motivo`, `ticket_crear_evento`, vista con `fecha_limite` por fecha y `partido_eliminado` corregido. 7 tests de base nuevos.
- Ficha (las dos): bloque "Tickets de diseño" + "Crear ticket de diseño" (próximas fechas de Contenido u "Otra fecha"). Panel del ticket: evento + "Ver jugador". Calendario general: chip del ticket en el día.
- QA :3100 con los 4 usuarios OK; tickets de QA cancelados.
```

- [ ] **Step 5: Commit**

```bash
git add planeacion/avances.md
git commit -m "avances: tickets desde la ficha del jugador hechos y verificados

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
