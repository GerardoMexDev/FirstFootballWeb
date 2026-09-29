# Pantalla "Tickets" + barra inferior en celular — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pantalla `/tickets` (contadores Vencidos / Por vencer / Al día + filtros + lista que abre el panel del ticket) y navegación con 5 secciones, con barra de pestañas inferior en celular.

**Architecture:** Server Component `/tickets` lee una sola vez (`listarParaPantalla`) y pasa la lista ya filtrada por cargo a un Client Component (`SeccionTickets`) que filtra en el navegador. La lógica (urgencia, conteos, filtros, "hace cuánto", quién ve qué) vive en un módulo puro con tests (`lib/tickets/pantalla.ts`). Las secciones de la navegación se definen una vez (`lib/navegacion/secciones.ts`) y las usan `Nav` (arriba, > 900 px) y `BarraInferior` (abajo, ≤ 900 px).

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Supabase (supabase-js), Luxon, `node --test` con `--experimental-strip-types` (vía `npm test`), CSS plano en `styles/app.css`.

**Spec:** `planeacion/specs/2026-09-29-pantalla-tickets.md`

## Global Constraints

- CSS nuevo SOLO en `styles/app.css`, con tokens (`--tk-*`, `--text*`, `--surface*`); NUNCA tocar `styles/demo.css`. Tema oscuro = `[data-theme="dark"]` (los tokens `--tk-*` ya lo cubren).
- Módulos de `lib/` con tests: solo imports de paquetes (`luxon`) o `import type` — `@/` NO resuelve en `node --test` (los tests importan con `./archivo.ts`).
- Documentación: comentario de cabecera en todo archivo nuevo (qué es, por qué, "Football First. Creado 2026-09-29."); los tests no llevan cabecera (convención del repo).
- WCAG 2.2 AA: foco visible, contraste ≥ 4.5:1 en texto, objetivo táctil ≥ 44 px en la barra inferior, la urgencia no depende solo del color.
- Textos visibles en español rioplatense, exactos como en este plan.
- "Por vencer" = fecha límite en 0, 1 o 2 días (`DIAS_POR_VENCER = 2`). Cerrados = `publicado`, `cancelado`. Abiertos = `pendiente`, `en_revision`, `aprobado`.
- Cerrados: solo los creados en los últimos 60 días; tope 300 filas.
- Quién ve qué: Administrador y Diseñador → todos; Community Manager → `creadoPor === usuarioId`; Prueba → nada y sin pestaña (redirigir `/tickets` → `/partidos`).
- NUNCA correr `npm run build` / `next start` (pisa el `.next` del dev de Gerardo). QA con `npx next dev -p 3100` y, al terminar, `TaskStop` + matar el hijo (`Get-CimInstance Win32_Process` con `*next*dev*-p*3100*` → `Stop-Process`).
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nunca `git push` (lo hace Gerardo).

## Review Focus

1. **Ticket sin nombre de creador** (`creadoPorNombre: null`, p. ej. perfil desactivado): la fila dice "Creado por alguien del equipo", nunca "Creado por null". → test de `textoCreado` en Task 2.
2. **Ticket con fecha límite hoy exacto / hace 1 día / en 3 días** (bordes de "por vencer"): 0 → por vencer, −1 → vencido, 3 → al día. → tests de `urgencia` en Task 2.
3. **Contador tocado + cambiar a "Cerrados"**: no puede quedar la lista vacía por un filtro de urgencia invisible; tocar un chip de estado limpia la urgencia. → test de `filtrarPantalla` (urgencia ignora cerrados) en Task 2 + chequeo en QA (Task 5).
4. **Ancho 901–1100 px (notebook chica) con 5 opciones en la nav de arriba**: sin desborde de la barra. → medición y regla condicional en Task 4.
5. **Barra inferior tapando contenido o el toast** en celular (última tarjeta, toast "Listo"): margen inferior suficiente y toast por encima. → chequeo en QA (Task 5).

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `lib/tickets/tipos.ts` (mod) | `ResumenTicket` gana `creadoEn` |
| `lib/repositorios/repositorio-tickets.ts` (mod) | `creado_en` en las lecturas + `listarParaPantalla(desdeIso)` |
| `lib/tickets/pantalla.ts` (nuevo) + `.test.ts` | Lógica pura de la pantalla: `visiblesPara`, `urgencia`, `contarUrgencias`, `filtrarPantalla`, `haceCuanto`, `textoCreado` |
| `components/tickets/FilaTicket.tsx` (nuevo) | Una fila de la lista |
| `components/tickets/SeccionTickets.tsx` (nuevo) | Estado de filtros + contadores + chips + lista (cliente) |
| `app/(app)/tickets/page.tsx` (nuevo) | Server Component: sesión, redirección de Prueba, lectura, error |
| `lib/navegacion/secciones.ts` (nuevo) | Lista única de secciones + `seccionesPara(cargo)` + `esSeccionActiva` |
| `components/comunes/Ico.tsx` (mod) | Ícono nuevo `lista` (acordado en la revisión de la spec) |
| `components/layout/Nav.tsx` (mod) | Usa `secciones.ts`; recibe `cargo` |
| `components/layout/BarraInferior.tsx` (nuevo) | Barra de pestañas inferior (≤ 900 px) |
| `components/layout/BarraSuperior.tsx` (mod) | Pasa `cargo` a `Nav` |
| `app/(app)/layout.tsx` (mod) | Monta `BarraInferior` |
| `styles/app.css` (mod) | Estilos de la pantalla y de la barra inferior; se quita la 2.ª fila de la nav (≤ 620 px) |

**Nota de desvío de la spec (a confirmar con Gerardo al entregar):** la spec dice barra inferior en ≤ 620 px. El plan la usa en **≤ 900 px**, que es el punto donde `demo.css` ya pasa la barra de arriba a "modo compacto" (`.who__t` oculto, nav con scroll). Con 5 opciones, entre 621 y 900 px la nav de arriba no entra (ya pasaba "Parti…" con 4). Tablet vertical queda con barra inferior, como en las apps.

---

### Task 1: Datos — `creadoEn` y `listarParaPantalla`

**Files:**
- Modify: `lib/tickets/tipos.ts` (interfaz `ResumenTicket`)
- Modify: `lib/repositorios/repositorio-tickets.ts`
- Modify: `lib/tickets/estados.test.ts:5-18` y `lib/tickets/permisos.test.ts:40-43` (helpers que arman `ResumenTicket`)

**Interfaces:**
- Produces: `ResumenTicket.creadoEn: string` (ISO UTC); `RepositorioTicketsSupabase.listarParaPantalla(desdeIso: string): Promise<ResumenTicket[]>` — abiertos de cualquier fecha + cerrados con `creado_en >= desdeIso`, orden `creado_en` desc, máx. 300.

- [ ] **Step 1: Agregar el campo al tipo**

En `lib/tickets/tipos.ts`, dentro de `interface ResumenTicket`, después de `partidoEliminado: boolean;`:

```ts
  /** ISO UTC de creación: ordena la pantalla Tickets y arma "hace 2 días" (2026-09-29). */
  creadoEn: string;
```

