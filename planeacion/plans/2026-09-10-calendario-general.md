# Calendario General + rótulo Match Day — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una 2ª vista de calendario (`/calendario-general`) con las fechas de contenido de un roster ampliado de 12 jugadores, renombrar la vista actual `/calendario` a "Match Day", y sumar los 7 jugadores nuevos a la grilla Jugadores y al buscador con ficha slim — sin que Match Day cambie en nada.

**Architecture:** Dos banderas booleanas en `jugadores` (`servicio_match_day`, `servicio_contenido`) parten los dos servicios. `agenda_anual` gana un guardia `servicio_match_day` en sus bloques de fecha fija (salida idéntica hoy). Una vista nueva y chica `agenda_contenido` (4 proyecciones de fecha fija, roster `servicio_contenido`) alimenta la página nueva, que reusa los componentes `<Calendario>` y `<NotasAgenda>` tal cual. Los 7 jugadores nuevos entran a `jugadores`/`clubes` por un seed idempotente.

**Tech Stack:** Next.js 14 App Router + TypeScript + React (Server Components), Supabase (Postgres + RLS + `security_invoker` views), Luxon + IANA, `node --test` para lógica pura. Sin Tailwind, sin CSS-in-JS.

**Spec:** `planeacion/specs/2026-09-10-calendario-general.md` (leerlo entero antes de empezar; este plan argumenta desde ahí).

## Global Constraints

- **Match Day (`/calendario`) queda idéntico.** El gate es un diff del set de filas de `agenda_anual` para `fuente in ('cumpleanos','aniversario_club','aniversario_seleccion')` en una ventana fija, antes vs. después de la migración `0014` → debe ser vacío.
- **Nunca** editar `styles/demo.css` ni `planeacion/demo-fase1.html`. CSS nuevo solo en `styles/app.css`, con tokens de `styles/tokens.css`. Nunca renombrar una clase de la demo.
- **Español** en identificadores, componentes y comentarios (única excepción: el prefijo `use` de los hooks de React).
- **Cero invenciones:** dato ausente → `null` / "Sin datos", nunca `0`.
- **Fechas:** Luxon + zonas IANA. Fechas civiles `YYYY-MM-DD` ancladas a medianoche UTC. Prohibido offsets fijos y `date-fns`.
- **Tests:** `node --test` sobre funciones puras (`npm test` = `node --test "lib/**/*.test.ts" "supabase/functions/**/*.test.ts"`). Los tests importan con extensión `.ts` (`from './eventos.ts'`).
- **Migraciones:** `npm run migracion supabase/migrations/<archivo>` y después `npm run tipos:db`. Las vistas se cambian con `create or replace` (nunca `drop`), aditivo y reversible.
- **Seeds:** `process.loadEnvFile('.secretos/.env')`, `SUPABASE_SERVICE_ROLE_KEY`, idempotentes por `(proveedor_externo, id_externo)`, siempre `update` sobre lo que exista, imprimen diff.
- **Rótulos del nav, exactos:** `Partidos` · `Match Day` · `Calendario general` · `Jugadores`.
- **Commits** frecuentes; cerrar el mensaje con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Cierre de sesión = commit + `git push origin main` (dispara el deploy de Vercel).
- Cabecera de comentario + propósito en cada archivo nuevo, al estilo de los existentes.

---

## Task 1: Lógica pura — fuente `aniversario_debut`, `FUENTES_CONTENIDO`, `proximoAniversario`, `chipEvento` extraído

**Files:**
- Modify: `lib/agenda/notas-proximas.ts`
- Modify: `lib/jugadores/datos-contenido.ts`
- Modify: `lib/calendario/eventos.ts`
- Modify: `components/calendario/Calendario.tsx:19-26` (import) y `:29-44` (borrar `chipEvento` local)
- Test: `lib/jugadores/datos-contenido.test.ts`, `lib/calendario/eventos.test.ts`

**Interfaces:**
- Produces:
  - `FuenteAgenda` incluye `'aniversario_debut'` (en `lib/agenda/notas-proximas.ts`).
  - `FUENTES_CONTENIDO: readonly FuenteAgenda[]` = `['cumpleanos','aniversario_club','aniversario_seleccion','aniversario_debut']`.
  - `textoFuente('aniversario_debut') === 'Aniversario de debut profesional'`.
  - `proximoAniversario(fechaIso: string | null | undefined, hoyUy: string): string | null` (en `lib/jugadores/datos-contenido.ts`).
  - `chipEvento(e: EventoCalendario): { etiqueta: string; texto: string }` exportada desde `lib/calendario/eventos.ts`.

- [ ] **Step 1: `FuenteAgenda` + `FUENTES_CONTENIDO` + `textoFuente` en `notas-proximas.ts`**

En `lib/agenda/notas-proximas.ts`:

```ts
export type FuenteAgenda =
  | 'partido'
  | 'convocatoria'
  | 'hito'
  | 'cumpleanos'
  | 'aniversario_club'
  | 'aniversario_seleccion'
  | 'aniversario_debut';
```

Debajo de `FUENTES_NOTA` (no lo toques), agregá:

```ts
/**
 * Fuentes de fecha fija del servicio "Contenido" (Calendario General). Suma el aniversario
 * del debut profesional a las tres de `FUENTES_NOTA`.
 */
export const FUENTES_CONTENIDO: readonly FuenteAgenda[] = [
  'cumpleanos',
  'aniversario_club',
  'aniversario_seleccion',
  'aniversario_debut',
];
```

En `textoFuente`, antes del `default`:

```ts
    case 'aniversario_debut':
      return 'Aniversario de debut profesional';
```

- [ ] **Step 2: Escribir el test de `proximoAniversario`**

En `lib/jugadores/datos-contenido.test.ts`, sumá al final:

```ts
import { proximoAniversario } from './datos-contenido.ts';

test('proximoAniversario: si el día del año todavía no pasó, es este año', () => {
  assert.equal(proximoAniversario('1990-12-28', '2026-09-06'), '2026-12-28');
});

test('proximoAniversario: si ya pasó este año, es el que viene', () => {
  assert.equal(proximoAniversario('1990-03-16', '2026-09-06'), '2027-03-16');
});

test('proximoAniversario: hoy mismo cuenta como la próxima ocurrencia', () => {
  assert.equal(proximoAniversario('2000-09-06', '2026-09-06'), '2026-09-06');
});

test('proximoAniversario: fecha vacía, null o inválida → null', () => {
  assert.equal(proximoAniversario(null, '2026-09-06'), null);
  assert.equal(proximoAniversario('', '2026-09-06'), null);
  assert.equal(proximoAniversario('no-es-fecha', '2026-09-06'), null);
});
```

- [ ] **Step 3: Correr el test y verlo fallar**

Run: `npm test`
Expected: FAIL — `proximoAniversario` is not exported / not a function.

- [ ] **Step 4: Implementar `proximoAniversario` en `datos-contenido.ts`**

Al final de `lib/jugadores/datos-contenido.ts`:

```ts
/**
 * Próxima ocurrencia (>= hoy) del aniversario de una fecha civil: toma su mes y día y los
 * lleva al año en curso; si en ese año ya pasó, al año siguiente. Devuelve `YYYY-MM-DD`.
 * `null` si la fecha es vacía o inválida. Fechas 29/2: Luxon ajusta al día válido más cercano.
 *
 * Puro: `hoyUy` (YYYY-MM-DD en zona de Uruguay) entra como argumento, no se llama a `now()`.
 */
export function proximoAniversario(
  fechaIso: string | null | undefined,
  hoyUy: string,
): string | null {
  if (!fechaIso) return null;
  const base = DateTime.fromISO(fechaIso, { zone: 'utc' }).startOf('day');
  const hoy = DateTime.fromISO(hoyUy, { zone: 'utc' }).startOf('day');
  if (!base.isValid || !hoy.isValid) return null;

  let candidata = base.set({ year: hoy.year });
  if (candidata < hoy) candidata = base.set({ year: hoy.year + 1 });
  return candidata.toISODate();
}
```

- [ ] **Step 5: Extraer `chipEvento` a `lib/calendario/eventos.ts` y agregar el caso nuevo**

En `lib/calendario/eventos.ts`, agregá el import arriba (junto a los otros):

```ts
import { horaCortaEnUruguay } from '@/lib/fechas/zonas';
```

Y al final del archivo:

```ts
/**
 * Texto de cada chip de evento del calendario: etiqueta corta (arriba, en negrita) + título.
 * Vive acá (no en el componente) para poder testearlo y compartirlo entre calendarios.
 */
export function chipEvento(e: EventoCalendario): { etiqueta: string; texto: string } {
  switch (e.fuente) {
    case 'partido':
      return { etiqueta: e.cuandoUtc ? `${horaCortaEnUruguay(e.cuandoUtc)} UY` : '—', texto: e.titulo };
    case 'cumpleanos':
      return { etiqueta: 'Cumpleaños', texto: e.titulo };
    case 'aniversario_club':
      return { etiqueta: 'Aniversario', texto: e.titulo };
    case 'aniversario_seleccion':
      return { etiqueta: 'Selección', texto: e.titulo };
    case 'aniversario_debut':
      return { etiqueta: 'Debut profesional', texto: e.titulo };
    case 'convocatoria':
      return { etiqueta: 'Convocatoria', texto: e.titulo };
    default:
      return { etiqueta: 'Hito', texto: e.titulo };
  }
}
```

- [ ] **Step 6: Usar la `chipEvento` importada en `Calendario.tsx`**

En `components/calendario/Calendario.tsx`:
1. Borrá la función local `chipEvento` (líneas ~28-44, el bloque `/** Texto de cada chip… */ function chipEvento(...) { switch … }`).
2. Agregá `chipEvento` a la lista de imports que ya trae de `@/lib/calendario/eventos`:

```ts
import {
  agruparPorDia,
  celdasDelMes,
  chipEvento,
  partidosPorMes,
  MESES,
  MESES_CORTOS,
  type EventoCalendario,
} from '@/lib/calendario/eventos';
```

- [ ] **Step 7: Escribir el test de `chipEvento` para la fuente nueva**

En `lib/calendario/eventos.test.ts`, sumá al import de `./eventos.ts` el nombre `chipEvento` y agregá:

```ts
test('chipEvento: aniversario_debut usa la etiqueta "Debut profesional"', () => {
  const c = chipEvento(ev({ fuente: 'aniversario_debut', titulo: 'Aniversario del debut profesional de X' }));
  assert.deepEqual(c, { etiqueta: 'Debut profesional', texto: 'Aniversario del debut profesional de X' });
});

test('chipEvento: cumpleanos sigue diciendo "Cumpleaños"', () => {
  assert.equal(chipEvento(ev({ fuente: 'cumpleanos', titulo: 'Cumpleaños de Y' })).etiqueta, 'Cumpleaños');
});
```

- [ ] **Step 8: Correr todo y verificar verde**

Run: `npm test`
Expected: PASS (todos, incluidos los nuevos).
Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 9: Commit**

```bash
git add lib/agenda/notas-proximas.ts lib/jugadores/datos-contenido.ts lib/jugadores/datos-contenido.test.ts lib/calendario/eventos.ts lib/calendario/eventos.test.ts components/calendario/Calendario.tsx
git commit -m "feat(calendario): fuente aniversario_debut + proximoAniversario + chipEvento compartida

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Migración `0014` — banderas de servicio + guardia en `agenda_anual` + vista `agenda_contenido`

**Files:**
- Create: `supabase/migrations/0014_calendario_general.sql`
- Modify (regenerado): `lib/supabase/tipos-db.ts` (vía `npm run tipos:db`)
- Reference: `supabase/migrations/0013_dia_local_sede.sql` (se copia el cuerpo de `agenda_anual`)

**Interfaces:**
- Produces:
  - Columnas `jugadores.servicio_match_day boolean not null default true` y `jugadores.servicio_contenido boolean not null default false`.
  - Vista `agenda_contenido` con columnas, en este orden: `fuente, ref_id, jugador_id, club_id, titulo, cuando_utc, dia_uy, competencia_codigo, es_internacional, tentativo, dia_local_sede` (idénticas a `agenda_anual`).
  - `Database['public']['Views']['agenda_contenido']['Row']` y las 2 columnas nuevas en `…['Tables']['jugadores']['Row']` en `lib/supabase/tipos-db.ts`.

- [ ] **Step 1: Capturar el set de eventos de `agenda_anual` ANTES (baseline del gate Match Day)**

En el SQL editor de Supabase (o `scripts/aplicar-migracion.mjs` adaptado a un `select`), corré y guardá el resultado como `/tmp/agenda_antes.txt`:

```sql
select fuente, dia_uy, titulo
from agenda_anual
where fuente in ('cumpleanos','aniversario_club','aniversario_seleccion')
  and dia_uy between '2025-01-01' and '2028-12-31'
order by fuente, dia_uy, titulo;
```

- [ ] **Step 2: Escribir la migración**

Create `supabase/migrations/0014_calendario_general.sql`:

```sql
-- ============================================================================
-- Football First — Migración 0014: Calendario General (servicio "Contenido")
--
-- La agencia ofrece dos servicios sobre distintos grupos de jugadores:
--   · Match Day  → seguimiento de fixture. Los 6 representados de siempre.
--                  Es la vista /calendario (renombrada a "Match Day" en el front).
--   · Contenido  → arte y comunicación para un roster más amplio (12 jugadores),
--                  sin seguir sus partidos. Alimenta la vista nueva
--                  /calendario-general con fechas fijas: cumpleaños, aniversario
--                  de fundación de club, aniversario del debut en selección y
--                  aniversario del debut profesional.
--
-- Este cambio NO debe alterar Match Day. Mecanismo:
--   1. Dos banderas en `jugadores`: servicio_match_day (default true → los 6
--      actuales quedan dentro sin tocar una fila) y servicio_contenido
--      (default false → el seed prende los 12).
--   2. `agenda_anual` gana un guardia `servicio_match_day` en sus 3 bloques de
--      fecha fija por jugador/club. Efecto hoy: salida idéntica (los 6 son todos
--      servicio_match_day y cada uno de sus clubes tiene un jugador match_day).
--   3. Vista nueva `agenda_contenido`: 4 proyecciones de fecha fija, roster
--      servicio_contenido. Misma forma de columnas que `agenda_anual` para
--      reusar `EventoCalendario` y `repositorio-agenda`.
--
-- `create or replace` para `agenda_anual` (no `drop`): mismo patrón que 0004,
-- 0011, 0013. Aditivo y reversible.
--
-- Reversión: `create or replace view agenda_anual` con el cuerpo de 0013 +
-- `drop view agenda_contenido` + `alter table jugadores drop column
-- servicio_contenido, drop column servicio_match_day`.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Banderas de servicio en `jugadores`
-- ----------------------------------------------------------------------------
alter table jugadores
  add column servicio_match_day boolean not null default true,
  add column servicio_contenido boolean not null default false;

comment on column jugadores.servicio_match_day is
  'Servicio "Match Day": la agencia sigue el fixture de este jugador. Los 6 representados historicos. Alimenta agenda_anual y la vista partidos.';
comment on column jugadores.servicio_contenido is
  'Servicio "Contenido": la agencia prepara arte/comunicacion para este jugador. Alimenta agenda_contenido (Calendario General). Puede coincidir con servicio_match_day.';

-- ----------------------------------------------------------------------------
-- 2) agenda_anual — cuerpo EXACTO de 0013 con un guardia servicio_match_day en
--    los 3 bloques de fecha fija por jugador/club. Copiar el bloque
--    `create or replace view agenda_anual … ;` completo desde
--    supabase/migrations/0013_dia_local_sede.sql y aplicar SOLO estos 3 cambios:
--
--    · Bloque 4 (cumpleaños), subconsulta `from jugadores jg`:
--        where jg.fecha_nacimiento is not null
--      →  where jg.fecha_nacimiento is not null and jg.servicio_match_day
--
--    · Bloque 5 (aniversario_club), subconsulta `from clubes cbb`:
--        where cbb.fecha_fundacion is not null
--      →  where cbb.fecha_fundacion is not null
--           and exists (select 1 from jugadores jx
--                       where jx.club_actual_id = cbb.id and jx.servicio_match_day)
--
--    · Bloque 6 (aniversario_seleccion), subconsulta `from jugadores jg`:
--        where jg.debut_seleccion is not null
--      →  where jg.debut_seleccion is not null and jg.servicio_match_day
--
--    Los bloques 1-3 (partidos / convocatorias / hitos) NO se tocan.
-- ----------------------------------------------------------------------------

-- <<< PEGAR AQUÍ el `create or replace view agenda_anual with (security_invoker = true) as … ;`
--     de 0013 con los 3 cambios de arriba, y su `comment on view agenda_anual is …;` tal cual. >>>

-- ----------------------------------------------------------------------------
-- 3) agenda_contenido — 4 proyecciones de fecha fija, roster servicio_contenido.
--    Sin sede: dia_local_sede = dia_uy. Ventana de años [-1, +2] igual que agenda_anual.
-- ----------------------------------------------------------------------------
create view agenda_contenido
with (security_invoker = true) as

-- 1) Cumpleaños de jugadores servicio_contenido
select
  'cumpleanos'::text        as fuente,
  j.id                      as ref_id,
  j.id                      as jugador_id,
  j.club_id_placeholder     as club_id,
  'Cumpleaños de ' || coalesce(j.apodo, j.nombre) as titulo,
  (j.proj + time '12:00') at time zone 'America/Montevideo' as cuando_utc,
  j.proj                    as dia_uy,
  null::text                as competencia_codigo,
  false                     as es_internacional,
  false                     as tentativo,
  j.proj                    as dia_local_sede
from (
  select
    jg.id, jg.apodo, jg.nombre, jg.club_actual_id as club_id_placeholder,
    (make_date(yr.y, 1, 1) + (jg.fecha_nacimiento - make_date(extract(year from jg.fecha_nacimiento)::int, 1, 1)))::date as proj
  from jugadores jg
  cross join (
    select generate_series(extract(year from now())::int - 1, extract(year from now())::int + 2) as y
  ) yr
  where jg.fecha_nacimiento is not null and jg.servicio_contenido
) j