- [ ] **Step 2: Actualizar los helpers de test (si no, `tsc` falla)**

En `lib/tickets/estados.test.ts`, en el objeto que devuelve `t(...)`, después de `partidoEliminado: partidoId === null,` agregar:

```ts
  creadoEn: '2026-09-28T12:00:00Z',
```

En `lib/tickets/permisos.test.ts`, en `r(...)`, reemplazar
`creadoPorNombre: null, inicioUtc: null, fechaLimite, partidoEliminado: false,`
por
`creadoPorNombre: null, inicioUtc: null, fechaLimite, partidoEliminado: false, creadoEn: '2026-09-28T12:00:00Z',`

- [ ] **Step 3: Repositorio — leer `creado_en` y método nuevo**

En `lib/repositorios/repositorio-tickets.ts`:

1. En `interface FilaTicket`, después de `fecha_limite: string | null;` agregar `creado_en: string;`.
2. Reemplazar `CAMPOS_RESUMEN` y `CAMPOS` por:

```ts
const CAMPOS_RESUMEN =
  'id, partido_id, jugador_id, jugador_nombre, titulo, estado, creado_por, creado_por_nombre, inicio_utc, fecha_limite, partido_eliminado, creado_en';
const CAMPOS =
  'id, partido_id, jugador_id, jugador_nombre, titulo, nota, estado, link_entrega, creado_por, creado_por_nombre, inicio_utc, estado_partido, partido_eliminado, fecha_limite, creado_en';
```

3. En `aResumen`, después de `partidoEliminado: f.partido_eliminado,` agregar `creadoEn: f.creado_en,`.
4. Después de `listarPorPartido(...)` agregar:

```ts
  /**
   * Pantalla Tickets (2026-09-29): abiertos de cualquier fecha + cerrados (publicado,
   * cancelado) creados desde `desdeIso` (yyyy-mm-dd). Del más nuevo al más viejo, tope 300.
   */
  async listarParaPantalla(desdeIso: string): Promise<ResumenTicket[]> {
    const { data, error } = await this.supabase
      .from('tickets_vista')
      .select(CAMPOS_RESUMEN)
      .or(`estado.in.(pendiente,en_revision,aprobado),creado_en.gte.${desdeIso}`)
      .order('creado_en', { ascending: false })
      .limit(300)
      .returns<FilaResumen[]>();
    if (error) throw new Error(`No se pudo leer la lista de tickets: ${error.message}`);
    return (data ?? []).map(aResumen);
  }
```

- [ ] **Step 4: Verificar**

Run: `npm test` → Expected: `ℹ fail 0`.
Run: `npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | grep -v "npm notice"` → Expected: sin salida (los TS5097 de imports `.ts` en tests son previos y conocidos).
Run (lectura real, service role): 
```bash
node -e "
process.loadEnvFile('.secretos/.env');
const { createClient } = require('@supabase/supabase-js');
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
a.from('tickets_vista').select('id, estado, creado_en').or('estado.in.(pendiente,en_revision,aprobado),creado_en.gte.2026-08-01').order('creado_en', { ascending: false }).limit(300).then(r => console.log(r.error ?? r.data));"
```
Expected: lista (sin error) con `creado_en` en cada fila.

- [ ] **Step 5: Commit**

```bash
git add lib/tickets/tipos.ts lib/repositorios/repositorio-tickets.ts lib/tickets/estados.test.ts lib/tickets/permisos.test.ts
git commit -m "feat(tickets): creadoEn en ResumenTicket y lectura para la pantalla Tickets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Lógica pura de la pantalla (`lib/tickets/pantalla.ts`)

**Files:**
- Create: `lib/tickets/pantalla.ts`
- Test: `lib/tickets/pantalla.test.ts`

**Interfaces:**
- Consumes: `ResumenTicket` (con `creadoEn`, Task 1), `EstadoTicket` (solo tipos).
- Produces:
  - `type Urgencia = 'vencido' | 'por_vencer' | 'al_dia'`
  - `type FiltroEstado = 'abiertos' | 'cerrados' | 'todos'`
  - `DIAS_POR_VENCER = 2`
  - `esAbierto(estado: EstadoTicket): boolean`
  - `visiblesPara(cargo: string, usuarioId: string, tickets: ResumenTicket[]): ResumenTicket[]`
  - `urgencia(t: ResumenTicket, hoyUy: string): Urgencia | null`
  - `contarUrgencias(tickets: ResumenTicket[], hoyUy: string): Record<Urgencia, number>`
  - `filtrarPantalla(tickets: ResumenTicket[], f: { estado: FiltroEstado; urgencia: Urgencia | null }, hoyUy: string): ResumenTicket[]`
  - `haceCuanto(iso: string, ahoraIso: string): string`
  - `textoCreado(t: ResumenTicket, ahoraIso: string): string`

- [ ] **Step 1: Escribir los tests**

`lib/tickets/pantalla.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contarUrgencias, esAbierto, filtrarPantalla, haceCuanto, textoCreado, urgencia, visiblesPara } from './pantalla.ts';
import type { ResumenTicket } from './tipos.ts';

const HOY = '2026-09-29';
const tk = (id: string, estado: ResumenTicket['estado'], fechaLimite: string | null, creadoPor = 'felipe'): ResumenTicket => ({
  id, partidoId: 'p', jugadorId: 'j', jugadorNombre: 'Nacho', titulo: `T ${id}`, estado, creadoPor,
  creadoPorNombre: 'Felipe', inicioUtc: null, fechaLimite, partidoEliminado: false, creadoEn: '2026-09-28T12:00:00Z',
});

test('esAbierto: pendiente, en revisión y aprobado; publicado y cancelado no', () => {
  assert.equal(esAbierto('pendiente'), true);
  assert.equal(esAbierto('en_revision'), true);
  assert.equal(esAbierto('aprobado'), true);
  assert.equal(esAbierto('publicado'), false);
  assert.equal(esAbierto('cancelado'), false);
});

test('visiblesPara: Admin y Diseñador todos; CM los suyos; Prueba nada', () => {
  const l = [tk('a', 'pendiente', null, 'felipe'), tk('b', 'pendiente', null, 'pedro')];
  assert.deepEqual(visiblesPara('Administrador', 'felipe', l).map((t) => t.id), ['a', 'b']);
  assert.deepEqual(visiblesPara('Diseñador', 'maxi', l).map((t) => t.id), ['a', 'b']);
  assert.deepEqual(visiblesPara('Community Manager', 'pedro', l).map((t) => t.id), ['b']);
  assert.deepEqual(visiblesPara('Prueba', 'alexis', l), []);
});

test('urgencia: bordes de "por vencer" (0, 1, 2 días) y vencido (-1)', () => {
  assert.equal(urgencia(tk('a', 'pendiente', '2026-09-28'), HOY), 'vencido');
  assert.equal(urgencia(tk('a', 'pendiente', '2026-09-29'), HOY), 'por_vencer');
  assert.equal(urgencia(tk('a', 'en_revision', '2026-10-01'), HOY), 'por_vencer');
  assert.equal(urgencia(tk('a', 'pendiente', '2026-10-02'), HOY), 'al_dia');
});