union all

-- 2) Aniversario de fundación del club (club con al menos un jugador servicio_contenido)
select
  'aniversario_club'::text, cb.id, null::uuid, cb.id,
  'Aniversario de ' || cb.nombre,
  (cb.proj + time '12:00') at time zone 'America/Montevideo',
  cb.proj, null::text, false, false, cb.proj
from (
  select
    cbb.id, cbb.nombre,
    (make_date(yr.y, 1, 1) + (cbb.fecha_fundacion - make_date(extract(year from cbb.fecha_fundacion)::int, 1, 1)))::date as proj
  from clubes cbb
  cross join (
    select generate_series(extract(year from now())::int - 1, extract(year from now())::int + 2) as y
  ) yr
  where cbb.fecha_fundacion is not null
    and exists (select 1 from jugadores jx where jx.club_actual_id = cbb.id and jx.servicio_contenido)
) cb

union all

-- 3) Aniversario del debut con la selección (servicio_contenido)
select
  'aniversario_seleccion'::text, j.id, j.id, j.club_id_placeholder,
  'Aniversario del debut con la selección de ' || coalesce(j.apodo, j.nombre),
  (j.proj + time '12:00') at time zone 'America/Montevideo',
  j.proj, null::text, false, false, j.proj
from (
  select
    jg.id, jg.apodo, jg.nombre, jg.club_actual_id as club_id_placeholder,
    (make_date(yr.y, 1, 1) + (jg.debut_seleccion - make_date(extract(year from jg.debut_seleccion)::int, 1, 1)))::date as proj
  from jugadores jg
  cross join (
    select generate_series(extract(year from now())::int - 1, extract(year from now())::int + 2) as y
  ) yr
  where jg.debut_seleccion is not null and jg.servicio_contenido
) j

union all

-- 4) Aniversario del debut profesional (servicio_contenido) — fuente nueva
select
  'aniversario_debut'::text, j.id, j.id, j.club_id_placeholder,
  'Aniversario del debut profesional de ' || coalesce(j.apodo, j.nombre),
  (j.proj + time '12:00') at time zone 'America/Montevideo',
  j.proj, null::text, false, false, j.proj
from (
  select
    jg.id, jg.apodo, jg.nombre, jg.club_actual_id as club_id_placeholder,
    (make_date(yr.y, 1, 1) + (jg.debut - make_date(extract(year from jg.debut)::int, 1, 1)))::date as proj
  from jugadores jg
  cross join (
    select generate_series(extract(year from now())::int - 1, extract(year from now())::int + 2) as y
  ) yr
  where jg.debut is not null and jg.servicio_contenido
) j;

comment on view agenda_contenido is
  'Fechas de contenido (cumpleanos, aniversarios de club / debut en seleccion / debut profesional) del servicio Contenido — roster servicio_contenido. Alimenta /calendario-general. Sin sede: dia_local_sede = dia_uy.';

commit;
```

- [ ] **Step 3: Aplicar la migración**

Run: `npm run migracion supabase/migrations/0014_calendario_general.sql`
Expected: sin error; imprime que aplicó `0014`.

- [ ] **Step 4: Gate Match Day — capturar el set DESPUÉS y diffear**

Corré la MISMA query del Step 1, guardá como `/tmp/agenda_despues.txt`.
Run: `diff /tmp/agenda_antes.txt /tmp/agenda_despues.txt`
Expected: **sin salida** (idénticos). Si hay diferencias, la migración está mal — revertir y revisar los `where` de los bloques 4/5/6.

- [ ] **Step 5: Verificar `agenda_contenido` (todavía vacía, sin `servicio_contenido`)**

```sql
select count(*) from agenda_contenido;               -- 0 (nadie es servicio_contenido aún)
select count(*) from jugadores where servicio_match_day;   -- 6
select count(*) from jugadores where servicio_contenido;   -- 0
```

- [ ] **Step 6: Regenerar tipos**

Run: `npm run tipos:db`
Then: `git status` — `lib/supabase/tipos-db.ts` debe aparecer modificado, con `agenda_contenido` y las 2 columnas nuevas de `jugadores`.
Run: `npm run build`
Expected: compila.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0014_calendario_general.sql lib/supabase/tipos-db.ts
git commit -m "feat(db): migracion 0014 — banderas de servicio + vista agenda_contenido

Match Day idéntico (diff de agenda_anual vacío en el gate).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Repositorios — banderas en `repositorio-jugadores`, parámetro de vista en `repositorio-agenda`

**Files:**
- Modify: `lib/repositorios/tipos.ts`
- Modify: `lib/repositorios/repositorio-jugadores.ts`
- Modify: `lib/repositorios/repositorio-agenda.ts`

**Interfaces:**
- Consumes: `Database['public']['Views']['agenda_contenido']` y las columnas nuevas de `jugadores` (Task 2); `FuenteAgenda` con `aniversario_debut` (Task 1).
- Produces:
  - `JugadorPlantel` gana `soloContenido: boolean` y `clubFechaFundacion: string | null`. `JugadorFicha` los hereda.
  - `RepositorioJugadoresSupabase.listar()` / `.obtener()` devuelven esos campos poblados.
  - `RepositorioAgendaSupabase` acepta `new RepositorioAgendaSupabase(supabase, 'agenda_contenido')`; por defecto `'agenda_anual'`.

- [ ] **Step 1: `tipos.ts` — sumar los campos a `JugadorPlantel`**

En `lib/repositorios/tipos.ts`, dentro de `interface JugadorPlantel`, después de `clubPais`:

```ts
  /** Fecha de fundación del club actual (YYYY-MM-DD) o `null`. Para el aniversario de club. */
  clubFechaFundacion: string | null;
  /**
   * `true` si el jugador es SOLO del servicio Contenido (servicio_contenido && !servicio_match_day):
   * aparece en la grilla y el buscador con badge "Contenido" y abre la ficha slim, no la completa.
   */
  soloContenido: boolean;
```

`JugadorFicha extends JugadorPlantel`, así que los hereda sin más cambios.

- [ ] **Step 2: `repositorio-jugadores.ts` — traer las columnas y derivar**

1. `CAMPOS_PLANTEL`: agregá `servicio_match_day, servicio_contenido` a la lista de columnas de `jugadores`, y `fecha_fundacion` al embed de `clubes`:

```ts
const CAMPOS_PLANTEL =
  'id, nombre, apodo, dorsal, posicion, nacionalidad, seleccion, foto_url, ' +
  'servicio_match_day, servicio_contenido, ' +
  'clubes!jugadores_club_actual_id_fkey(nombre, escudo_url, pais, fecha_fundacion)';
```

2. `interface ClubEmbebido`: agregá `fecha_fundacion: string | null;`.

3. `interface FilaJugadorPlantel`: agregá `servicio_match_day: boolean;` y `servicio_contenido: boolean;`.

4. `aJugadorPlantel`: en el objeto que devuelve, agregá:

```ts
    clubFechaFundacion: fila.clubes?.fecha_fundacion ?? null,
    soloContenido: fila.servicio_contenido && !fila.servicio_match_day,
```

`CAMPOS_FICHA` ya es `CAMPOS_PLANTEL + ', fecha_nacimiento, …'`, así que hereda todo. `FilaJugadorFicha extends FilaJugadorPlantel` — sin cambios.

- [ ] **Step 3: `repositorio-agenda.ts` — parámetro de vista**

1. Constructor:

```ts
export class RepositorioAgendaSupabase {
  constructor(
    private readonly supabase: ClienteSupabase,
    private readonly vista: 'agenda_anual' | 'agenda_contenido' = 'agenda_anual',
  ) {}
```

2. En `listarEventosParaNotas` y en `listarEventos`, cambiá `.from('agenda_anual')` por `.from(this.vista)`.

3. `FUENTES_FECHA_FIJA`: agregá `'aniversario_debut'`:

```ts
const FUENTES_FECHA_FIJA: FuenteAgenda[] = [
  'cumpleanos', 'aniversario_club', 'aniversario_seleccion', 'aniversario_debut',
];
```

(Inocuo para `agenda_anual`: no tiene filas `aniversario_debut`.)

- [ ] **Step 4: Verificar tipos**

Run: `npm run build`
Expected: compila (los consumidores actuales de `RepositorioAgendaSupabase` no pasan 2º argumento → siguen en `'agenda_anual'`).
Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add lib/repositorios/tipos.ts lib/repositorios/repositorio-jugadores.ts lib/repositorios/repositorio-agenda.ts
git commit -m "feat(repos): soloContenido + clubFechaFundacion en jugadores; vista parametrizable en agenda

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Nav de 4 ítems + rótulo "Match Day" + página `/calendario-general`

**Files:**
- Modify: `components/layout/Nav.tsx:10-14`
- Modify: `app/(app)/calendario/page.tsx:31-40`
- Create: `app/(app)/calendario-general/page.tsx`

**Interfaces:**
- Consumes: `RepositorioAgendaSupabase(supabase, 'agenda_contenido')` (Task 3), `FUENTES_CONTENIDO` (Task 1).
- Produces: ruta `/calendario-general` navegable; el nav resalta `calendario-general` cuando el pathname es `/calendario-general`.

- [ ] **Step 1: Nav — 4 secciones**

En `components/layout/Nav.tsx`, `SECCIONES`:

```ts
const SECCIONES = [
  { v: 'partidos', etiqueta: 'Partidos' },
  { v: 'calendario', etiqueta: 'Match Day' },
  { v: 'calendario-general', etiqueta: 'Calendario general' },
  { v: 'jugadores', etiqueta: 'Jugadores' },
] as const;
```

Nada más cambia (el `map` y el `router.push(\`/${v}\`)` ya sirven).

- [ ] **Step 2: Rótulo de Match Day**

En `app/(app)/calendario/page.tsx`, el `<div className="head">`:

```tsx
      <div className="head">
        <h1 className="d1">Match Day</h1>
        <p className="sub">
          Partidos de los representados, agrupados por el día en la sede. Las fechas a más de
          90 días son tentativas: el fixture se confirma por semestre y los horarios los mueve
          la TV.
        </p>
      </div>
```

(Se saca el `<br /><em>anual</em>`. No se toca nada más del archivo: ni el `id="v-calendario"`, ni la ruta, ni la carpeta.)

- [ ] **Step 3: Página `/calendario-general`**

Create `app/(app)/calendario-general/page.tsx`:

```tsx
/**
 * Vista `calendario-general` — servicio "Contenido" de la agencia. Mismo layout que
 * Match Day (Fechas señaladas + franja de densidad + grilla del mes), pero alimentada por
 * la vista `agenda_contenido`: cumpleaños, aniversario de fundación de club, aniversario del
 * debut en selección y aniversario del debut profesional, para el roster `servicio_contenido`
 * (12 jugadores). Sin partidos.
 *
 * El server trae TODOS los eventos de la ventana de proyección ([-1, +2] años) y
 * `<Calendario>` (Client) navega meses sin volver a pedir nada.
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
 */
import { DateTime } from 'luxon';
import { NotasAgenda } from '@/components/agenda/NotasAgenda';
import { Calendario } from '@/components/calendario/Calendario';
import { notasProximas, FUENTES_CONTENIDO } from '@/lib/agenda/notas-proximas';
import { RepositorioAgendaSupabase } from '@/lib/repositorios/repositorio-agenda';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';

export default async function PaginaCalendarioGeneral() {
  const hoyUy = DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '';
  const anio = Number(hoyUy.slice(0, 4));

  const repo = new RepositorioAgendaSupabase(crearClienteServidor(), 'agenda_contenido');
  const [eventosNota, eventos] = await Promise.all([
    repo.listarEventosParaNotas(hoyUy),
    repo.listarEventos(`${anio - 1}-01-01`, `${anio + 2}-12-31`),
  ]);
  const notas = notasProximas(eventosNota, hoyUy, { fuentes: FUENTES_CONTENIDO });

  return (
    <section className="vista on" id="v-calendario-general" tabIndex={-1}>
      <div className="head">
        <h1 className="d1">
          Calendario
          <br />
          <em>general</em>
        </h1>
        <p className="sub">
          Cumpleaños y aniversarios de club, de debut en selección y de debut profesional de
          todos los representados con servicio de contenido. Las fechas se repiten cada año.
        </p>
      </div>

      <NotasAgenda notas={notas} />

      <Calendario eventos={eventos} hoyUy={hoyUy} />
    </section>
  );
}
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: compila; aparece la ruta `/calendario-general` en el listado.
Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 5: Verificar en el navegador (dev)**

Run: `npm run dev` (en otra terminal) y con `browser-automation` (login real):
- `/calendario-general` carga; nav muestra **Partidos · Match Day · Calendario general · Jugadores**; el ítem "Calendario general" queda `on`.
- La grilla del mes renderiza vacía (todavía no hay `servicio_contenido`) — sin error de consola.
- `/calendario` ahora dice "Match Day" en el `<h1>` y en el nav; su contenido (densidad, celdas, Fechas señaladas) es el mismo de antes.
- 0 errores de consola en ambas.

- [ ] **Step 6: Commit**

```bash
git add components/layout/Nav.tsx "app/(app)/calendario/page.tsx" "app/(app)/calendario-general/page.tsx"
git commit -m "feat(calendario-general): ruta y página nuevas + nav de 4 ítems + rótulo Match Day

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Ficha slim — bundle, endpoint, panel y branch en la ruta SSR

**Files:**
- Modify: `lib/paneles/use-panel.ts:21-23`
- Create: `lib/jugadores/cargar-ficha-contenido.ts`
- Create: `app/api/paneles/jugador-contenido/route.ts`
- Create: `components/jugadores/FichaContenido.tsx`
- Create: `components/paneles/PanelJugadorContenido.tsx`
- Modify: `components/paneles/PanelLateral.tsx`
- Modify: `app/(app)/jugadores/[jugadorId]/page.tsx`

**Interfaces:**
- Consumes: `RepositorioJugadoresSupabase.obtener()` con `soloContenido` + `clubFechaFundacion` (Task 3); `proximoAniversario` (Task 1); `datosParaContenido` (ya existe).
- Produces:
  - `TipoPanel` incluye `'jugador-contenido'`.
  - `ProximaFecha { etiqueta: string; proximaIso: string }` y `FichaContenidoBundle { jugador: JugadorFicha; proximas: ProximaFecha[]; hoyUy: string }` (en `lib/jugadores/cargar-ficha-contenido.ts`).
  - `cargarFichaContenido(supabase, jugadorId): Promise<FichaContenidoBundle | null>` (null si no existe, inactivo, o `!soloContenido`).
  - `GET /api/paneles/jugador-contenido?id=…` → `FichaContenidoBundle` JSON, 404 si null.
  - `<FichaContenido jugador proximas hoyUy />` y `<PanelJugadorContenido bundle />`.

- [ ] **Step 1: `use-panel.ts` — nuevo tipo de panel**

```ts
export type TipoPanel = 'jugador' | 'partido' | 'perfil' | 'jugador-contenido';

const TIPOS: readonly TipoPanel[] = ['jugador', 'partido', 'perfil', 'jugador-contenido'];
```

- [ ] **Step 2: `cargar-ficha-contenido.ts`**

Create `lib/jugadores/cargar-ficha-contenido.ts`:

```ts
/**
 * Bundle de la ficha SLIM de un jugador del servicio "Contenido": los datos de la persona +
 * las próximas ocurrencias de sus fechas de contenido. Sin temporada, sin hitos, sin
 * partidos (ese jugador no tiene seguimiento de fixture).
 *
 * Lo comparten la ruta SSR `/jugadores/[id]` (cuando el jugador es `soloContenido`) y el
 * endpoint `/api/paneles/jugador-contenido` (panel lateral).
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
 */
import { DateTime } from 'luxon';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import { proximoAniversario } from '@/lib/jugadores/datos-contenido';
import { RepositorioJugadoresSupabase } from '@/lib/repositorios/repositorio-jugadores';
import type { crearClienteServidor } from '@/lib/supabase/cliente-servidor';
import type { JugadorFicha } from '@/lib/repositorios/tipos';

type ClienteSupabase = ReturnType<typeof crearClienteServidor>;

export interface ProximaFecha {
  /** "Cumpleaños", "Aniversario de <club>", "Debut en selección", "Debut profesional". */
  etiqueta: string;
  /** YYYY-MM-DD de la próxima ocurrencia (>= hoy). */
  proximaIso: string;
}

export interface FichaContenidoBundle {
  jugador: JugadorFicha;
  /** Ordenadas por fecha ascendente. Vacío si el jugador no tiene ninguna de las 4. */
  proximas: ProximaFecha[];
  /** Día de hoy en Uruguay, YYYY-MM-DD. */
  hoyUy: string;
}

/** Devuelve el bundle, o `null` si el jugador no existe, está inactivo, o no es `soloContenido`. */
export async function cargarFichaContenido(
  supabase: ClienteSupabase,
  jugadorId: string,
): Promise<FichaContenidoBundle | null> {
  const jugador = await new RepositorioJugadoresSupabase(supabase).obtener(jugadorId);
  if (!jugador || !jugador.soloContenido) return null;

  const hoyUy = DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '';

  const crudas: Array<{ etiqueta: string; fecha: string | null }> = [
    { etiqueta: 'Cumpleaños', fecha: jugador.fechaNacimiento },
    { etiqueta: `Aniversario de ${jugador.clubNombre ?? 'club'}`, fecha: jugador.clubFechaFundacion },
    { etiqueta: 'Debut en selección', fecha: jugador.debutSeleccion },
    { etiqueta: 'Debut profesional', fecha: jugador.debut },
  ];

  const proximas: ProximaFecha[] = crudas
    .map((c) => ({ etiqueta: c.etiqueta, proximaIso: proximoAniversario(c.fecha, hoyUy) }))
    .filter((c): c is ProximaFecha => c.proximaIso !== null)
    .sort((a, b) => a.proximaIso.localeCompare(b.proximaIso));

  return { jugador, proximas, hoyUy };
}
```

- [ ] **Step 3: Endpoint**

Create `app/api/paneles/jugador-contenido/route.ts`:

```ts
/**
 * Datos de la ficha SLIM (servicio Contenido) para el panel lateral, como JSON.
 * Cliente SSR (cookies del usuario) → RLS. 404 si el jugador no existe, está inactivo o no
 * es del servicio Contenido.
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
 */
import { NextResponse } from 'next/server';
import { cargarFichaContenido } from '@/lib/jugadores/cargar-ficha-contenido';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el parámetro id.' }, { status: 400 });

  const bundle = await cargarFichaContenido(crearClienteServidor(), id);
  if (!bundle) return NextResponse.json({ error: 'Jugador no encontrado.' }, { status: 404 });

  return NextResponse.json(bundle);
}
```

- [ ] **Step 4: `FichaContenido.tsx`**

Create `components/jugadores/FichaContenido.tsx`:

```tsx
/**
 * Cuerpo de la ficha SLIM de un jugador del servicio "Contenido". Reusa el markup y las
 * clases de la demo del bloque "Datos para contenido" de `FichaJugador`; suma un bloque
 * "Fechas señaladas" con las próximas ocurrencias. Sin Hitos / Este año / Carrera /
 * Selección / Próximos partidos (ese jugador no tiene seguimiento de fixture).
 *
 * Render puro (Server Component).
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
 */
import { Ico } from '@/components/comunes/Ico';
import { Escudo } from '@/components/comunes/Escudo';
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';
import { datosParaContenido } from '@/lib/jugadores/datos-contenido';
import { etiquetaDiaUy } from '@/lib/fechas/zonas';
import { mostrar } from '@/lib/formato/valores';
import type { ProximaFecha } from '@/lib/jugadores/cargar-ficha-contenido';
import type { JugadorFicha } from '@/lib/repositorios/tipos';

export function FichaContenido({
  jugador,
  proximas,
  hoyUy,
}: {
  jugador: JugadorFicha;
  proximas: ProximaFecha[];
  hoyUy: string;
}) {
  const datos = datosParaContenido(jugador, hoyUy);
  const clubEnMeses = datos.aniosEnClub !== null && datos.aniosEnClub < 1;
  const identidad = [
    jugador.clubPais,
    jugador.posicion,
    datos.edad !== null ? `${datos.edad} años` : null,
  ].filter(Boolean);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 15 }}>
        <Escudo nombre={jugador.clubNombre ?? '?'} url={jugador.clubEscudoUrl} clase="crest crest--lg" />
        <h2 className="d2" style={{ flex: 1 }}>
          {jugador.nombre}
        </h2>
      </div>
      <div className="linea" style={{ marginBottom: 32 }}>
        <span>
          <b>{jugador.clubNombre ?? 'Sin club'}</b>
        </span>
        {identidad.map((parte) => (
          <span key={parte}>{parte}</span>
        ))}
      </div>

      {/* ── Datos para contenido ── (mismo markup que FichaJugador) */}
      <div className="bloque">
        <span className="label">Datos para contenido</span>
        <div className="datos">
          <div className="dato">
            <b>{datos.edad ?? '—'}</b>
            <span>Años</span>
          </div>
          <div className="dato">
            <b>{datos.aniosEnClub === null ? '—' : clubEnMeses ? datos.mesesEnClub : datos.aniosEnClub}</b>
            <span>{clubEnMeses ? (datos.mesesEnClub === 1 ? 'Mes en el club' : 'Meses en el club') : 'Años en el club'}</span>
          </div>
          <div className="dato">
            <b>{datos.aniosDeCarrera ?? '—'}</b>
            <span>Años de carrera</span>
          </div>
        </div>
        <div className="linea" style={{ marginTop: 14 }}>
          <span>
            <Ico nombre="torta" clase="ico ico--sm" />
            Cumpleaños: <b>{datos.cumpleLegible ?? 'Sin datos'}</b>
          </span>
          <span>
            <Ico nombre="globo" clase="ico ico--sm" />
            {mostrar(jugador.nacionalidad)}
          </span>
        </div>
        <div className="redes" style={{ marginTop: 14 }}>
          <span className="red">
            <Ico nombre="ig" clase="ico ico--sm" />
            {jugador.instagram ?? 'Sin datos'}
          </span>
        </div>
      </div>

      {/* ── Fechas señaladas ── */}
      <div className="bloque">
        <span className="label">Fechas señaladas</span>
        {proximas.length ? (
          <div className="lst">
            {proximas.map((f) => (
              <div className="pm" key={f.etiqueta}>
                <b>{f.etiqueta}</b>
                <span>{etiquetaDiaUy(f.proximaIso)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EstadoSinDatos>
            Todavía sin fechas de contenido cargadas para este jugador.
          </EstadoSinDatos>
        )}
      </div>
    </>
  );
}
```

Nota: si `Ico` no tiene los nombres `"torta"` / `"globo"` / `"ig"`, usá los mismos que
ya usa `components/jugadores/FichaJugador.tsx` en su bloque "Datos para contenido"
(copiá de ahí — deben coincidir).

- [ ] **Step 5: `PanelJugadorContenido.tsx`**

Create `components/paneles/PanelJugadorContenido.tsx`:

```tsx
/**
 * Cuerpo del panel lateral para un jugador del servicio "Contenido": envuelve
 * `FichaContenido` con el bundle de `/api/paneles/jugador-contenido`.
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
 */
import { FichaContenido } from '@/components/jugadores/FichaContenido';
import type { FichaContenidoBundle } from '@/lib/jugadores/cargar-ficha-contenido';

export function PanelJugadorContenido({ bundle }: { bundle: FichaContenidoBundle }) {
  return <FichaContenido jugador={bundle.jugador} proximas={bundle.proximas} hoyUy={bundle.hoyUy} />;
}
```

- [ ] **Step 6: Cablear `PanelLateral.tsx`**

En `components/paneles/PanelLateral.tsx`:

1. Import:

```ts
import { PanelJugadorContenido } from '@/components/paneles/PanelJugadorContenido';
import type { FichaContenidoBundle } from '@/lib/jugadores/cargar-ficha-contenido';
```

2. Union `Contenido`: agregá

```ts
  | { fase: 'jugador-contenido'; datos: FichaContenidoBundle }
```

3. En el `.then(async (respuesta) => …)` del `useEffect` de fetch, donde hoy decide el `setContenido` por `tipo`:

```ts
        if (tipo === 'jugador') setContenido({ fase: 'jugador', datos });
        else if (tipo === 'partido') setContenido({ fase: 'partido', datos });
        else if (tipo === 'jugador-contenido') setContenido({ fase: 'jugador-contenido', datos });
        else setContenido({ fase: 'perfil', datos });
```

4. `titulo`:

```ts
  const titulo =
    tipo === 'jugador' || tipo === 'jugador-contenido'
      ? 'Ficha del jugador'
      : tipo === 'partido'
        ? 'Detalle del partido'
        : tipo === 'perfil'
          ? 'Mi cuenta'
          : 'Detalle';
```

5. En el render del `.panel__b`, junto a los otros `contenido?.fase === …`:

```tsx
          {contenido?.fase === 'jugador-contenido' && <PanelJugadorContenido bundle={contenido.datos} />}
```

(La URL de fetch ya sale bien: `tipo !== 'perfil'` → `/api/paneles/${tipo}?id=…` → `/api/paneles/jugador-contenido?id=…`. `abierto` ya cubre este tipo porque exige `id !== null`.)

- [ ] **Step 7: Branch en la ruta SSR `/jugadores/[jugadorId]`**

En `app/(app)/jugadores/[jugadorId]/page.tsx`, reescribí el cuerpo así:

```tsx
import { notFound } from 'next/navigation';
import { FichaContenido } from '@/components/jugadores/FichaContenido';
import { FichaJugador } from '@/components/jugadores/FichaJugador';
import { cargarFichaContenido } from '@/lib/jugadores/cargar-ficha-contenido';
import { cargarFichaJugador } from '@/lib/jugadores/cargar-ficha';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

export default async function FichaJugadorPage({ params }: { params: { jugadorId: string } }) {
  const cliente = crearClienteServidor();

  // Jugador del servicio Contenido → ficha slim (cargarFichaContenido devuelve null si no lo es).
  const contenido = await cargarFichaContenido(cliente, params.jugadorId);
  if (contenido) {
    return (
      <section className="vista on" tabIndex={-1}>
        <div className="head">
          <h1 className="d1">
            Ficha del
            <br />
            <em>jugador</em>
          </h1>
          <p className="sub">{contenido.jugador.apodo ?? contenido.jugador.nombre}</p>
        </div>
        <FichaContenido jugador={contenido.jugador} proximas={contenido.proximas} hoyUy={contenido.hoyUy} />
      </section>
    );
  }

  const bundle = await cargarFichaJugador(cliente, params.jugadorId);
  if (!bundle) notFound();

  return (
    <section className="vista on" tabIndex={-1}>
      <div className="head">
        <h1 className="d1">
          Ficha del
          <br />
          <em>jugador</em>
        </h1>
        <p className="sub">{bundle.jugador.apodo ?? bundle.jugador.nombre}</p>
      </div>

      <FichaJugador
        jugador={bundle.jugador}
        temporada={bundle.temporada}
        hitos={bundle.hitos}
        proximos={bundle.proximos}
        hoyUy={bundle.hoyUy}
      />
    </section>
  );
}
```

(Mantené el comentario de cabecera del archivo.)

- [ ] **Step 8: Verificar build/lint**

Run: `npm run build && npm run lint`
Expected: compila, sin errores. (No hay datos de contenido todavía; el cableado se prueba de punta a punta en Task 7.)

- [ ] **Step 9: Commit**

```bash
git add lib/paneles/use-panel.ts lib/jugadores/cargar-ficha-contenido.ts "app/api/paneles/jugador-contenido/route.ts" components/jugadores/FichaContenido.tsx components/paneles/PanelJugadorContenido.tsx components/paneles/PanelLateral.tsx "app/(app)/jugadores/[jugadorId]/page.tsx"
git commit -m "feat(ficha-contenido): bundle, endpoint, panel slim y branch en la ruta SSR

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Badge "Contenido" y ruteo en la grilla y el buscador

**Files:**
- Modify: `components/jugadores/GrillaPlantel.tsx`
- Modify: `components/buscador/Buscador.tsx`
- Modify: `styles/app.css`

**Interfaces:**
- Consumes: `JugadorPlantel.soloContenido` (Task 3), `TipoPanel` con `'jugador-contenido'` (Task 5), `rutaPanel` (ya existe).
- Produces: en la grilla y el buscador, un jugador `soloContenido` muestra "Contenido" y su clic abre `?panel=jugador-contenido&id=…`.

- [ ] **Step 1: `styles/app.css` — reglas nuevas**

Primero verificá los tokens: `grep -E "t-xs|r-sm|--accent|--on-accent|--surface-2" styles/tokens.css`.
Con los tokens confirmados (`--t-xs`, `--r-sm`, `--accent`, `--on-accent`, `--surface-2` existen), agregá al final de `styles/app.css`:

```css
/* ── Servicio "Contenido" ─────────────────────────────────────────────────
   Jugadores que la agencia atiende solo por contenido (no por fixture). No es
   una clase de la demo: vive acá, con tokens de la demo. */

/* Pill en la tarjeta de la grilla — ocupa el lugar de la píldora de país. */
.jug__servicio {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  padding: 3px 8px;
  border-radius: var(--r-sm);
  font-size: var(--t-xs);
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--on-accent);
  background: var(--accent);
}