test('urgencia: aprobado o sin fecha → al día; cerrados → null', () => {
  assert.equal(urgencia(tk('a', 'aprobado', '2026-09-01'), HOY), 'al_dia');
  assert.equal(urgencia(tk('a', 'pendiente', null), HOY), 'al_dia');
  assert.equal(urgencia(tk('a', 'publicado', '2026-09-01'), HOY), null);
  assert.equal(urgencia(tk('a', 'cancelado', '2026-09-01'), HOY), null);
});

test('contarUrgencias: solo abiertos', () => {
  const l = [
    tk('v', 'pendiente', '2026-09-20'),
    tk('p', 'en_revision', '2026-09-30'),
    tk('d', 'aprobado', null),
    tk('c', 'publicado', '2026-09-20'),
  ];
  assert.deepEqual(contarUrgencias(l, HOY), { vencido: 1, por_vencer: 1, al_dia: 1 });
});

test('filtrarPantalla: estado abiertos / cerrados / todos, respetando el orden', () => {
  const l = [tk('a', 'pendiente', null), tk('b', 'publicado', null), tk('c', 'cancelado', null), tk('d', 'aprobado', null)];
  assert.deepEqual(filtrarPantalla(l, { estado: 'abiertos', urgencia: null }, HOY).map((t) => t.id), ['a', 'd']);
  assert.deepEqual(filtrarPantalla(l, { estado: 'cerrados', urgencia: null }, HOY).map((t) => t.id), ['b', 'c']);
  assert.deepEqual(filtrarPantalla(l, { estado: 'todos', urgencia: null }, HOY).map((t) => t.id), ['a', 'b', 'c', 'd']);
});

test('filtrarPantalla: con urgencia solo entran abiertos de esa urgencia (un cerrado vencido no)', () => {
  const l = [tk('v', 'pendiente', '2026-09-20'), tk('c', 'publicado', '2026-09-20'), tk('x', 'pendiente', '2026-10-20')];
  assert.deepEqual(filtrarPantalla(l, { estado: 'todos', urgencia: 'vencido' }, HOY).map((t) => t.id), ['v']);
});

test('haceCuanto: hoy, ayer, días, semanas, meses (día de Uruguay)', () => {
  const ahora = '2026-09-29T15:00:00Z';
  assert.equal(haceCuanto('2026-09-29T13:00:00Z', ahora), 'hoy');
  assert.equal(haceCuanto('2026-09-28T13:00:00Z', ahora), 'ayer');
  assert.equal(haceCuanto('2026-09-26T13:00:00Z', ahora), 'hace 3 días');
  assert.equal(haceCuanto('2026-09-08T13:00:00Z', ahora), 'hace 3 semanas');
  assert.equal(haceCuanto('2026-07-20T13:00:00Z', ahora), 'hace 2 meses');
  // 01:30 UTC del 29 = 22:30 del 28 en Uruguay → "ayer", no "hoy"
  assert.equal(haceCuanto('2026-09-29T01:30:00Z', ahora), 'ayer');
});