/* Tag chico en la fila de resultado del buscador. */
.res__tag {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: var(--r-sm);
  font-size: var(--t-xs);
  font-style: normal;
  font-weight: 700;
  color: var(--accent);
  background: var(--surface-2);
}
```

- [ ] **Step 2: `GrillaPlantel.tsx` — badge + ruteo**

1. En `TarjetaJugador`, el bloque que hoy es:

```tsx
      {hitoFrase ? (
        <div className="jug__hito">{hitoFrase}</div>
      ) : (
        pill && <div className="jug__pais">{pill}</div>
      )}
```

pasa a:

```tsx
      {hitoFrase ? (
        <div className="jug__hito">{hitoFrase}</div>
      ) : jugador.soloContenido ? (
        <div className="jug__servicio">Contenido</div>
      ) : (
        pill && <div className="jug__pais">{pill}</div>
      )}
```

2. En `GrillaPlantel`, el `onAbrir`:

```tsx
          onAbrir={() => abrir(jugador.soloContenido ? 'jugador-contenido' : 'jugador', jugador.id)}
```

- [ ] **Step 3: `Buscador.tsx` — tag + ruteo**

1. `irA` — ampliá el tipo:

```tsx
  function irA(tipo: 'jugador' | 'partido' | 'jugador-contenido', id: string) {
    cerrar();
    router.push(rutaPanel(pathname, tipo, id), { scroll: false });
  }
```

2. El botón de resultado de jugador:

```tsx
                  {resultados.jugadores.map((j) => (
                    <button
                      className="res"
                      type="button"
                      key={j.id}
                      onClick={() => irA(j.soloContenido ? 'jugador-contenido' : 'jugador', j.id)}
                    >
                      <CaraJugador nombre={j.nombre} fotoUrl={j.fotoUrl} clase="" />
                      <div>
                        <b>{j.nombre}</b>
                        <span>
                          {[j.clubNombre, j.clubPais].filter(Boolean).join(' · ') || mostrar(j.posicion)}
                          {j.soloContenido && <em className="res__tag">Contenido</em>}
                        </span>
                      </div>
                      <Ico nombre="chevron" clase="ico ico--sm" />
                    </button>
                  ))}
```

- [ ] **Step 4: Verificar build/lint**

Run: `npm run build && npm run lint`
Expected: compila, sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/jugadores/GrillaPlantel.tsx components/buscador/Buscador.tsx styles/app.css
git commit -m "feat(jugadores): badge \"Contenido\" y ruteo a la ficha slim en grilla y buscador

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Seeds — jugadores + clubes nuevos, enriquecimiento y escudos

**Files:**
- Create: `scripts/seed-jugadores-contenido.mjs`
- Create: `scripts/enriquecer-jugadores-contenido.mjs`
- Modify: `package.json` (bloque `scripts`)
- Reference: `scripts/seed-datos-manuales.mjs` (molde), `scripts/consultar-clubes-jugadores.mjs` (para buscar ids)

**Interfaces:**
- Consumes: columnas `servicio_match_day` / `servicio_contenido` (Task 2).
- Produces: 7 filas nuevas en `jugadores` (`servicio_match_day=false`, `servicio_contenido=true`), 4 en `clubes`, y `servicio_contenido=true` en 5 filas existentes. `npm run seed:jugadores-contenido` y `npm run enriquecer:jugadores-contenido`.

**Datos normalizados de la pestaña "Nuevos"** (texto libre → ISO; `null` donde falta el día o dice "No aplica" / "Sin debut"):

Clubes nuevos:

| nombre | pais | fecha_fundacion |
|---|---|---|
| Tigres UANL | México | 1960-03-07 |
| SC Internacional | Brasil | 1909-04-04 |
| CA Peñarol | Uruguay | 1891-09-28 |
| Club Nacional | Uruguay | 1899-05-14 |

Jugadores nuevos (insert):

| nombre | club | fecha_nacimiento | debut | debut_seleccion |
|---|---|---|---|---|
| Rodrigo Aguirre | Tigres UANL | 1994-10-01 | 2011-09-04 | 2024-11-15 |
| Sergio Rochet | SC Internacional | 1993-03-23 | 2014-08-30 | 2022-01-27 |
| Abel Hernández | CA Peñarol | 1990-08-08 | 2007-04-22 | 2010-08-11 |
| Gastón Martirena | Club Nacional | 2000-01-05 | null | null |
| Luis Mejía | Club Nacional | 1991-03-16 | 2010-08-21 | 2009-06-07 |
| Maximiliano Silvera | Club Nacional | 1997-09-05 | 2015-03-21 | null |
| Franco Romero | CA Peñarol | 1995-02-11 | 2015-03-22 | null |

Existentes — SOLO `servicio_contenido=true`, por `id_externo` (proveedor `api-football`), nada más se toca:
`67884` (Federico Pereira), `310307` (Ignacio Sosa), `6122` (Javier Méndez), `377326` (Kevin Amaro), `51549` (Martín Fernández).

- [ ] **Step 1: Buscar los ids de API-Football**

Con `API_FOOTBALL_KEY` de `.secretos/.env`, buscá el id numérico de cada club y cada
jugador nuevo. Podés adaptar `scripts/consultar-clubes-jugadores.mjs` o correr
consultas sueltas: `GET https://v3.football.api-sports.io/teams?search=<nombre>` y
`GET https://v3.football.api-sports.io/players/profiles?search=<apellido>`.
Anotá los ids. Si un club o jugador **no aparece** en el plan free → usá
`proveedor_externo:'manual'` y `id_externo:'manual:<slug>'` (p.ej. `manual:rodrigo-aguirre`)
para esa fila, y dejalo anotado para el paso de enriquecimiento (que lo saltea).

- [ ] **Step 2: `seed-jugadores-contenido.mjs`**

Create `scripts/seed-jugadores-contenido.mjs` (molde: `scripts/seed-datos-manuales.mjs`):