test('textoCreado: con y sin nombre del creador', () => {
  const ahora = '2026-09-29T15:00:00Z';
  assert.equal(textoCreado(tk('a', 'pendiente', null), ahora), 'Creado por Felipe · ayer');
  assert.equal(textoCreado({ ...tk('a', 'pendiente', null), creadoPorNombre: null }, ahora), 'Creado por alguien del equipo · ayer');
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ fail 1` (el archivo de test no carga: `pantalla.ts` no existe).

- [ ] **Step 3: Implementar**

`lib/tickets/pantalla.ts`:

```ts
/**
 * Lógica de la pantalla Tickets (spec 2026-09-29-pantalla-tickets.md): quién ve qué, urgencia
 * (vencido / por vencer / al día), conteos para los contadores, filtros y textos de creación.
 * Puro: solo luxon y tipos (los tests corren con node --test, donde `@/` no resuelve).
 *
 * Football First. Creado 2026-09-29.
 */
import { DateTime } from 'luxon';
import type { EstadoTicket, ResumenTicket } from '@/lib/tickets/tipos';

export type Urgencia = 'vencido' | 'por_vencer' | 'al_dia';
export type FiltroEstado = 'abiertos' | 'cerrados' | 'todos';

/** "Por vencer" = vence hoy, mañana o pasado mañana (decisión de Gerardo 2026-09-29). */
export const DIAS_POR_VENCER = 2;

const ZONA = 'America/Montevideo';
const ABIERTOS: EstadoTicket[] = ['pendiente', 'en_revision', 'aprobado'];

export function esAbierto(estado: EstadoTicket): boolean {
  return ABIERTOS.includes(estado);
}

/**
 * Admin y Diseñador ven todos; el CM, los que creó; el resto, ninguno. Es foco de pantalla,
 * no seguridad: la RLS (0025) ya deja leer tickets a todo usuario activo.
 */
export function visiblesPara(cargo: string, usuarioId: string, tickets: ResumenTicket[]): ResumenTicket[] {
  if (cargo === 'Administrador' || cargo === 'Diseñador') return tickets;
  if (cargo === 'Community Manager') return tickets.filter((t) => t.creadoPor === usuarioId);
  return [];
}

/** Días civiles de `hoyUy` a `dia` (ambos yyyy-mm-dd); negativo si ya pasó. */
function diasHasta(dia: string, hoyUy: string): number {
  return Math.round(DateTime.fromISO(dia, { zone: 'utc' }).diff(DateTime.fromISO(hoyUy, { zone: 'utc' }), 'days').days);
}

/**
 * `null` para cerrados (no cuentan). Aprobado o sin fecha límite → al día (ya se entregó, o
 * no hay contra qué vencer). Pendiente / en revisión según la fecha límite.
 */
export function urgencia(t: ResumenTicket, hoyUy: string): Urgencia | null {
  if (!esAbierto(t.estado)) return null;
  if (t.estado === 'aprobado' || !t.fechaLimite) return 'al_dia';
  const dias = diasHasta(t.fechaLimite, hoyUy);
  if (dias < 0) return 'vencido';
  if (dias <= DIAS_POR_VENCER) return 'por_vencer';
  return 'al_dia';
}

export function contarUrgencias(tickets: ResumenTicket[], hoyUy: string): Record<Urgencia, number> {
  const cuenta: Record<Urgencia, number> = { vencido: 0, por_vencer: 0, al_dia: 0 };
  for (const t of tickets) {
    const u = urgencia(t, hoyUy);
    if (u) cuenta[u] += 1;
  }
  return cuenta;
}

/**
 * Con urgencia elegida manda la urgencia (que ya deja afuera a los cerrados); si no, el
 * filtro de estado. Respeta el orden recibido (del más nuevo al más viejo).
 */
export function filtrarPantalla(
  tickets: ResumenTicket[],
  f: { estado: FiltroEstado; urgencia: Urgencia | null },
  hoyUy: string,
): ResumenTicket[] {
  return tickets.filter((t) => {
    if (f.urgencia) return urgencia(t, hoyUy) === f.urgencia;
    if (f.estado === 'abiertos') return esAbierto(t.estado);
    if (f.estado === 'cerrados') return !esAbierto(t.estado);
    return true;
  });
}

/** "hoy" / "ayer" / "hace 3 días" / "hace 2 semanas" / "hace 2 meses", por día de Uruguay. */
export function haceCuanto(iso: string, ahoraIso: string): string {
  const dia = DateTime.fromISO(iso, { zone: 'utc' }).setZone(ZONA).startOf('day');
  const hoy = DateTime.fromISO(ahoraIso, { zone: 'utc' }).setZone(ZONA).startOf('day');
  const dias = Math.round(hoy.diff(dia, 'days').days);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`;
  return `hace ${Math.floor(dias / 30)} meses`;
}

export function textoCreado(t: ResumenTicket, ahoraIso: string): string {
  return `Creado por ${t.creadoPorNombre ?? 'alguien del equipo'} · ${haceCuanto(t.creadoEn, ahoraIso)}`;
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)|not ok"`
Expected: `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/tickets/pantalla.ts lib/tickets/pantalla.test.ts
git commit -m "feat(tickets): lógica pura de la pantalla Tickets (urgencia, conteos, filtros)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Página `/tickets` (fila, sección, página, CSS)

**Files:**
- Create: `components/tickets/FilaTicket.tsx`
- Create: `components/tickets/SeccionTickets.tsx`
- Create: `app/(app)/tickets/page.tsx`
- Modify: `styles/app.css` (agregar al final)

**Interfaces:**
- Consumes: Task 1 (`listarParaPantalla`, `creadoEn`), Task 2 (todo `pantalla.ts`), existentes: `PastillaEstado({ estado })`, `AlertaTicket({ texto })`, `debeActuar(cargo, usuarioId, t)` (`lib/tickets/permisos`), `TEXTO_ALERTA` y `META_ESTADO` (`lib/tickets/estados`), `textoVencimiento(fechaLimite, estado, hoyUy)` (`lib/tickets/vencimiento`), `usePanel().abrir('ticket', id)`, `EstadoSinDatos`, `sesionActual()`, `ZONA_AGENCIA`.
- Produces: ruta `/tickets` (la usa la navegación en Task 4).

- [ ] **Step 1: `FilaTicket`**

`components/tickets/FilaTicket.tsx`:

```tsx
/**
 * Una fila de la pantalla Tickets: pastilla de estado + título, vencimiento (rojo si venció),
 * quién lo creó y cuándo, y la lucecita si el ticket espera algo de quien mira. Toda la fila
 * es un botón que abre el panel del ticket. Estilos `.tkf` en app.css.
 *
 * Football First. Creado 2026-09-29.
 */
import { PastillaEstado } from '@/components/tickets/PastillaEstado';
import { AlertaTicket } from '@/components/tickets/AlertaTicket';
import { META_ESTADO } from '@/lib/tickets/estados';
import { textoCreado } from '@/lib/tickets/pantalla';
import { textoVencimiento } from '@/lib/tickets/vencimiento';
import type { ResumenTicket } from '@/lib/tickets/tipos';

export function FilaTicket({
  ticket: t,
  hoyUy,
  ahoraIso,
  alerta,
  onAbrir,
}: {
  ticket: ResumenTicket;
  hoyUy: string;
  ahoraIso: string;
  /** "Ticket pendiente" / "Para revisar" / "Para publicar" si le toca a quien mira. */
  alerta?: string;
  onAbrir: () => void;
}) {
  const venc = textoVencimiento(t.fechaLimite, t.estado, hoyUy);
  const creado = textoCreado(t, ahoraIso);
  // Nombre accesible completo: el lector no tiene que recorrer los hijos.
  const etiqueta = [t.titulo, META_ESTADO[t.estado].etiqueta, venc?.texto, creado, alerta].filter(Boolean).join('. ');
  return (
    <button type="button" className="tkf" aria-label={etiqueta} onClick={onAbrir}>
      <span className="tkf__1">
        <PastillaEstado estado={t.estado} />
        <b>{t.titulo}</b>
      </span>
      <span className="tkf__2">
        {venc && <span className={venc.vencido ? 'tk__vence--mal' : undefined}>{venc.texto}</span>}
        <span>{creado}</span>
        {alerta && <AlertaTicket texto={alerta} />}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: `SeccionTickets`**

`components/tickets/SeccionTickets.tsx`:

```tsx
/**
 * Parte cliente de la pantalla Tickets: tres contadores que filtran por urgencia (Vencidos /
 * Por vencer / Al día), chips de estado (Abiertos / Cerrados / Todos) y la lista. Filtra en el
 * navegador: la página ya trajo todo (spec §3). Tocar un chip de estado limpia la urgencia;
 * tocar un contador pasa a "Abiertos" (la urgencia solo existe en abiertos).
 * Después de una acción en el panel, `router.refresh()` (PanelTicket) vuelve a leer la página.
 *
 * Football First. Creado 2026-09-29.
 */
'use client';

import { useMemo, useState } from 'react';
import { FilaTicket } from '@/components/tickets/FilaTicket';
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';
import { usePanel } from '@/lib/paneles/use-panel';
import { debeActuar } from '@/lib/tickets/permisos';
import { TEXTO_ALERTA } from '@/lib/tickets/estados';
import { contarUrgencias, filtrarPantalla, type FiltroEstado, type Urgencia } from '@/lib/tickets/pantalla';
import type { ResumenTicket } from '@/lib/tickets/tipos';

const CONTADORES: { u: Urgencia; etiqueta: string; vacio: string }[] = [
  { u: 'vencido', etiqueta: 'Vencidos', vacio: 'No hay tickets vencidos.' },
  { u: 'por_vencer', etiqueta: 'Por vencer', vacio: 'No hay tickets por vencer.' },
  { u: 'al_dia', etiqueta: 'Al día', vacio: 'No hay tickets al día.' },
];

const ESTADOS: { e: FiltroEstado; etiqueta: string; vacio: string }[] = [
  { e: 'abiertos', etiqueta: 'Abiertos', vacio: 'No hay tickets abiertos.' },
  { e: 'cerrados', etiqueta: 'Cerrados', vacio: 'Todavía no hay tickets cerrados.' },
  { e: 'todos', etiqueta: 'Todos', vacio: 'Todavía no hay tickets.' },
];

export function SeccionTickets({
  tickets,
  cargo,
  usuarioId,
  hoyUy,
  ahoraIso,
}: {
  /** Ya filtrados por cargo (`visiblesPara`) y del más nuevo al más viejo. */
  tickets: ResumenTicket[];
  cargo: string;
  usuarioId: string;
  hoyUy: string;
  ahoraIso: string;
}) {
  const [estado, setEstado] = useState<FiltroEstado>('abiertos');
  const [urg, setUrg] = useState<Urgencia | null>(null);
  const { abrir } = usePanel();

  const cuentas = useMemo(() => contarUrgencias(tickets, hoyUy), [tickets, hoyUy]);
  const visibles = useMemo(() => filtrarPantalla(tickets, { estado, urgencia: urg }, hoyUy), [tickets, estado, urg, hoyUy]);

  function tocarContador(u: Urgencia) {
    if (urg === u) {
      setUrg(null);
    } else {
      setUrg(u);
      setEstado('abiertos');
    }
  }

  function tocarEstado(e: FiltroEstado) {
    setEstado(e);
    setUrg(null);
  }

  const vacio =
    !tickets.length && cargo === 'Community Manager'
      ? 'Todavía no creaste tickets. Se crean desde el detalle de un partido.'
      : urg
        ? CONTADORES.find((c) => c.u === urg)!.vacio
        : ESTADOS.find((x) => x.e === estado)!.vacio;

  return (
    <>
      <div className="kpis tkk">
        {CONTADORES.map(({ u, etiqueta }) => (
          <button
            key={u}
            type="button"
            className={`kpi tkk__k tkk__k--${u} ${urg === u ? 'on' : ''}`}
            aria-pressed={urg === u}
            onClick={() => tocarContador(u)}
          >
            <b>{cuentas[u]}</b>
            <span>{etiqueta}</span>
          </button>
        ))}
      </div>

      <div className="barra" id="filtros-tickets">
        {ESTADOS.map(({ e, etiqueta }) => (
          <button
            key={e}
            type="button"
            className={estado === e && !urg ? 'chip on' : 'chip'}
            aria-pressed={estado === e && !urg}
            onClick={() => tocarEstado(e)}
          >
            {etiqueta}
          </button>
        ))}
        <span className="cuenta">
          {visibles.length} ticket{visibles.length === 1 ? '' : 's'}
        </span>
      </div>

      {visibles.length ? (
        <div className="tkl">
          {visibles.map((t) => (
            <FilaTicket
              key={t.id}
              ticket={t}
              hoyUy={hoyUy}
              ahoraIso={ahoraIso}
              alerta={debeActuar(cargo, usuarioId, t) ? TEXTO_ALERTA[t.estado] : undefined}
              onAbrir={() => abrir('ticket', t.id)}
            />
          ))}
        </div>
      ) : (
        <EstadoSinDatos style={{ justifyContent: 'center', padding: 40 }}>{vacio}</EstadoSinDatos>
      )}
    </>
  );
}
```

- [ ] **Step 3: La página**

`app/(app)/tickets/page.tsx`:

```tsx
/**
 * Vista `tickets` (spec 2026-09-29-pantalla-tickets.md): lo que está en marcha, del más nuevo
 * al más viejo, con contadores de urgencia. Server Component: una sola lectura (abiertos +
 * cerrados de los últimos 60 días) y el filtro por cargo; la parte interactiva es
 * `SeccionTickets`. "Prueba" no tiene esta vista: se lo manda a /partidos.
 *
 * Football First. Creado 2026-09-29.
 */
import { redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import { SeccionTickets } from '@/components/tickets/SeccionTickets';
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';
import { sesionActual } from '@/lib/sesion/sesion-actual';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import { RepositorioTicketsSupabase } from '@/lib/repositorios/repositorio-tickets';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import { visiblesPara } from '@/lib/tickets/pantalla';
import type { ResumenTicket } from '@/lib/tickets/tipos';

/** Cerrados más viejos que esto no se traen (spec §3). */
const DIAS_CERRADOS = 60;

export default async function PaginaTickets() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');
  if (sesion.cargo === 'Prueba') redirect('/partidos');

  const ahora = DateTime.now().setZone(ZONA_AGENCIA);
  const hoyUy = ahora.toISODate() ?? '';
  const desde = ahora.minus({ days: DIAS_CERRADOS }).toISODate() ?? '';

  let tickets: ResumenTicket[] | null = null;
  try {
    tickets = await new RepositorioTicketsSupabase(crearClienteServidor()).listarParaPantalla(desde);
  } catch (e) {
    console.error('tickets (pantalla):', e);
  }

  return (
    <section className="vista on" id="v-tickets" tabIndex={-1}>
      <div className="head">
        <h1 className="d1">Tickets</h1>
        <p className="sub">Lo que está en marcha, del más nuevo al más viejo.</p>
      </div>

      {tickets === null ? (
        <EstadoSinDatos>No pudimos cargar los tickets. Recargá la página.</EstadoSinDatos>
      ) : (
        <SeccionTickets
          tickets={visiblesPara(sesion.cargo, sesion.usuarioId, tickets)}
          cargo={sesion.cargo}
          usuarioId={sesion.usuarioId}
          hoyUy={hoyUy}
          ahoraIso={new Date().toISOString()}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 4: CSS de la pantalla**

Agregar al final de `styles/app.css`:

```css
/* Pantalla Tickets (2026-09-29). Contadores = .kpi de la demo convertidos en botones que filtran. */
.tkk { margin-bottom: 28px; }
.tkk__k { width: 100%; text-align: left; cursor: pointer; border: 2px solid transparent; }
.tkk__k--vencido b { color: var(--tk-rojo); }
.tkk__k--por_vencer b { color: var(--tk-amarillo); }
.tkk__k.on { border-color: var(--text); }
.tkk__k:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.tkl { display: flex; flex-direction: column; gap: 8px; }
.tkf { display: flex; flex-direction: column; gap: 8px; width: 100%; padding: 16px 18px; border-radius: var(--r-sm); background: var(--surface); box-shadow: var(--sh-1); text-align: left; cursor: pointer; transition: box-shadow .3s var(--ease); }
.tkf:hover { box-shadow: var(--sh-2); }
.tkf:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.tkf__1 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tkf__1 b { font-weight: 600; overflow-wrap: anywhere; }
.tkf__2 { display: flex; align-items: center; gap: 6px 14px; flex-wrap: wrap; font-size: var(--t-sm); color: var(--text-2); }
@media (max-width: 620px) {
  .tkk { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .tkk .kpi { padding: 16px 14px 14px; }
  .tkk .kpi b { font-size: 32px; }
  .tkk .kpi span { margin-top: 8px; }
}
```

- [ ] **Step 5: Verificar tipos, lint y tests**

Run: `npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | grep -v "npm notice"` → Expected: sin salida.
Run: `npm run lint 2>&1 | tail -1` → Expected: `✔ No ESLint warnings or errors`.
Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"` → Expected: `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add components/tickets/FilaTicket.tsx components/tickets/SeccionTickets.tsx "app/(app)/tickets/page.tsx" styles/app.css
git commit -m "feat(tickets): pantalla /tickets con contadores de urgencia, filtros y lista

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Navegación — 5.ª opción y barra inferior (≤ 900 px)

**Files:**
- Create: `lib/navegacion/secciones.ts`
- Create: `components/layout/BarraInferior.tsx`
- Modify: `components/comunes/Ico.tsx` (ícono `lista`)
- Modify: `components/layout/Nav.tsx` (reescribir)
- Modify: `components/layout/BarraSuperior.tsx:86` (`<Nav />` → `<Nav cargo={perfil.cargo} />`)
- Modify: `app/(app)/layout.tsx` (montar `BarraInferior`)
- Modify: `styles/app.css` (quitar la 2.ª fila de nav ≤ 620 px; agregar barra inferior)

**Interfaces:**
- Consumes: ruta `/tickets` (Task 3); `pendientesDeSesion()` ya usado en el layout (devuelve `ResumenTicket[]`); `Ico({ nombre, clase })` con `NombreIcono = keyof typeof PATHS`.
- Produces: `SECCIONES`, `seccionesPara(cargo: string): Seccion[]`, `esSeccionActiva(pathname: string, v: string): boolean`; `<Nav cargo />`; `<BarraInferior cargo pendientes />`.

- [ ] **Step 1: Ícono `lista`**

En `components/comunes/Ico.tsx`, dentro de `PATHS`, después de `ojoCerrado: ...,` agregar:

```ts
  // Pestaña "Tickets" de la barra inferior (acordado con Gerardo en la spec 2026-09-29-pantalla-tickets).
  lista:
    '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9.5 4V3h5v1"/><path d="m8.5 10.5 1.5 1.5 2.5-2.5"/><path d="M14.5 11h1.5"/><path d="m8.5 16 1.5 1.5 2.5-2.5"/><path d="M14.5 16.5h1.5"/>',
```

- [ ] **Step 2: Secciones compartidas**

`lib/navegacion/secciones.ts`:

```ts
/**
 * Secciones de la app, definidas UNA vez para la nav de arriba (`Nav`, > 900 px) y la barra
 * de pestañas inferior (`BarraInferior`, ≤ 900 px), así nunca se desincronizan.
 * "Tickets" no aparece para el cargo Prueba (spec 2026-09-29-pantalla-tickets.md).
 *
 * Football First. Creado 2026-09-29 (sacado de components/layout/Nav.tsx).
 */
import type { NombreIcono } from '@/components/comunes/Ico';

export interface Seccion {
  v: 'partidos' | 'calendario' | 'calendario-general' | 'jugadores' | 'tickets';
  /** Texto de la nav de arriba. */
  etiqueta: string;
  /** Texto corto de la barra inferior. */
  corta: string;
  icono: NombreIcono;
}

export const SECCIONES: Seccion[] = [
  { v: 'partidos', etiqueta: 'Partidos', corta: 'Partidos', icono: 'reloj' },
  { v: 'calendario', etiqueta: 'Match Day', corta: 'Match Day', icono: 'calendario' },
  { v: 'calendario-general', etiqueta: 'Calendario general', corta: 'General', icono: 'torta' },
  { v: 'jugadores', etiqueta: 'Jugadores', corta: 'Jugadores', icono: 'persona' },
  { v: 'tickets', etiqueta: 'Tickets', corta: 'Tickets', icono: 'lista' },
];

export function seccionesPara(cargo: string): Seccion[] {
  return cargo === 'Prueba' ? SECCIONES.filter((s) => s.v !== 'tickets') : SECCIONES;
}

export function esSeccionActiva(pathname: string, v: string): boolean {
  return pathname === `/${v}` || pathname.startsWith(`/${v}/`);
}
```

- [ ] **Step 3: `Nav` usa la lista compartida**

Reemplazar todo `components/layout/Nav.tsx` por:

```tsx
/**
 * Navegación principal (arriba, > 900 px). Emite EXACTAMENTE el marcado `.nav` de la demo:
 * <nav class="nav"><button>…</button></nav>. El CSS de la demo estiliza `.nav button`,
 * por eso son <button> y no <a>; la navegación va por el router.
 * Las secciones salen de `lib/navegacion/secciones.ts` (compartidas con `BarraInferior`).
 * En ≤ 900 px se oculta y manda la barra inferior (app.css).
 */
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { esSeccionActiva, seccionesPara } from '@/lib/navegacion/secciones';

export function Nav({ cargo }: { cargo: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="nav" id="nav" aria-label="Secciones">
      {seccionesPara(cargo).map(({ v, etiqueta }) => {
        const activa = esSeccionActiva(pathname, v);
        return (
          <button
            key={v}
            data-v={v}
            className={activa ? 'on' : undefined}
            aria-current={activa ? 'page' : undefined}
            onClick={() => router.push(`/${v}`)}
          >
            {etiqueta}
          </button>
        );
      })}
    </nav>
  );
}
```

En `components/layout/BarraSuperior.tsx`, reemplazar `<Nav />` por `<Nav cargo={perfil.cargo} />`.

- [ ] **Step 4: `BarraInferior`**

`components/layout/BarraInferior.tsx`:

```tsx
/**
 * Barra de pestañas inferior (celular y tablet, ≤ 900 px; decisión de Gerardo 2026-09-29):
 * Partidos · Match Day · General · Jugadores · Tickets, con ícono y nombre corto. La pestaña
 * Tickets muestra cuántos te esperan (mismo número que el globito de la barra de arriba).
 * En > 900 px no se ve (app.css) y manda `Nav`.
 *
 * Football First. Creado 2026-09-29.
 */
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Ico } from '@/components/comunes/Ico';
import { esSeccionActiva, seccionesPara } from '@/lib/navegacion/secciones';

export function BarraInferior({ cargo, pendientes }: { cargo: string; pendientes: number }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="binf" aria-label="Secciones">
      {seccionesPara(cargo).map(({ v, etiqueta, corta, icono }) => {
        const activa = esSeccionActiva(pathname, v);
        const n = v === 'tickets' ? pendientes : 0;
        return (
          <button
            key={v}
            type="button"
            className={activa ? 'binf__b on' : 'binf__b'}
            aria-current={activa ? 'page' : undefined}
            aria-label={n ? `${etiqueta}, ${n} te espera${n === 1 ? '' : 'n'}` : etiqueta}
            onClick={() => router.push(`/${v}`)}
          >
            <span className="binf__i">
              <Ico nombre={icono} />
              {n > 0 && (
                <span className="binf__n" aria-hidden="true">
                  {n}
                </span>
              )}
            </span>
            <span className="binf__t" aria-hidden="true">
              {corta}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 5: Montarla en el layout**

En `app/(app)/layout.tsx`:
1. Agregar `import { BarraInferior } from '@/components/layout/BarraInferior';` junto a los imports de layout.
2. Justo después del cierre `</main>` (dentro de `<div className="app on" id="app">`), agregar:

```tsx
        {/* Pestañas abajo en celular/tablet (≤ 900 px); en desktop manda la nav de arriba. */}
        <BarraInferior cargo={sesion.cargo} pendientes={pendientes.length} />
```

- [ ] **Step 6: CSS — quitar la 2.ª fila y agregar la barra inferior**

En `styles/app.css`, BORRAR el bloque completo que empieza con el comentario
`/* En celular la nav no entraba al lado de la marca (quedaba "Parti…" con scroll escondido):`
hasta el cierre del `@media (max-width: 370px) { .nav button { font-size: var(--t-xs); } }` inclusive
(ese arreglo de hoy lo reemplaza la barra inferior). Dejar intactas las reglas de `html { overflow-x: clip; }` y `.panel` de arriba.

Agregar al final de `styles/app.css`:

```css
/* Barra de pestañas inferior (≤ 900 px, 2026-09-29). Reemplaza a la nav de arriba, que con 5
   opciones no entra al lado de la marca. z-index: sobre el contenido (la barra de arriba es 90),
   debajo del velo (110) y del panel lateral (120). */
.binf { display: none; }
@media (max-width: 900px) {
  .top .nav { display: none; }
  .binf {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 95;
    display: grid; grid-auto-flow: column; grid-auto-columns: 1fr;
    padding: 4px 4px calc(4px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(20px) saturate(1.4);
    border-top: 1px solid var(--line);
  }
  .binf__b { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-height: 52px; padding: 4px 2px; border-radius: var(--r-sm); color: var(--text-2); font-size: var(--t-xs); font-weight: 500; }
  .binf__b.on { color: var(--text); font-weight: 600; }
  .binf__b.on .binf__i { color: var(--accent); }
  .binf__b:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .binf__i { position: relative; display: inline-flex; }
  .binf__n { position: absolute; top: -6px; right: -12px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--tk-rojo-bg); color: var(--tk-rojo); border: 1px solid var(--tk-rojo-borde); font-size: 11px; font-weight: 700; line-height: 16px; text-align: center; }
  .binf__t { white-space: nowrap; }
  .toast { bottom: calc(84px + env(safe-area-inset-bottom)); }
}
```

(`.wrap` ya tiene 130 px de padding inferior en `demo.css`: alcanza para que la barra, ~64 px, no tape la última tarjeta. Se verifica en Task 5.)

- [ ] **Step 7: Verificar tipos, lint y tests**

Run: `npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | grep -v "npm notice"` → Expected: sin salida.
Run: `npm run lint 2>&1 | tail -1` → Expected: `✔ No ESLint warnings or errors`.
Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"` → Expected: `ℹ fail 0`.

- [ ] **Step 8: Medir la nav de arriba en notebook chica (Review Focus 4)**

Levantar `npx next dev -p 3100` (en segundo plano) y con el script de navegador (Task 5, Step 1 lo trae completo) medir como Felipe a 1024 y 920 px: `document.querySelector('.nav').scrollWidth > document.querySelector('.nav').clientWidth` y `document.documentElement.scrollWidth > innerWidth`.
- Si alguno da `true`, agregar al final de `styles/app.css` y volver a medir:

```css
/* 901–1180 px: con 5 secciones la nav no entra si además va el nombre del usuario. */
@media (max-width: 1180px) { .who__t { display: none; } }
```

Expected final: ambos `false` a 1024 y 920 px.

- [ ] **Step 9: Commit**

```bash
git add lib/navegacion/secciones.ts components/layout/BarraInferior.tsx components/layout/Nav.tsx components/layout/BarraSuperior.tsx components/comunes/Ico.tsx "app/(app)/layout.tsx" styles/app.css
git commit -m "feat(nav): sección Tickets y barra de pestañas inferior en celular/tablet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: QA en navegador con los 4 usuarios + avances

**Files:**
- Create (scratchpad, no se commitea): `qa-tickets.mjs` en el scratchpad de la sesión
- Modify: `planeacion/avances.md` (§5, bloque "Decisiones de Gerardo sobre los pedidos de tickets")

**Interfaces:**
- Consumes: todo lo anterior; dev de Claude en `http://localhost:3100`; usuarios `felipe`, `pedro`, `maxi`, `alexis` con clave `demo1234`; herramienta `node C:\Users\Gerardo\.claude\skills\browser-automation\browser.mjs <url> --script <archivo>`.

- [ ] **Step 1: Script de QA**

Crear en el scratchpad `qa-tickets.mjs`:

```js
// QA de la pantalla Tickets y la barra inferior (dev :3100). Crea UN ticket "QA —" como Pedro,
// lo recorre y lo cancela al final.
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Gerardo/Desktop/FirstUY/WebFirst/package.json');
const { createClient } = require('@supabase/supabase-js');
process.loadEnvFile('C:/Users/Gerardo/Desktop/FirstUY/WebFirst/.secretos/.env');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = 'http://localhost:3100';
const T = 180000;

async function login(page, u) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill('#usuario', u);
  await page.fill('#pass', 'demo1234');
  await page.click('button[type=submit]');
  await page.waitForURL('**/partidos', { timeout: T });
}
const medir = (page) => page.evaluate(() => ({
  scrollX: document.documentElement.scrollWidth > innerWidth,
  navDesborda: (() => { const n = document.querySelector('.top .nav'); return !!n && getComputedStyle(n).display !== 'none' && n.scrollWidth > n.clientWidth; })(),
  binfVisible: getComputedStyle(document.querySelector('.binf')).display !== 'none',
  pestañas: [...document.querySelectorAll('.binf__b')].map((b) => b.getAttribute('aria-label')),
}));
async function pantalla(page) {
  await page.goto(`${BASE}/tickets`);
  await page.waitForSelector('#v-tickets', { timeout: T });
  return page.evaluate(() => ({
    contadores: [...document.querySelectorAll('.tkk__k')].map((k) => k.textContent),
    cuenta: document.querySelector('#filtros-tickets .cuenta')?.textContent,
    filas: [...document.querySelectorAll('.tkf')].map((f) => f.getAttribute('aria-label')),
    vacio: document.querySelector('.sinDato')?.textContent ?? null,
  }));
}

export default async function run(page) {
  const r = { errores: [] };
  page.on('pageerror', (e) => r.errores.push(String(e)));

  // Pedro crea un ticket en el último partido
  await login(page, 'pedro');
  await page.waitForSelector('.match', { timeout: T });
  const n = await page.locator('.match').count();
  await page.locator('.match').nth(n - 1).locator('.duelo').click();
  await page.getByRole('button', { name: 'Crear ticket de diseño' }).first().click({ timeout: T });
  await page.locator('textarea[id^="nota-"]').first().fill('QA — pantalla Tickets (se cancela)');
  await page.getByRole('button', { name: 'Crear ticket', exact: true }).click();
  await page.waitForFunction(() => location.search.includes('panel=ticket'), null, { timeout: T });
  const id = new URL(page.url()).searchParams.get('id');
  r.id = id;
  r.pedro = await pantalla(page);

  // Contador + cambio a Cerrados limpia la urgencia (Review Focus 3)
  await page.locator('.tkk__k').first().click();
  r.pedro_vencidos = await page.evaluate(() => document.querySelector('#filtros-tickets .cuenta')?.textContent);
  await page.getByRole('button', { name: 'Cerrados', exact: true }).click();
  r.pedro_cerrados_pressed = await page.evaluate(() => [...document.querySelectorAll('.tkk__k')].map((k) => k.getAttribute('aria-pressed')));

  // Abrir el ticket desde la fila
  await page.getByRole('button', { name: 'Abiertos', exact: true }).click();
  await page.locator('.tkf').first().click();
  await page.waitForFunction(() => location.search.includes('panel=ticket'), null, { timeout: T });
  r.pedro_abre = new URL(page.url()).pathname + new URL(page.url()).search.slice(0, 20);

  // Maxi: ve todos, con lucecita "Ticket pendiente" en el de Pedro; entrega
  await login(page, 'maxi');
  r.maxi = await pantalla(page);
  await page.goto(`${BASE}/tickets?panel=ticket&id=${id}`);
  await page.waitForSelector('.panel.on h2', { timeout: T });
  await page.getByRole('button', { name: 'Entregar', exact: true }).click();
  await page.fill('#tk-campo', 'https://www.dropbox.com/s/qa-pantalla');
  await page.getByRole('button', { name: 'Entregar para revisión', exact: true }).click();
  await page.waitForFunction(() => /Listo/i.test(document.querySelector('[role=status]')?.textContent ?? ''), null, { timeout: T });
  await page.waitForTimeout(1500);
  r.maxi_tras_entregar = await page.evaluate(() => [...document.querySelectorAll('.tkf')].map((f) => f.getAttribute('aria-label')).filter((l) => l.includes('QA')));

  // Felipe: ve todos y "Para revisar"
  await login(page, 'felipe');
  r.felipe = await pantalla(page);

  // Alexis: sin pestaña y redirigido
  await login(page, 'alexis');
  await page.goto(`${BASE}/tickets`);
  await page.waitForURL('**/partidos', { timeout: T });
  r.alexis_redirigido = true;
  await page.setViewportSize({ width: 390, height: 844 });
  r.alexis_390 = await medir(page);

  // Anchos con Felipe
  await login(page, 'felipe');
  for (const [w, h] of [[390, 844], [360, 780], [768, 1024], [920, 900], [1024, 768], [1280, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}/tickets`);
    await page.waitForSelector('#v-tickets', { timeout: T });
    await page.waitForTimeout(400);
    r[`felipe_${w}`] = await medir(page);
    if (w === 390 || w === 1280) await page.screenshot({ path: `tickets-${w}.png`, fullPage: false });
  }
  // Barra inferior no tapa la última tarjeta de /partidos a 390
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/partidos`);
  await page.waitForSelector('.match', { timeout: T });
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  r.ultimaTarjetaVisible = await page.evaluate(() => {
    const ms = document.querySelectorAll('#lista .match, #lista .fechac');
    const ult = ms[ms.length - 1].getBoundingClientRect();
    const barra = document.querySelector('.binf').getBoundingClientRect();
    return ult.bottom <= barra.top;
  });
  await page.screenshot({ path: 'partidos-390-final.png' });

  // Tema oscuro a 390 en /tickets
  await page.goto(`${BASE}/tickets`);
  await page.waitForSelector('#v-tickets', { timeout: T });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tickets-390-oscuro.png' });

  // Limpieza: Felipe devuelve y cancela el ticket de QA
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/tickets?panel=ticket&id=${id}`);
  await page.waitForSelector('.panel.on h2', { timeout: T });
  await page.getByRole('button', { name: 'Devolver', exact: true }).first().click();
  await page.fill('#tk-campo', 'QA');
  await page.getByRole('button', { name: 'Devolver al Diseñador', exact: true }).click();
  await page.waitForFunction(() => /Listo/i.test(document.querySelector('[role=status]')?.textContent ?? ''), null, { timeout: T });
  await page.getByRole('button', { name: 'Cancelar ticket', exact: true }).first().click();
  await page.fill('#tk-campo', 'QA de la pantalla Tickets');
  await page.getByRole('button', { name: 'Cancelar ticket', exact: true }).last().click();
  await page.waitForFunction(() => /Listo/i.test(document.querySelector('[role=status]')?.textContent ?? ''), null, { timeout: T });
  r.estado_final = (await admin.from('tickets').select('estado').eq('id', id).single()).data?.estado;
  return r;
}
```

- [ ] **Step 2: Levantar el dev de Claude y correr el QA**

Antes: `curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/login` — si da 200, Gerardo tiene su dev abierto: igual se puede usar el 3100 (dos `next dev` comparten `.next` sin romperse como con `build`), pero avisarle.
Run (segundo plano): `cd C:/Users/Gerardo/Desktop/FirstUY/WebFirst && npx next dev -p 3100`
Esperar a que `curl http://localhost:3100/login` dé 200.
Run: `node C:/Users/Gerardo/.claude/skills/browser-automation/browser.mjs http://localhost:3100/login --script qa-tickets.mjs` (desde el scratchpad).

Expected:
- `errores: []`
- `pedro.filas` contiene el ticket "QA —"; `pedro.contadores` tiene 3 textos (Vencidos / Por vencer / Al día); las filas de Pedro son solo tickets creados por él.
- `pedro_cerrados_pressed` = `['false','false','false']` (tocar "Cerrados" limpió el contador).
- `pedro_abre` contiene `panel=ticket`.
- `maxi.filas` incluye todos (los de Gerardo + el de QA) y la del QA termina en "Ticket pendiente".
- `maxi_tras_entregar[0]` contiene "En revisión".
- `felipe.filas`: la del QA termina en "Para revisar".
- `alexis_redirigido: true`; `alexis_390.pestañas` tiene 4 (sin Tickets).
- `felipe_390`, `felipe_360`, `felipe_768`: `binfVisible: true`, `scrollX: false`; `pestañas` con 5; la de Tickets con "te espera(n)" si hay pendientes.
- `felipe_920`, `felipe_1024`, `felipe_1280`: `binfVisible: false`, `navDesborda: false`, `scrollX: false`.
- `ultimaTarjetaVisible: true`.
- `estado_final: 'cancelado'`.
Mirar las capturas `tickets-390.png`, `tickets-1280.png`, `tickets-390-oscuro.png`, `partidos-390-final.png`.

Si algo no da lo esperado: arreglar en el archivo de la Task que corresponde, volver a correr `npm test` / lint / tsc, y repetir este Step. Si el arreglo es de CSS o componentes, commitear con `fix(tickets): …`.

- [ ] **Step 3: Apagar el dev de Claude**

`TaskStop` del proceso en segundo plano, y en PowerShell:

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*next*dev*-p*3100*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
```

Expected: `http://localhost:3100` ya no responde.

- [ ] **Step 4: Registrar en avances**

En `planeacion/avances.md`, dentro del bloque "✅ Decisiones de Gerardo sobre los pedidos de tickets", después de la línea que empieza con `- **✅ 5 HECHO (2026-09-29, falta push):**` (y su párrafo), agregar:

```markdown
- **✅ 3 HECHO (2026-09-29, falta push):** pantalla `/tickets` (spec y plan
  `2026-09-29-pantalla-tickets`): contadores Vencidos / Por vencer (≤ 2 días) / Al día que
  filtran, chips Abiertos / Cerrados (60 días) / Todos, filas que abren el panel, lucecita.
  Admin y Diseñador ven todos, CM los suyos, Prueba sin pestaña (redirige). Navegación: 5.ª
  opción "Tickets"; en ≤ 900 px barra de pestañas inferior (Partidos · Match Day · General ·
  Jugadores · Tickets) que reemplaza la 2.ª fila de nav de la mañana. Ícono nuevo `lista`.
  Desvío de la spec: barra inferior en ≤ 900 px (no 620) porque con 5 opciones la nav de
  arriba no entra entre 621 y 900 px. QA :3100 con los 4 usuarios, 360–1280 px, tema oscuro.
```

- [ ] **Step 5: Commit**

```bash
git add planeacion/avances.md
git commit -m "avances: pantalla Tickets y barra inferior hechas y verificadas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Avisar a Gerardo: correr `git push` y probar en su iPhone.