```js
/**
 * Carga el roster del servicio "Contenido" (Calendario General):
 *   · 4 clubes nuevos (Tigres UANL, SC Internacional, CA Peñarol, Club Nacional) con
 *     fecha_fundacion y país.
 *   · 7 jugadores nuevos (origen='manual', activo=true, servicio_match_day=false,
 *     servicio_contenido=true) con nacimiento / debut / debut_seleccion normalizados de
 *     la pestaña "Nuevos" del Excel.
 *   · servicio_contenido=true en los 5 representados que YA existen y también están en
 *     "Nuevos" — sin tocarles ningún otro campo (son Match Day).
 *
 * Idempotente: matchea por (proveedor_externo, id_externo) y hace UPDATE; INSERT la 1ª vez.
 * Interino de un importador del .xlsx: los valores van fijos porque ya están confirmados.
 *
 * Uso: npm run seed:jugadores-contenido
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
 */
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.secretos/.env');
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .secretos/.env');
  process.exit(1);
}
const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- Clubes nuevos. id_externo = id de equipo de API-Football (Step 1). ---
const CLUBES = [
  { ref: 'Tigres UANL',      proveedor: 'api-football', id_externo: 'REEMPLAZAR', pais: 'México',  fecha_fundacion: '1960-03-07' },
  { ref: 'SC Internacional', proveedor: 'api-football', id_externo: 'REEMPLAZAR', pais: 'Brasil',  fecha_fundacion: '1909-04-04' },
  { ref: 'CA Peñarol',       proveedor: 'api-football', id_externo: 'REEMPLAZAR', pais: 'Uruguay', fecha_fundacion: '1891-09-28' },
  { ref: 'Club Nacional',    proveedor: 'api-football', id_externo: 'REEMPLAZAR', pais: 'Uruguay', fecha_fundacion: '1899-05-14' },
];

// --- Jugadores nuevos (insert). id_externo = id de jugador de API-Football (Step 1). ---
const JUGADORES_NUEVOS = [
  { ref: 'Rodrigo Aguirre',     proveedor: 'api-football', id_externo: 'REEMPLAZAR', club: 'Tigres UANL',      fecha_nacimiento: '1994-10-01', debut: '2011-09-04', debut_seleccion: '2024-11-15' },
  { ref: 'Sergio Rochet',       proveedor: 'api-football', id_externo: 'REEMPLAZAR', club: 'SC Internacional', fecha_nacimiento: '1993-03-23', debut: '2014-08-30', debut_seleccion: '2022-01-27' },
  { ref: 'Abel Hernández',      proveedor: 'api-football', id_externo: 'REEMPLAZAR', club: 'CA Peñarol',       fecha_nacimiento: '1990-08-08', debut: '2007-04-22', debut_seleccion: '2010-08-11' },
  { ref: 'Gastón Martirena',    proveedor: 'api-football', id_externo: 'REEMPLAZAR', club: 'Club Nacional',    fecha_nacimiento: '2000-01-05', debut: null,         debut_seleccion: null },
  { ref: 'Luis Mejía',          proveedor: 'api-football', id_externo: 'REEMPLAZAR', club: 'Club Nacional',    fecha_nacimiento: '1991-03-16', debut: '2010-08-21', debut_seleccion: '2009-06-07' },
  { ref: 'Maximiliano Silvera', proveedor: 'api-football', id_externo: 'REEMPLAZAR', club: 'Club Nacional',    fecha_nacimiento: '1997-09-05', debut: '2015-03-21', debut_seleccion: null },
  { ref: 'Franco Romero',       proveedor: 'api-football', id_externo: 'REEMPLAZAR', club: 'CA Peñarol',       fecha_nacimiento: '1995-02-11', debut: '2015-03-22', debut_seleccion: null },
];

// --- Existentes: SOLO prender servicio_contenido. ---
const EXISTENTES_CONTENIDO = ['67884', '310307', '6122', '377326', '51549'];

/** UPSERT por (proveedor_externo, id_externo): update si existe, insert si no. Devuelve el id. */
async function upsert(tabla, proveedor, id_externo, campos, ref) {
  const { data: fila, error: errBuscar } = await admin
    .from(tabla)
    .select('id')
    .eq('proveedor_externo', proveedor)
    .eq('id_externo', id_externo)
    .maybeSingle();
  if (errBuscar) throw errBuscar;

  if (fila) {
    const { error } = await admin.from(tabla).update(campos).eq('id', fila.id);
    if (error) throw error;
    console.log(`= ${ref.padEnd(20)} update`);
    return fila.id;
  }
  const { data: nueva, error } = await admin
    .from(tabla)
    .insert({ proveedor_externo: proveedor, id_externo, origen: 'manual', ...campos })
    .select('id')
    .single();
  if (error) throw error;
  console.log(`+ ${ref.padEnd(20)} insert`);
  return nueva.id;
}

console.log('Clubes nuevos:');
const clubIdPorRef = {};
for (const c of CLUBES) {
  clubIdPorRef[c.ref] = await upsert(
    'clubes', c.proveedor, c.id_externo,
    { nombre: c.ref, pais: c.pais, fecha_fundacion: c.fecha_fundacion },
    c.ref,
  );
}

console.log('\nJugadores nuevos (servicio_contenido, NO match_day):');
for (const j of JUGADORES_NUEVOS) {
  await upsert(
    'jugadores', j.proveedor, j.id_externo,
    {
      nombre: j.ref,
      fecha_nacimiento: j.fecha_nacimiento,
      debut: j.debut,
      debut_seleccion: j.debut_seleccion,
      club_actual_id: clubIdPorRef[j.club] ?? null,
      activo: true,
      servicio_match_day: false,
      servicio_contenido: true,
    },
    j.ref,
  );
}

console.log('\nExistentes → servicio_contenido = true (nada más):');
for (const id_externo of EXISTENTES_CONTENIDO) {
  const { data, error } = await admin
    .from('jugadores')
    .update({ servicio_contenido: true })
    .eq('proveedor_externo', 'api-football')
    .eq('id_externo', id_externo)
    .select('nombre')
    .maybeSingle();
  if (error) throw error;
  console.log(data ? `= ${data.nombre}` : `⚠ id_externo ${id_externo} no encontrado`);
}

console.log(`\n✅ ${CLUBES.length} clubes, ${JUGADORES_NUEVOS.length} jugadores nuevos, ${EXISTENTES_CONTENIDO.length} existentes marcados.`);
```

- [ ] **Step 3: `enriquecer-jugadores-contenido.mjs`**

Create `scripts/enriquecer-jugadores-contenido.mjs`:

```js
/**
 * Completa posición / nacionalidad / foto_url de los 7 jugadores nuevos del servicio
 * "Contenido" desde API-Football (plan free). Solo lectura contra la API; UPDATE solo de
 * esos 3 campos y solo si la API los devuelve. Lo que no resuelva queda null → "Sin datos".
 *
 * Uso: npm run enriquecer:jugadores-contenido   (correr después de seed:jugadores-contenido)
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
 */
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.secretos/.env');
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_FOOTBALL_KEY } = process.env;
if (!SUPABASE_SERVICE_ROLE_KEY || !API_FOOTBALL_KEY) {
  console.error('Faltan SUPABASE_SERVICE_ROLE_KEY o API_FOOTBALL_KEY en .secretos/.env');
  process.exit(1);
}
const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Los mismos 7 ids que cargó seed-jugadores-contenido.mjs (proveedor api-football).
const IDS = ['REEMPLAZAR', 'REEMPLAZAR', 'REEMPLAZAR', 'REEMPLAZAR', 'REEMPLAZAR', 'REEMPLAZAR', 'REEMPLAZAR'];

async function perfil(playerId) {
  const r = await fetch(`https://v3.football.api-sports.io/players/profiles?player=${playerId}`, {
    headers: { 'x-apisports-key': API_FOOTBALL_KEY },
  });
  const j = await r.json();
  const p = j?.response?.[0]?.player;
  if (!p) return null;
  return {
    posicion: p.position ?? null,
    nacionalidad: p.nationality ?? null,
    foto_url: p.photo ?? null,
  };
}

for (const id_externo of IDS) {
  if (id_externo === 'REEMPLAZAR' || id_externo.startsWith('manual:')) {
    console.log(`· ${id_externo} — se saltea (sin id de API-Football)`);
    continue;
  }
  const datos = await perfil(id_externo);
  if (!datos) {
    console.log(`⚠ ${id_externo} — la API no devolvió perfil; queda "Sin datos"`);
    continue;
  }
  const campos = Object.fromEntries(Object.entries(datos).filter(([, v]) => v != null));
  if (!Object.keys(campos).length) {
    console.log(`· ${id_externo} — sin campos nuevos`);
    continue;
  }
  const { data, error } = await admin
    .from('jugadores')
    .update(campos)
    .eq('proveedor_externo', 'api-football')
    .eq('id_externo', id_externo)
    .select('nombre')
    .maybeSingle();
  if (error) throw error;
  console.log(`= ${data?.nombre ?? id_externo}: ${Object.keys(campos).join(', ')}`);
  await new Promise((r) => setTimeout(r, 200)); // pace API-Football
}

console.log('\n✅ Enriquecimiento terminado.');
```

- [ ] **Step 4: `package.json` — scripts**

En `scripts`, después de `"seed:datos-manuales"`:

```json
    "seed:jugadores-contenido": "node scripts/seed-jugadores-contenido.mjs",
    "enriquecer:jugadores-contenido": "node scripts/enriquecer-jugadores-contenido.mjs",
```

- [ ] **Step 5: Correr los seeds**

Run: `npm run seed:jugadores-contenido`
Expected: 4 clubes + 7 jugadores insert/update, 5 existentes marcados, sin error.

Run: `npm run enriquecer:jugadores-contenido`
Expected: por cada id, o `=` con campos, o `⚠`/`·` si la API no lo trae. Sin throw.

Run: `npm run seed:escudos`
Expected: los 4 clubes nuevos con `proveedor_externo='api-football'` reciben `escudo_url` del CDN; los que el CDN no tenga quedan sin escudo (fallback a iniciales).

- [ ] **Step 6: Verificar contadores en la BD**

```sql
select count(*) from jugadores where servicio_contenido;                        -- 12
select count(*) from jugadores where servicio_match_day;                        -- 6
select count(*) from jugadores where servicio_contenido and not servicio_match_day; -- 7
select count(*) from agenda_contenido;                                          -- > 0 (cumpleaños/aniv. de los 12, x [-1,+2] años)
select fuente, count(*) from agenda_contenido group by 1 order by 1;
```

Gate Match Day de nuevo: correr la query del Task 2 Step 1 y diffear contra `/tmp/agenda_antes.txt` → **sigue vacío** (los 7 nuevos son `servicio_match_day=false`, no entran a `agenda_anual`).

- [ ] **Step 7: Commit**

```bash
git add scripts/seed-jugadores-contenido.mjs scripts/enriquecer-jugadores-contenido.mjs package.json
git commit -m "feat(seed): roster del servicio Contenido — 7 jugadores + 4 clubes nuevos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Verificación de punta a punta, avances.md y deploy

**Files:**
- Modify: `planeacion/avances.md`

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: PASS. Anotá el número de tests (subió respecto de 90).
Run: `npm run build && npm run lint`
Expected: compila, sin errores.

- [ ] **Step 2: Gate Match Day final (navegador)**

Con `npm run dev` y `browser-automation` (login real):
- `/calendario` (Match Day): franja de densidad, celdas del mes y "Fechas señaladas" **iguales** a antes de la sesión (comparar contra una captura previa o contra producción). Nav dice "Match Day". 0 errores de consola.

- [ ] **Step 3: Calendario General**

`browser-automation` (login real):
- `/calendario-general`: la grilla del mes muestra cumpleaños / aniversarios de los 12 (chips con etiqueta "Cumpleaños" / "Aniversario" / "Selección" / "Debut profesional"). La franja de densidad no cuenta partidos (queda en `–` / 0 — es esperado, esta vista no tiene partidos). "Fechas señaladas" lista las próximas. 0 errores.
- Navegá 2-3 meses adelante y atrás: los eventos se reubican bien, sin pedir nada al server.

- [ ] **Step 4: Jugadores + buscador + ficha slim**

`browser-automation` (login real):
- `/jugadores`: 13 tarjetas. Las 7 nuevas (Aguirre, Rochet, Abel Hernández, Martirena, Mejía, Silvera, Romero) con el pill **"Contenido"** en vez del país; fila de stats en "—".
- Clic en una tarjeta nueva → abre el **panel slim**: cabecera + "Datos para contenido" + "Fechas señaladas". Sin bloques de Hitos / Este año / Carrera / Próximos partidos.
- Clic en una tarjeta de los 6 de siempre → abre la ficha completa como antes.
- Buscador ⌘K: "rochet" → aparece Sergio Rochet con tag "Contenido"; al elegirlo abre el panel slim. "nández" → sigue trayendo a los de siempre.
- Ruta directa `/jugadores/<uuid-de-un-nuevo>` → renderiza la ficha slim (no la completa con "Sin datos").
- 0 errores de consola en todo.

- [ ] **Step 5: avances.md**

En `planeacion/avances.md`:
1. Cabecera `**Última actualización:**` → `2026-09-10 (Sesión 7: Calendario General + rótulo Match Day IMPLEMENTADO y desplegado; 7 jugadores del servicio de contenido)`.
2. En `**Sesión 7 (2026-09-10):**` del bloque de estado, reemplazar "solo diseño / en pausa" por el resumen de lo hecho (migración 0014, vista `agenda_contenido`, ruta `/calendario-general`, ficha slim, seed de 7+4, nav de 4 ítems, gate Match Day OK, N tests).
3. §4: agregar `### 2026-09-10 — Sesión 7 (cont.: implementación del Calendario General)` con el detalle (qué archivos, qué verificó `browser-automation`, contador de tests).
4. §5: marcar `[x]` el ítem "Implementar el spec…"; **dejar** la tarea de investigación de fundaciones (Atlante / Bragantino). Agregar como nueva línea: `[ ] cargar debut_seleccion de Kevin Amaro (2025-09-09, pestaña "Nuevos") — es Match Day, cambiarlo mueve agenda_anual; evaluar aparte. — baja`.
5. La tabla de §3 si querés: sumar `agenda_contenido`, `seed-jugadores-contenido.mjs`, `FichaContenido.tsx`, `cargar-ficha-contenido.ts` (opcional).

- [ ] **Step 6: Commit + push (deploy)**

```bash
git add planeacion/avances.md
git commit -m "avances: Sesión 7 — Calendario General implementado y verificado

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 7: Verificar en Vercel**

Cuando el deploy de Vercel termine, abrir la URL de producción (login real):
- Nav de 4 ítems, `/calendario-general` con datos, `/jugadores` con las 7 tarjetas "Contenido", `/calendario` = Match Day sin cambios.
- Mobile 390px: sin scroll horizontal; el nav scrollea; el panel slim a pantalla completa.
- Avisar a Gerardo: listo para que la agencia lo mire y comente.

---

## Self-Review

**1. Spec coverage:**

| Spec §| Cubierto por |
|---|---|
| §4 Nav 4 ítems + rótulo Match Day + página nueva | Task 4 |
| §5.1 columnas de servicio | Task 2 Step 2 |
| §5.2 guardia en `agenda_anual` | Task 2 Step 2 (bloques 4/5/6) + gate Step 4 |
| §5.3 vista `agenda_contenido` (4 fuentes) | Task 2 Step 2 |
| §5.4 sin cambios de RLS | `security_invoker=true` en el `create view` (Task 2); no se agregan policies |
| §5.6 `npm run tipos:db` | Task 2 Step 6 |
| §6 `FuenteAgenda`+`aniversario_debut`, `FUENTES_CONTENIDO`, `textoFuente` | Task 1 Step 1 |
| §6 `repositorio-agenda` parametrizado | Task 3 Step 3 |
| §6 `repositorio-jugadores` + `tipos.ts` (`soloContenido`) | Task 3 Steps 1-2 |
| §6 `chipEvento` caso nuevo | Task 1 Steps 5-6 |
| §7 grilla badge + ruteo | Task 6 Step 2 |
| §7 `use-panel`, `cargar-ficha-contenido`, endpoint | Task 5 Steps 1-3 |
| §7 `PanelLateral`, `FichaContenido`, `PanelJugadorContenido` | Task 5 Steps 4-6 |
| §7 branch en `/jugadores/[id]` | Task 5 Step 7 |
| §7 buscador | Task 6 Step 3 |
| §7 `styles/app.css` | Task 6 Step 1 |
| §8 seed jugadores/clubes + enriquecer + escudos + `package.json` | Task 7 |
| §9 tarea de investigación fundaciones | Task 8 Step 5 (se deja anotada; no se toca el seed) |
| §10 verificación interna + gate Match Day | Tasks 2/4/7/8 |
| §11 archivos | cubiertos en los "Files" de cada task |

Sin huecos.

**2. Placeholder scan:** Los únicos `REEMPLAZAR` son ids de API-Football que el Task 7 Step 1 obliga a resolver antes de correr el seed — es un paso explícito con el cómo, no un placeholder de diseño. Sin "TBD"/"ver Task N"/"manejar errores" sueltos.

**3. Type consistency:**
- `soloContenido` — mismo nombre en `tipos.ts` (Task 3), `cargar-ficha-contenido.ts`, `GrillaPlantel.tsx`, `Buscador.tsx`, ruta SSR (Tasks 5-6).
- `clubFechaFundacion` — definido en `JugadorPlantel` (Task 3), consumido en `cargar-ficha-contenido.ts` (Task 5).
- `FichaContenidoBundle { jugador, proximas, hoyUy }` / `ProximaFecha { etiqueta, proximaIso }` — mismos campos en la definición (Task 5 Step 2), en `FichaContenido.tsx` (Step 4), `PanelJugadorContenido.tsx` (Step 5), `PanelLateral.tsx` (Step 6).
- `'jugador-contenido'` — mismo literal en `TipoPanel` (Task 5 Step 1), `PanelLateral` (Step 6), `GrillaPlantel`/`Buscador` (Task 6), endpoint path.
- `proximoAniversario(fechaIso, hoyUy)` — firma idéntica en Task 1 Step 4 y su uso en Task 5 Step 2.
- `chipEvento(e)` — misma firma al extraer (Task 1 Step 5) y al importar (Step 6).
- `RepositorioAgendaSupabase(supabase, vista?)` — 2º arg opcional (Task 3), usado con `'agenda_contenido'` en Task 4.
- `agenda_contenido` — mismas 11 columnas y orden que `agenda_anual`, verificado contra el `select` de 0013.

Sin inconsistencias.

---

## Execution Handoff

Plan completo y guardado en `planeacion/plans/2026-09-10-calendario-general.md`. Dos formas de ejecutarlo:

1. **Subagent-Driven (recomendado)** — un subagente fresco por task, revisión entre tasks.
2. **Inline** — ejecutar en esta sesión con checkpoints.
