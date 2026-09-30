# Partidos de los uruguayos y de la selección (ESPN) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Traer de ESPN los partidos de Peñarol y Nacional (para los 4 uruguayos de Contenido) y los de la selección uruguaya, y mostrarlos en Contenido y en un filtro nuevo "Selección" (calendario y /partidos).

**Architecture:** Una Edge Function nueva `sync-espn-uruguay` (Deno) reusa `_shared/espn-api.ts` y `_shared/espn-partido.ts`; su lógica pura vive en `_shared/espn-uruguay.ts` (testeable con `node --test`). La migración `0031` siembra competencias y el "club" Uruguay, crea la vista `partidos_seleccion`, suma la fuente al cartel de avisos y agenda el cron. El front suma el filtro `seleccion` en el calendario y en /partidos con funciones puras testeadas.

**Tech Stack:** Supabase Postgres (vistas `security_invoker`, pg_cron + pg_net), Edge Functions Deno, Next.js 14 App Router, `node --test`, `pg` con ROLLBACK para tests de base.

**Spec:** `planeacion/specs/2026-09-30-espn-uruguay.md`

## Global Constraints

- Contenido y Selección **no generan ticket ni llevan color de estado** (solo Match Day).
- Selección aparece en su filtro **Selección** y también en **Todos** (calendario y /partidos).
- No se toca Match Day / SportMonks ni `sync-fixtures-espn` (queda apagada).
- ESPN: ventana −3 días / +300 días, upsert por (`proveedor_externo='espn'`, `id_externo=<eventId>`).
- Vínculo jugador↔partido: jugadores `activo`, `servicio_contenido`, **sin** `servicio_match_day`, con `club_actual_id` = el club; se recalcula en cada corrida.
- Bitácora: `sincronizaciones` con `proveedor='espn'`, `recurso='partidos'`; aviso a las 36 h.
- Cron diario `0 7 * * *` (04:00 UY).
- Claude NO corre `deploy:funcion`, `git push`, ni aplica migraciones: las corre Gerardo (§10b). Nunca `npm run build`/`next start`; QA con `next dev -p 3100` y apagarlo después (TaskStop + Stop-Process).
- Archivos con CRLF: editar con Edit o scripts `.cjs` que respeten el fin de línea.
- Textos de UI en español rioplatense (como el resto de la app).

## Review Focus

1. **Clásico Peñarol vs Nacional:** un solo partido en `partidos` (no dos), vinculado a los 4 uruguayos, y el rival de cada lado es el otro club de la cartera, no un club "ESPN 2684" duplicado. → test de `mapaCarteraEspn` (Task 1).
2. **Uruguay convocando a un representado de Match Day:** en **Todos** el partido aparece una sola vez (gana Match Day); en **Selección** se ve siempre. → tests de `unirConSeleccion` (Task 4) y `quitarSeleccionDuplicada` (Task 5).
3. **Una liga de ESPN que falla (400/timeout):** la corrida sigue con las demás y queda `parcial`, no `error`, si guardó algo. → estructura de la función (Task 3) + corrida manual.
4. **Jugador uruguayo que cambia a un club fuera de la config:** deja de vincularse a partidos de Peñarol/Nacional en la corrida siguiente. → test de `jugadoresPorClub` (Task 1).
5. **Tarjeta/chip de la selección:** no abre panel, no muestra cara de jugador ni Dropbox ni semáforo. → test de `listaSegunFiltro` + QA (Tasks 4, 6).

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/functions/_shared/espn-uruguay.ts` (+ `.test.ts`) | Config de equipos×ligas y helpers puros (tareas, vínculo jugadores, cartera ESPN, zona) |
| `supabase/functions/_shared/zona-pais.ts` | + India (rival del 6/10) |
| `supabase/functions/sync-espn-uruguay/index.ts` | Orquestador: ESPN → `partidos` / `partidos_jugadores` / `sincronizaciones` |
| `supabase/migrations/0031_espn_uruguay.sql` | Competencias ESPN, club Uruguay, vista `partidos_seleccion`, aviso, cron |
| `scripts/espn-uruguay.test.mjs` | Tests de base de 0031 (ROLLBACK) |
| `lib/repositorios/repositorio-partidos.ts`, `lib/repositorios/tipos.ts` | `listarProximosSeleccion`, `esSeleccion` |
| `lib/partidos/utilidades.ts` | `FiltroPartidos` + `'seleccion'` |
| `lib/partidos/seleccion.ts` (+ test) | `unirConSeleccion`, `listaSegunFiltro` (solo imports de tipo: `node --test` no resuelve `@/` en imports de valor) |
| `components/partidos/{BarraFiltros,SeccionPartidos,ListaPartidos,TarjetaPartido}.tsx`, `app/(app)/partidos/page.tsx` | Chip y tarjetas de la selección |
| `lib/calendario/eventos.ts` (+ test), `lib/repositorios/repositorio-agenda.ts` | Grupo/filtro `seleccion`, `quitarSeleccionDuplicada`, `listarPartidosSeleccion` |
| `components/calendario/Calendario.tsx`, `app/(app)/calendario/page.tsx` | Chip Selección en el calendario |

---

### Task 1: Lógica pura de la sync (`_shared/espn-uruguay.ts`)

**Files:**
- Create: `supabase/functions/_shared/espn-uruguay.ts`
- Create: `supabase/functions/_shared/espn-uruguay.test.ts`
- Modify: `supabase/functions/_shared/zona-pais.ts` (agregar India), `supabase/functions/_shared/zona-pais.test.ts`

**Interfaces:**
- Produces:
  - `type RefCompetencia = { proveedor: 'api-football' | 'espn'; idExterno: string }`
  - `interface EquipoUruguay { clave: 'penarol' | 'nacional' | 'uruguay'; espnTeamId: string; clubAfId: string | null; esSeleccion: boolean; ligas: Array<{ slug: string; competencia: RefCompetencia }> }`
  - `const EQUIPOS_URUGUAY: EquipoUruguay[]`
  - `const URUGUAY_ESPN_ID = '212'`
  - `tareasDeSync(equipos?: EquipoUruguay[]): Array<{ equipo: EquipoUruguay; slug: string; competencia: RefCompetencia }>`
  - `claveCompetencia(ref: RefCompetencia): string` → `'<proveedor>:<idExterno>'`
  - `jugadoresPorClub(jugadores: JugadorSync[], clubIds: string[]): Map<string, string[]>` con `JugadorSync = { id: string; club_actual_id: string | null; activo: boolean; servicio_match_day: boolean; servicio_contenido: boolean }`
  - `mapaCarteraEspn(clubIdPorAf: Map<string, string>, equipos?: EquipoUruguay[]): Map<string, string>` (espnTeamId → uuid de nuestro club)
  - `zonaDeSede(sedePais: string | null, slug: string): string | null`

- [ ] **Step 1: Write the failing test** — `supabase/functions/_shared/espn-uruguay.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EQUIPOS_URUGUAY, URUGUAY_ESPN_ID, tareasDeSync, claveCompetencia, jugadoresPorClub, mapaCarteraEspn, zonaDeSede,
} from './espn-uruguay.ts';

test('tareasDeSync: Peñarol y Nacional × 3 ligas + Uruguay × 4 = 10 tareas', () => {
  const t = tareasDeSync();
  assert.equal(t.length, 10);
  assert.deepEqual(
    t.filter((x) => x.equipo.clave === 'uruguay').map((x) => x.slug),
    ['fifa.friendly', 'fifa.worldq.conmebol', 'conmebol.america', 'fifa.world'],
  );
  assert.deepEqual(t.find((x) => x.equipo.clave === 'penarol' && x.slug === 'conmebol.libertadores')?.competencia, { proveedor: 'api-football', idExterno: '13' });
  assert.equal(EQUIPOS_URUGUAY.find((e) => e.esSeleccion)?.espnTeamId, URUGUAY_ESPN_ID);
});

test('claveCompetencia', () => {
  assert.equal(claveCompetencia({ proveedor: 'espn', idExterno: 'uru.1' }), 'espn:uru.1');
});

test('jugadoresPorClub: solo activos, solo-Contenido, del club pedido', () => {
  const base = { activo: true, servicio_match_day: false, servicio_contenido: true };
  const m = jugadoresPorClub(
    [
      { ...base, id: 'abel', club_actual_id: 'PEN' },
      { ...base, id: 'franco', club_actual_id: 'PEN' },
      { ...base, id: 'silvera', club_actual_id: 'NAC' },
      { ...base, id: 'md', club_actual_id: 'PEN', servicio_match_day: true },
      { ...base, id: 'baja', club_actual_id: 'PEN', activo: false },
      { ...base, id: 'seFue', club_actual_id: 'BOCA' }, // cambió de club: ya no se vincula
    ],
    ['PEN', 'NAC'],
  );
  assert.deepEqual(m.get('PEN'), ['abel', 'franco']);
  assert.deepEqual(m.get('NAC'), ['silvera']);
  assert.equal(m.has('BOCA'), false);
});

test('mapaCarteraEspn: clásico — cada club ESPN apunta a nuestro uuid (no se crea un rival duplicado)', () => {
  const m = mapaCarteraEspn(new Map([['2348', 'uuid-pen'], ['2356', 'uuid-nac']]));
  assert.equal(m.get('2683'), 'uuid-pen');
  assert.equal(m.get('2684'), 'uuid-nac');
  assert.equal(m.has(URUGUAY_ESPN_ID), false); // la selección se resuelve aparte
});

test('zonaDeSede: país conocido; uru.1 sin país → Montevideo; selección sin país → null', () => {
  assert.equal(zonaDeSede('India', 'fifa.friendly'), 'Asia/Kolkata');
  assert.equal(zonaDeSede(null, 'uru.1'), 'America/Montevideo');
  assert.equal(zonaDeSede(null, 'fifa.friendly'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `fail 1` (no existe `./espn-uruguay.ts`).

- [ ] **Step 3: Write minimal implementation** — `supabase/functions/_shared/espn-uruguay.ts`

```ts
/**
 * Config y lógica pura de `sync-espn-uruguay` (puntos 4 y 9 de la agencia, 2026-09-30):
 * partidos de Peñarol y Nacional (jugadores solo-Contenido uruguayos) y de la selección
 * uruguaya, desde ESPN (gratis). Sin dependencias de Deno — testeable con `node --test`.
 *
 * Ids de ESPN verificados en vivo 2026-09-30: Peñarol 2683, Nacional 2684, Uruguay 212.
 * `clubAfId` es el `clubes.id_externo` (API-Football) de nuestro club, clave estable para
 * encontrar su uuid. Las competencias que ya existían se referencian por su id de
 * API-Football; las nuevas las siembra la migración 0031 con `proveedor_externo='espn'`.
 *
 * Football First. Creado 2026-09-30.
 */
import { zonaDePais } from './zona-pais.ts';

export type RefCompetencia = { proveedor: 'api-football' | 'espn'; idExterno: string };

export interface EquipoUruguay {
  clave: 'penarol' | 'nacional' | 'uruguay';
  espnTeamId: string;
  /** `clubes.id_externo` (API-Football) de nuestro club; `null` para la selección. */
  clubAfId: string | null;
  esSeleccion: boolean;
  ligas: Array<{ slug: string; competencia: RefCompetencia }>;
}

export const URUGUAY_ESPN_ID = '212';

const LIGAS_CLUB: EquipoUruguay['ligas'] = [
  { slug: 'uru.1', competencia: { proveedor: 'espn', idExterno: 'uru.1' } },
  { slug: 'conmebol.libertadores', competencia: { proveedor: 'api-football', idExterno: '13' } },
  { slug: 'conmebol.sudamericana', competencia: { proveedor: 'api-football', idExterno: '11' } },
];

export const EQUIPOS_URUGUAY: EquipoUruguay[] = [
  { clave: 'penarol', espnTeamId: '2683', clubAfId: '2348', esSeleccion: false, ligas: LIGAS_CLUB },
  { clave: 'nacional', espnTeamId: '2684', clubAfId: '2356', esSeleccion: false, ligas: LIGAS_CLUB },
  {
    clave: 'uruguay',
    espnTeamId: URUGUAY_ESPN_ID,
    clubAfId: null,
    esSeleccion: true,
    ligas: [
      { slug: 'fifa.friendly', competencia: { proveedor: 'espn', idExterno: 'fifa.friendly' } },
      { slug: 'fifa.worldq.conmebol', competencia: { proveedor: 'api-football', idExterno: '34' } },
      { slug: 'conmebol.america', competencia: { proveedor: 'espn', idExterno: 'conmebol.america' } },
      { slug: 'fifa.world', competencia: { proveedor: 'espn', idExterno: 'fifa.world' } },
    ],
  },
];

/** Una tarea por equipo × liga, en el orden de la config. */
export function tareasDeSync(equipos: EquipoUruguay[] = EQUIPOS_URUGUAY) {
  return equipos.flatMap((equipo) => equipo.ligas.map(({ slug, competencia }) => ({ equipo, slug, competencia })));
}

export function claveCompetencia(ref: RefCompetencia): string {
  return `${ref.proveedor}:${ref.idExterno}`;
}

export type JugadorSync = {
  id: string;
  club_actual_id: string | null;
  activo: boolean;
  servicio_match_day: boolean;
  servicio_contenido: boolean;
};

/**
 * Jugadores a vincular por club: activos, de Contenido y NO de Match Day (los de Match Day ya
 * los trae SportMonks). Se recalcula en cada corrida: si uno cambia de club, deja de vincularse.
 */
export function jugadoresPorClub(jugadores: JugadorSync[], clubIds: string[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const j of jugadores) {
    if (!j.activo || j.servicio_match_day || !j.servicio_contenido || !j.club_actual_id) continue;
    if (!clubIds.includes(j.club_actual_id)) continue;
    const lista = m.get(j.club_actual_id) ?? [];
    lista.push(j.id);
    m.set(j.club_actual_id, lista);
  }
  return m;
}

/** id de equipo de ESPN → uuid de nuestro club (Peñarol/Nacional). En un clásico, el rival
 *  se resuelve con esto y no se crea un club "ESPN 2684" duplicado. */
export function mapaCarteraEspn(clubIdPorAf: Map<string, string>, equipos: EquipoUruguay[] = EQUIPOS_URUGUAY): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of equipos) {
    const uuid = e.clubAfId ? clubIdPorAf.get(e.clubAfId) : undefined;
    if (uuid) m.set(e.espnTeamId, uuid);
  }
  return m;
}

/** Zona de la sede: por país; `uru.1` se juega en Uruguay; si no se sabe, `null` (nunca se inventa). */
export function zonaDeSede(sedePais: string | null, slug: string): string | null {
  return zonaDePais(sedePais) ?? (slug === 'uru.1' ? 'America/Montevideo' : null);
}
```

En `supabase/functions/_shared/zona-pais.ts`, dentro de `ZONA_POR_PAIS`, agregar después de `portugal: 'Europe/Lisbon',`:

```ts
  // Amistosos de la selección uruguaya (2026-09-30: Uruguay vs India)
  india: 'Asia/Kolkata',
```

y en `zona-pais.test.ts` un test:

```ts
test('India (amistoso de Uruguay, 2026-10-06)', () => {
  assert.equal(zonaDePais('India'), 'Asia/Kolkata');
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `fail 0`, 6 tests nuevos pasando (≈201).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/espn-uruguay.ts supabase/functions/_shared/espn-uruguay.test.ts supabase/functions/_shared/zona-pais.ts supabase/functions/_shared/zona-pais.test.ts
git commit -m "feat(espn-uruguay): config y lógica pura de la sync de Peñarol, Nacional y Uruguay"
```

---

### Task 2: Migración `0031` + tests de base

**Files:**
- Create: `supabase/migrations/0031_espn_uruguay.sql`
- Create: `scripts/espn-uruguay.test.mjs`
- Modify: `package.json` (script `test:espn-uruguay`)

**Interfaces:**
- Consumes: slugs/ids de Task 1 (`uru.1`, `fifa.friendly`, `conmebol.america`, `fifa.world`, club `espn/212`).
- Produces: vista `partidos_seleccion` (mismas columnas que `proximos_partidos_contenido`, jugador_* = Uruguay); fuente `espn/partidos` en `avisos_sistema()`; cron `sync-espn-uruguay-diario`.

- [ ] **Step 1: Write the failing test** — `scripts/espn-uruguay.test.mjs`

```js
// Tests de la migración 0031 (ESPN Uruguay) contra la base real, siempre con ROLLBACK.
// Correr: npm run test:espn-uruguay
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

process.loadEnvFile('.secretos/.env');
const require = createRequire(import.meta.url);
const { Client } = require('pg');
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DB_PASSWORD } = process.env;
const ref = new URL(NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const c = new Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(SUPABASE_DB_PASSWORD)}@db.${ref}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
const MIGRACION = readFileSync(new URL('../supabase/migrations/0031_espn_uruguay.sql', import.meta.url), 'utf8')
  .replace(/^\s*begin;\s*$/m, '')
  .replace(/^\s*commit;\s*$/m, '');
let aplicada = false;
const ids = {};

before(async () => {
  await c.connect();
  const r = await c.query(`select to_regclass('public.partidos_seleccion') is not null as ok`);
  aplicada = r.rows[0].ok;
  const u = await c.query(`select email, id from auth.users where email in ('felipe@footballfirst.uy','maxi@footballfirst.uy')`);
  for (const x of u.rows) ids[x.email.split('@')[0]] = x.id;
  assert.ok(ids.felipe && ids.maxi, 'faltan usuarios');
});
after(async () => c.end());

async function enTransaccion(fn) {
  await c.query('begin');
  try {
    if (!aplicada) await c.query(MIGRACION);
    await fn(c);
  } finally {
    await c.query('rollback');
  }
}
async function como(uid) {
  await c.query('reset role');
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
  await c.query('set local role authenticated');
}
async function comoDueno() {
  await c.query('reset role');
  await c.query(`select set_config('request.jwt.claims', '', true)`);
}
/** Crea un partido ESPN de prueba en 2030 entre `localId` y `visitanteId` con la competencia dada. */
async function partido(localId, visitanteId, competenciaId, idExterno) {
  await comoDueno();
  const r = await c.query(
    `insert into partidos (competencia_id, club_local_id, club_visitante_id, inicio_utc, zona_horaria_evento, estado, origen, proveedor_externo, id_externo)
     values ($1, $2, $3, '2030-06-10T20:00:00Z', 'America/Montevideo', 'programado', 'api', 'espn', $4) returning id`,
    [competenciaId, localId, visitanteId, idExterno],
  );
  return r.rows[0].id;
}
const uno = async (sql, p = []) => (await c.query(sql, p)).rows[0];

test('siembra: competencias ESPN y club Uruguay (212), una sola vez', () =>
  enTransaccion(async () => {
    await comoDueno();
    const comp = await c.query(`select id_externo, codigo, tipo from competencias where proveedor_externo = 'espn' order by id_externo`);
    assert.deepEqual(comp.rows.map((r) => `${r.id_externo}:${r.codigo}:${r.tipo}`), [
      'conmebol.america:CAM:seleccion', 'fifa.friendly:AMI:seleccion', 'fifa.world:MUN:seleccion', 'uru.1:URU:liga',
    ]);
    const uy = await c.query(`select nombre, zona_horaria from clubes where proveedor_externo = 'espn' and id_externo = '212'`);
    assert.equal(uy.rows.length, 1);
    assert.equal(uy.rows[0].zona_horaria, 'America/Montevideo');
  }));

test('partidos_seleccion: trae el amistoso de Uruguay; no trae un partido de liga ni uno sin Uruguay', () =>
  enTransaccion(async () => {
    await comoDueno();
    const uy = (await uno(`select id from clubes where proveedor_externo = 'espn' and id_externo = '212'`)).id;
    const pen = (await uno(`select id from clubes where id_externo = '2348'`)).id;
    const nac = (await uno(`select id from clubes where id_externo = '2356'`)).id;
    const ami = (await uno(`select id from competencias where proveedor_externo = 'espn' and id_externo = 'fifa.friendly'`)).id;
    const uru1 = (await uno(`select id from competencias where proveedor_externo = 'espn' and id_externo = 'uru.1'`)).id;
    const pSel = await partido(pen, uy, ami, 'qa-sel-1'); // Uruguay de visitante (club Peñarol como rival de mentira)
    await partido(pen, nac, uru1, 'qa-liga-1');
    await partido(pen, nac, ami, 'qa-sin-uy');
    await como(ids.felipe);
    const r = await c.query(`select partido_id, jugador_nombre, club_nombre, rival_nombre, es_local, competencia_tipo, dia_uy::text
                             from partidos_seleccion where dia_uy = '2030-06-10'`);
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].partido_id, pSel);
    assert.equal(r.rows[0].jugador_nombre, 'Uruguay');
    assert.equal(r.rows[0].club_nombre, 'Uruguay');
    assert.equal(r.rows[0].es_local, false);
    assert.equal(r.rows[0].competencia_tipo, 'seleccion');
  }));

test('partidos_seleccion: anon no lee', () =>
  enTransaccion(async () => {
    await c.query('reset role');
    await c.query('set local role anon');
    await assert.rejects(c.query('select 1 from partidos_seleccion limit 1'), (e) => e.code === '42501');
  }));

test('avisos_sistema: la fuente de ESPN avisa si no corrió bien en 36 h', () =>
  enTransaccion(async () => {
    await comoDueno();
    await c.query(
      `insert into sincronizaciones (proveedor, recurso, iniciado_en, finalizado_en, estado, registros_afectados)
       values ('espn', 'partidos', now() - interval '40 hours', now() - interval '40 hours', 'error', 0)`,
    );
    await c.query(`delete from sincronizaciones where proveedor = 'espn' and recurso = 'partidos' and estado = 'ok' and finalizado_en > now() - interval '36 hours'`);
    await como(ids.felipe);
    const r = await c.query(`select clave from avisos_sistema()`);
    assert.ok(r.rows.some((x) => x.clave === 'fuente:espn/partidos'));
  }));

test('cron diario agendado', () =>
  enTransaccion(async () => {
    await comoDueno();
    const r = await c.query(`select schedule from cron.job where jobname = 'sync-espn-uruguay-diario'`);
    assert.equal(r.rows[0]?.schedule, '0 7 * * *');
  }));
```

En `package.json`, después de `"test:avisos": ...`, agregar: `"test:espn-uruguay": "node --test scripts/espn-uruguay.test.mjs"` (con la coma que corresponda).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:espn-uruguay 2>&1 | grep -E "^ℹ (pass|fail)|ENOENT"`
Expected: falla al leer `0031_espn_uruguay.sql` (ENOENT).

- [ ] **Step 3: Write the migration** — `supabase/migrations/0031_espn_uruguay.sql`

```sql
-- ============================================================================
-- Football First — Migración 0031: ESPN Uruguay (puntos 4 y 9 de la agencia)
--
-- 1. Competencias que trae ESPN y no teníamos (proveedor_externo='espn', id_externo=<slug>):
--    liga uruguaya, amistosos, Copa América, Mundial. Libertadores/Sudamericana/Eliminatorias
--    ya existen (api-football) y la sync las referencia por ese id.
-- 2. "Club" Uruguay (selección) con proveedor espn / id 212.
-- 3. Vista `partidos_seleccion`: partidos de Uruguay en competencias de selección, desde hace
--    3 días. MISMAS columnas que `proximos_partidos_contenido` (el front usa el mismo tipo);
--    las de jugador llevan los datos de Uruguay (no hay representado).
-- 4. `avisos_sistema()`: suma la fuente espn/partidos.
-- 5. Cron diario 07:00 UTC (04:00 UY) de `sync-espn-uruguay`.
--
-- Reversible: drop view partidos_seleccion; select cron.unschedule('sync-espn-uruguay-diario');
-- delete de las competencias/club espn si no tienen partidos; recrear avisos_sistema de 0029.
-- Football First. Creado 2026-09-30.
-- ============================================================================
begin;

insert into competencias (nombre, pais, tipo, codigo, origen, proveedor_externo, id_externo)
select v.nombre, v.pais, v.tipo::tipo_competencia, v.codigo, 'api'::origen_dato, 'espn', v.id_externo
from (values
  ('Primera División Uruguay', 'Uruguay', 'liga',      'URU', 'uru.1'),
  ('Amistoso internacional',   null,      'seleccion', 'AMI', 'fifa.friendly'),
  ('Copa América',             null,      'seleccion', 'CAM', 'conmebol.america'),
  ('Copa del Mundo',           null,      'seleccion', 'MUN', 'fifa.world')
) as v(nombre, pais, tipo, codigo, id_externo)
where not exists (
  select 1 from competencias c where c.proveedor_externo = 'espn' and c.id_externo = v.id_externo
);

insert into clubes (nombre, pais, zona_horaria, escudo_url, origen, proveedor_externo, id_externo)
select 'Uruguay', 'Uruguay', 'America/Montevideo', 'https://a.espncdn.com/i/teamlogos/countries/500/uru.png', 'api', 'espn', '212'
where not exists (select 1 from clubes where proveedor_externo = 'espn' and id_externo = '212');

create view partidos_seleccion
with (security_invoker = true) as
select
  p.id                         as partido_id,
  uy.id                        as jugador_id,
  uy.nombre                    as jugador_nombre,
  null::text                   as jugador_apodo,
  uy.escudo_url                as jugador_foto_url,
  'Uruguay'::text              as jugador_seleccion,
  true                         as con_seleccion,
  null::boolean                as convocado,
  c.id                         as competencia_id,
  c.nombre                     as competencia_nombre,
  c.codigo                     as competencia_codigo,
  c.tipo                       as competencia_tipo,
  true                         as es_internacional,
  c.cobertura                  as competencia_cobertura,
  uy.id                        as club_id,
  uy.nombre                    as club_nombre,
  uy.escudo_url                as club_escudo_url,
  riv.id                       as rival_id,
  riv.nombre                   as rival_nombre,
  riv.escudo_url               as rival_escudo_url,
  (p.club_local_id = uy.id)    as es_local,
  p.inicio_utc,
  p.zona_horaria_evento,
  (p.inicio_utc at time zone p.zona_horaria_evento)      as inicio_local_sede,
  (p.inicio_utc at time zone 'America/Montevideo')       as inicio_local_uy,
  (p.inicio_utc at time zone 'America/Montevideo')::date as dia_uy,
  p.estado,
  p.ronda,
  p.estadio,
  p.ciudad,
  p.marcador_local,
  p.marcador_visitante,
  (p.inicio_utc is not null and p.inicio_utc > now() + interval '90 days') as tentativo,
  p.sincronizado_en,
  coalesce(
    (p.inicio_utc at time zone p.zona_horaria_evento)::date,
    (p.inicio_utc at time zone 'America/Montevideo')::date
  ) as dia_local_sede
from partidos p
join clubes uy       on uy.proveedor_externo = 'espn' and uy.id_externo = '212'
                    and uy.id in (p.club_local_id, p.club_visitante_id)
join competencias c  on c.id = p.competencia_id and c.tipo = 'seleccion'
left join clubes riv on riv.id = case when p.club_local_id = uy.id then p.club_visitante_id else p.club_local_id end
where p.inicio_utc is null or p.inicio_utc > now() - interval '3 days';

comment on view partidos_seleccion is 'Partidos de la selección uruguaya (ESPN, 0031). Filtro "Selección" y "Todos" del calendario y /partidos. Mismas columnas que proximos_partidos_contenido.';

revoke all on partidos_seleccion from anon, authenticated;
grant select on partidos_seleccion to authenticated;
```

Luego, en el mismo archivo, **copiar entera** la función `avisos_sistema()` de `supabase/migrations/0029_avisos_sistema_y_codigos_sportmonks.sql` (desde `create or replace function avisos_sistema()` hasta sus `revoke`/`grant`) y agregar una fila a `fuentes`:

```sql
      ('sportmonks',   'roster',       'revisión semanal de traspasos',     interval '8 days'),
      ('espn',         'partidos',     'partidos de Uruguay (ESPN)',        interval '36 hours')
```

(la línea de `roster` pasa a terminar en coma). Cerrar con el cron y `commit;`:

```sql
select cron.schedule(
  'sync-espn-uruguay-diario',
  '0 7 * * *',
  $cron$
  select net.http_post(
    url     := 'https://thplgzufenxrzegwfxkg.functions.supabase.co/sync-espn-uruguay',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_functions_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);

commit;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:espn-uruguay 2>&1 | grep -E "^ℹ (pass|fail)|not ok"`
Expected: `pass 5`, `fail 0` (la migración se aplica dentro de la transacción y se deshace). Además `npm run test:avisos` sigue `pass 5`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0031_espn_uruguay.sql scripts/espn-uruguay.test.mjs package.json
git commit -m "feat(db): 0031 competencias ESPN, club Uruguay, vista partidos_seleccion, aviso y cron"
```

- [ ] **Step 6: Pedirle a Gerardo que aplique `0031` en el SQL Editor** (Ctrl+A del archivo). Verificar después con `supabase-js` (service role) que `partidos_seleccion` responde con `data` no nulo (`select('partido_id').limit(1)`; §10b: no usar `head:true`). Correr `npm run tipos:db` y commitear `lib/supabase/tipos-db.ts` (`chore(db): tipos con partidos_seleccion`).

---

### Task 3: Edge Function `sync-espn-uruguay`

**Files:**
- Create: `supabase/functions/sync-espn-uruguay/index.ts`

**Interfaces:**
- Consumes: Task 1 (`tareasDeSync`, `claveCompetencia`, `jugadoresPorClub`, `mapaCarteraEspn`, `zonaDeSede`, `URUGUAY_ESPN_ID`, `EQUIPOS_URUGUAY`); `_shared/espn-api.ts` (`esperarEntreLlamadasEspn`, `obtenerTemporadaVigente`, `listarEventosDeTemporada`, `obtenerEvento`, `obtenerEstadoEvento`); `_shared/espn-partido.ts` (`normalizarEvento`, `mapearEstadoEspn`, `EventoEspnCrudo`); Task 2 (competencias espn, club 212).
- Produces: filas en `partidos` (espn), `partidos_jugadores`, `sincronizaciones` (`espn`/`partidos`, `parametros.alcance='uruguay'`).

- [ ] **Step 1: Write the function** — `supabase/functions/sync-espn-uruguay/index.ts`

```ts
/**
 * sync-espn-uruguay — próximos partidos de Peñarol y Nacional (liga uruguaya + Libertadores
 * + Sudamericana) para los jugadores solo-Contenido uruguayos, y de la selección uruguaya
 * (amistosos, Eliminatorias, Copa América, Mundial), desde el core API de ESPN (gratis).
 * Puntos 4 y 9 de la agencia (spec planeacion/specs/2026-09-30-espn-uruguay.md).
 *
 * Mismo esquema que `sync-fixtures-espn` (apagada desde 0016): upsert por
 * (proveedor_externo='espn', id_externo=<eventId>), ventana −3/+300 días, un evento o una liga
 * que falla se anota y se sigue. Los partidos de la selección van sin `partidos_jugadores`
 * (se ven por la vista `partidos_seleccion`, 0031).
 *
 * Disparo: pg_cron 07:00 UTC (0031) o manual con `x-sync-secret`. Deploy con --no-verify-jwt.
 * Football First. Creado 2026-09-30.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  esperarEntreLlamadasEspn,
  listarEventosDeTemporada,
  obtenerEstadoEvento,
  obtenerEvento,
  obtenerTemporadaVigente,
} from '../_shared/espn-api.ts';
import { mapearEstadoEspn, normalizarEvento, type EventoEspnCrudo } from '../_shared/espn-partido.ts';
import {
  EQUIPOS_URUGUAY,
  URUGUAY_ESPN_ID,
  claveCompetencia,
  jugadoresPorClub,
  mapaCarteraEspn,
  tareasDeSync,
  zonaDeSede,
  type JugadorSync,
} from '../_shared/espn-uruguay.ts';

const PROVEEDOR = 'espn';
const DIA_MS = 86_400_000;
const NOVENTA_DIAS_MS = 90 * DIA_MS;
const TRES_DIAS_MS = 3 * DIA_MS;

function aAAAAMMDD(fecha: Date): string {
  return fecha.toISOString().slice(0, 10).replaceAll('-', '');
}

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-sync-secret') !== Deno.env.get('SYNC_FUNCTIONS_SECRET')) {
    return new Response('No autorizado', { status: 401 });
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const iniciadoEn = new Date().toISOString();
  let registros = 0;
  let errorDetalle: string | null = null;
  const errores: string[] = [];
  const ligasOk: string[] = [];

  try {
    // 1) Nuestros clubes (Peñarol, Nacional) por id de API-Football, y el "club" Uruguay.
    const afIds = EQUIPOS_URUGUAY.map((e) => e.clubAfId).filter((x): x is string => x !== null);
    const { data: clubes, error: errClubes } = await supabase
      .from('clubes').select('id, id_externo').eq('proveedor_externo', 'api-football').in('id_externo', afIds);
    if (errClubes) throw errClubes;
    const clubIdPorAf = new Map((clubes ?? []).map((c) => [c.id_externo as string, c.id as string]));
    const { data: uy, error: errUy } = await supabase
      .from('clubes').select('id').eq('proveedor_externo', PROVEEDOR).eq('id_externo', URUGUAY_ESPN_ID).single();
    if (errUy) throw new Error(`Falta el club Uruguay (¿se aplicó 0031?): ${errUy.message}`);
    const carteraPorEspnId = mapaCarteraEspn(clubIdPorAf);
    carteraPorEspnId.set(URUGUAY_ESPN_ID, uy.id);

    // 2) Jugadores a vincular por club (solo-Contenido, activos).
    const { data: jugadores, error: errJug } = await supabase
      .from('jugadores').select('id, club_actual_id, activo, servicio_match_day, servicio_contenido');
    if (errJug) throw errJug;
    const vinculos = jugadoresPorClub((jugadores ?? []) as JugadorSync[], [...clubIdPorAf.values()]);

    // 3) Competencias por (proveedor, id_externo).
    const { data: comps, error: errComps } = await supabase.from('competencias').select('id, proveedor_externo, id_externo');
    if (errComps) throw errComps;
    const competenciaId = new Map(
      (comps ?? []).map((c) => [`${c.proveedor_externo}:${c.id_externo}`, c.id as string]),
    );

    const ahora = Date.now();
    const rango = `${aAAAAMMDD(new Date(ahora - TRES_DIAS_MS))}-${aAAAAMMDD(new Date(ahora + 300 * DIA_MS))}`;
    const temporada = new Map<string, number>();

    // 4) Por cada equipo × liga. Una liga que falla no corta las demás.
    for (const { equipo, slug, competencia } of tareasDeSync()) {
      const nuestroClubId = carteraPorEspnId.get(equipo.espnTeamId);
      if (!nuestroClubId) {
        errores.push(`${equipo.clave}: club sin uuid (id_externo ${equipo.clubAfId})`);
        continue;
      }
      try {
        let year = temporada.get(slug);
        if (year === undefined) {
          year = await obtenerTemporadaVigente(slug);
          temporada.set(slug, year);
          await esperarEntreLlamadasEspn();
        }
        const refs = await listarEventosDeTemporada(slug, year, equipo.espnTeamId, rango);
        await esperarEntreLlamadasEspn();
        for (const refEvento of refs) {
          try {
            await esperarEntreLlamadasEspn();
            const crudo = (await obtenerEvento(refEvento)) as unknown as EventoEspnCrudo;
            const p = normalizarEvento(crudo, equipo.espnTeamId);
            const inicioMs = p.inicioUtc ? new Date(p.inicioUtc).getTime() : null;
            if (inicioMs !== null && inicioMs < ahora - TRES_DIAS_MS) continue;

            let estado: ReturnType<typeof mapearEstadoEspn> = 'programado';
            if (inicioMs === null || inicioMs <= ahora) {
              if (p.statusRef) {
                await esperarEntreLlamadasEspn();
                estado = mapearEstadoEspn(await obtenerEstadoEvento(p.statusRef));
              } else {
                estado = 'sin_datos';
              }
            }

            const rivalClubId = await asegurarClubEspn(supabase, p.rivalEspnId, carteraPorEspnId, p.rivalNombre ?? `ESPN ${p.rivalEspnId}`);
            const { data: existente, error: errBuscar } = await supabase
              .from('partidos').select('id, estadio, ciudad, zona_horaria_evento')
              .eq('proveedor_externo', PROVEEDOR).eq('id_externo', p.eventoId).maybeSingle();
            if (errBuscar) throw errBuscar;

            const fila = {
              competencia_id: competenciaId.get(claveCompetencia(competencia)) ?? null,
              club_local_id: p.nuestroLado === 'local' ? nuestroClubId : rivalClubId,
              club_visitante_id: p.nuestroLado === 'local' ? rivalClubId : nuestroClubId,
              inicio_utc: p.inicioUtc,
              zona_horaria_evento: zonaDeSede(p.sedePais, slug) ?? existente?.zona_horaria_evento ?? null,
              estado,
              estadio: p.sedeNombre ?? existente?.estadio ?? null,
              ciudad: p.sedeCiudad ?? existente?.ciudad ?? null,
              tentativo: inicioMs !== null && inicioMs - ahora > NOVENTA_DIAS_MS,
              origen: 'api',
              proveedor_externo: PROVEEDOR,
              id_externo: p.eventoId,
              payload_crudo: crudo,
              sincronizado_en: new Date().toISOString(),
            };
            const { data: partido, error: errPartido } = existente
              ? await supabase.from('partidos').update(fila).eq('id', existente.id).select('id').single()
              : await supabase.from('partidos').insert(fila).select('id').single();
            if (errPartido) throw errPartido;

            // Puente con los uruguayos del club (la selección no lleva puente).
            if (!equipo.esSeleccion) {
              for (const jugadorId of vinculos.get(nuestroClubId) ?? []) {
                const { error: errPuente } = await supabase.from('partidos_jugadores').upsert(
                  { partido_id: partido.id, jugador_id: jugadorId, convocado: null, con_seleccion: false },
                  { onConflict: 'partido_id,jugador_id', ignoreDuplicates: true },
                );
                if (errPuente) throw errPuente;
              }
            }
            registros++;
          } catch (e) {
            errores.push(`${slug}/${refEvento.split('/events/')[1]?.split('?')[0]}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
          }
        }
        ligasOk.push(`${equipo.clave}/${slug}`);
      } catch (e) {
        errores.push(`${equipo.clave}/${slug}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
      }
    }
  } catch (e) {
    errorDetalle = e instanceof Error ? e.message : JSON.stringify(e);
    console.error(errorDetalle);
  }

  const huboFalla = errorDetalle !== null || errores.length > 0;
  const estadoSync = huboFalla ? (registros > 0 ? 'parcial' : 'error') : 'ok';
  if (!errorDetalle && errores.length) errorDetalle = `${errores.length} error(es): ${errores.slice(0, 5).join(' | ')}`;

  await supabase.from('sincronizaciones').insert({
    proveedor: PROVEEDOR,
    recurso: 'partidos',
    iniciado_en: iniciadoEn,
    finalizado_en: new Date().toISOString(),
    estado: estadoSync,
    registros_afectados: registros,
    error_detalle: errorDetalle,
    parametros: { alcance: 'uruguay', ligas: ligasOk, errores },
  });

  return new Response(JSON.stringify({ estado: estadoSync, registros, errorDetalle }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
});

/** uuid de un club por su id de ESPN: nuestro (cartera/Uruguay), ya creado como espn, o lo crea. */
async function asegurarClubEspn(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  espnId: string,
  cartera: Map<string, string>,
  nombre: string,
): Promise<string> {
  const nuestro = cartera.get(espnId);
  if (nuestro) return nuestro;
  const { data: existente, error: errBuscar } = await supabase
    .from('clubes').select('id').eq('proveedor_externo', PROVEEDOR).eq('id_externo', espnId).maybeSingle();
  if (errBuscar) throw errBuscar;
  if (existente) return existente.id;
  const { data: creado, error: errCrear } = await supabase
    .from('clubes').insert({ nombre, origen: 'api', proveedor_externo: PROVEEDOR, id_externo: espnId }).select('id').single();
  if (errCrear) throw errCrear;
  return creado.id;
}
```

- [ ] **Step 2: Type-check with Deno**

Run: `deno check supabase/functions/sync-espn-uruguay/index.ts`
Expected: sin errores (si `deno check` no resuelve `npm:` sin red, correr con `--allow-import` o `DENO_DIR` por defecto; anotar en el ledger lo que haga falta).

- [ ] **Step 3: Corrida local contra ESPN real y la base** (requiere 0031 aplicada — Task 2 Step 6)

Run (en background): `deno run -A --env-file=.secretos/.env supabase/functions/sync-espn-uruguay/index.ts` (Deno.serve escucha en :8000; si `.secretos/.env` no trae `SUPABASE_URL`, exportarla desde `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`).
Luego: `curl -s -X POST -H "x-sync-secret: $SYNC_FUNCTIONS_SECRET" http://localhost:8000` (leyendo el secreto de `.secretos/.env`).
Expected: `{"estado":"ok"|"parcial","registros":N>=5,...}`. Verificar con service role: partido espn Peñarol vs Racing 2026-10-04 con 2 filas en `partidos_jugadores` (Abel, Franco); Nacional 2026-10-05 con Martirena y Silvera; `partidos_seleccion` con Uruguay–India 2026-10-06. Correr dos veces: `registros` igual y **sin** filas nuevas en `partidos` (idempotente). Detener el proceso de Deno.

Si el auto-mode bloquea la corrida local: registrar en §10b y dejar la verificación para después del deploy (Task 6).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-espn-uruguay/index.ts
git commit -m "feat(sync): sync-espn-uruguay — Peñarol, Nacional y la selección desde ESPN"
```

---

### Task 4: /partidos — filtro Selección

**Files:**
- Modify: `lib/repositorios/tipos.ts` (`esSeleccion?: boolean` en `PartidoProximo`)
- Modify: `lib/repositorios/repositorio-partidos.ts` (`listarProximosSeleccion`)
- Modify: `lib/partidos/utilidades.ts` (tipo `FiltroPartidos`)
- Create: `lib/partidos/seleccion.ts`, `lib/partidos/seleccion.test.ts`
- Modify: `components/partidos/BarraFiltros.tsx`, `components/partidos/SeccionPartidos.tsx`, `components/partidos/ListaPartidos.tsx`, `components/partidos/TarjetaPartido.tsx`, `app/(app)/partidos/page.tsx`

**Interfaces:**
- Consumes: vista `partidos_seleccion` (Task 2).
- Produces: `FiltroPartidos` incluye `'seleccion'`; `unirConSeleccion(md: PartidoProximo[], sel: PartidoProximo[]): PartidoProximo[]`; `listaSegunFiltro(filtro: FiltroPartidos, listas: { partidos: PartidoProximo[]; contenido: PartidoProximo[]; seleccion: PartidoProximo[] }, filtrarResto: (lista: PartidoProximo[]) => PartidoProximo[]): PartidoProximo[]` (en `lib/partidos/seleccion.ts`).

- [ ] **Step 1: Write the failing test** — crear `lib/partidos/seleccion.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unirConSeleccion, listaSegunFiltro } from './seleccion.ts';
import type { PartidoProximo } from '../repositorios/tipos.ts';

const pp = (id: string, dia: string, extra: Partial<PartidoProximo> = {}): PartidoProximo => ({
  partidoId: id, jugadorId: 'j', jugadorNombre: 'X', jugadorApodo: null, jugadorFotoUrl: null, jugadorSeleccion: null,
  conSeleccion: false, competenciaId: null, competenciaNombre: null, competenciaCodigo: null, competenciaTipo: 'liga',
  esInternacional: false, competenciaCobertura: null, clubId: null, clubNombre: null, clubEscudoUrl: null, rivalId: null,
  rivalNombre: null, rivalEscudoUrl: null, esLocal: null, inicioUtc: `${dia}T20:00:00Z`, zonaHorariaEvento: null,
  diaUy: dia, diaLocalSede: dia, estado: 'programado', ronda: null, estadio: null, ciudad: null, marcadorLocal: null,
  marcadorVisitante: null, tentativo: false, ...extra,
});

test('unirConSeleccion: ordena por fecha y NO repite un partido de Uruguay que ya está en Match Day', () => {
  const md = [pp('m1', '2026-10-04'), pp('m2', '2026-10-06', { competenciaTipo: 'seleccion', conSeleccion: true })];
  const sel = [pp('s1', '2026-10-06', { esSeleccion: true, competenciaTipo: 'seleccion' }), pp('s2', '2026-10-10', { esSeleccion: true, competenciaTipo: 'seleccion' })];
  assert.deepEqual(unirConSeleccion(md, sel).map((p) => p.partidoId), ['m1', 'm2', 's2']);
});

test('listaSegunFiltro: Selección = solo selección; Todos = Match Day + selección; Contenido aparte; Match Day sin selección', () => {
  const listas = {
    partidos: [pp('m1', '2026-10-04')],
    contenido: [pp('c1', '2026-10-05')],
    seleccion: [pp('s1', '2026-10-06', { esSeleccion: true, competenciaTipo: 'seleccion' })],
  };
  const resto = (l: PartidoProximo[]) => l; // en la app: filtrarPartidos(l, filtro, conHito)
  assert.deepEqual(listaSegunFiltro('seleccion', listas, resto).map((p) => p.partidoId), ['s1']);
  assert.deepEqual(listaSegunFiltro('todos', listas, resto).map((p) => p.partidoId), ['m1', 's1']);
  assert.deepEqual(listaSegunFiltro('contenido', listas, resto).map((p) => p.partidoId), ['c1']);
  assert.deepEqual(listaSegunFiltro('matchday', listas, resto).map((p) => p.partidoId), ['m1']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `fail` ≥ 1 (no existen `unirConSeleccion` / `listaSegunFiltro`).

- [ ] **Step 3: Implement**

`lib/repositorios/tipos.ts`, al final de `PartidoProximo` (después de `tentativo: boolean;`):

```ts
  /** Partido de la selección uruguaya (vista `partidos_seleccion`, 0031): sin representado. */
  esSeleccion?: boolean;
```

`lib/partidos/utilidades.ts`: cambiar el tipo:

```ts
export type FiltroPartidos = 'todos' | 'matchday' | 'contenido' | 'seleccion' | 'hoy' | 'semana' | 'int' | 'hito' | 'fechas';
```

En `filtrarPartidos`, junto a `case 'contenido':` agregar `case 'seleccion':` (mismo `return []`, con el comentario "vienen aparte (0027/0031)").

`lib/partidos/seleccion.ts` (nuevo; SOLO `import type`):

```ts
/**
 * Listas de /partidos con la selección uruguaya (0031). Puro, solo imports de tipo (testeable
 * con `node --test`). Football First. Creado 2026-09-30.
 */
import type { FiltroPartidos } from './utilidades.ts';
import type { PartidoProximo } from '../repositorios/tipos.ts';

/**
 * Todos = Match Day + selección (0031), por fecha. Si un partido de Uruguay ya está en Match Day
 * (un representado convocado: competencia de selección el mismo día en Uruguay), se muestra una
 * sola vez — gana el de Match Day, que es el que tiene ticket.
 */
export function unirConSeleccion(md: PartidoProximo[], sel: PartidoProximo[]): PartidoProximo[] {
  const diasSeleccionMd = new Set(md.filter((p) => p.competenciaTipo === 'seleccion' && p.diaUy).map((p) => p.diaUy));
  const extra = sel.filter((p) => !p.diaUy || !diasSeleccionMd.has(p.diaUy));
  const clave = (p: PartidoProximo) => p.inicioUtc ?? '9999';
  return [...md, ...extra].sort((a, b) => clave(a).localeCompare(clave(b)));
}

/** Qué lista mostrar según el filtro de /partidos (Contenido y Selección vienen de otras vistas). */
export function listaSegunFiltro(
  filtro: FiltroPartidos,
  listas: { partidos: PartidoProximo[]; contenido: PartidoProximo[]; seleccion: PartidoProximo[] },
  /** Filtro del resto (Match Day, Hoy, Semana…): en la app, `filtrarPartidos(l, filtro, conHito)`. */
  filtrarResto: (lista: PartidoProximo[]) => PartidoProximo[],
): PartidoProximo[] {
  if (filtro === 'contenido') return listas.contenido;
  if (filtro === 'seleccion') return listas.seleccion;
  if (filtro === 'todos') return unirConSeleccion(listas.partidos, listas.seleccion);
  return filtrarResto(listas.partidos);
}
```

(Si `node --test` no acepta los `import type` con extensión `.ts` de otros archivos, usar la misma forma que `lib/calendario/eventos.ts`: `import type … from '@/…'` — los imports de tipo se borran al correr.)

`lib/repositorios/repositorio-partidos.ts`: ampliar `proximosDe` y agregar el método.

```ts
  /** Partidos de la selección uruguaya (vista 0031): filtros "Selección" y "Todos". */
  async listarProximosSeleccion(): Promise<PartidoProximo[]> {
    return (await this.proximosDe('partidos_seleccion')).map((p) => ({ ...p, esSeleccion: true }));
  }
```

y cambiar la firma a `private async proximosDe(vista: 'proximos_partidos' | 'proximos_partidos_contenido' | 'partidos_seleccion')`.

`components/partidos/BarraFiltros.tsx`: en `FILTROS`, después de `contenido`: `{ f: 'seleccion', etiqueta: 'Selección' },`.

`components/partidos/SeccionPartidos.tsx`: nueva prop `partidosSeleccion?: PartidoProximo[]` (default `[]`, doc "Partidos de la selección uruguaya (0031): filtros Selección y Todos."), y reemplazar el `useMemo` de `filtrados` por:

```tsx
  const filtrados = useMemo(
    () =>
      listaSegunFiltro(filtro, { partidos, contenido: partidosContenido, seleccion: partidosSeleccion }, (l) =>
        filtrarPartidos(l, filtro, partidosConHito),
      ),
    [filtro, partidos, partidosContenido, partidosSeleccion, partidosConHito],
  );
```

(importar `listaSegunFiltro` de `@/lib/partidos/seleccion`; `filtrarPartidos` se sigue importando de `@/lib/partidos/utilidades`).

`components/partidos/ListaPartidos.tsx`: en la tarjeta, la selección no abre panel ni lleva Dropbox/alerta/semáforo:

```tsx
                  onAbrir={onAbrirPartido && !p.esSeleccion ? () => onAbrirPartido(p.partidoId) : undefined}
                  linksDropbox={linksDropbox && !p.esSeleccion ? (linksDropbox[p.jugadorId] ?? SIN_LINKS) : undefined}
```

(mantener el resto de props; `alertasTicket`/`estadosDiseno` no tienen claves para la selección, no hace falta tocarlos). Leer las líneas actuales de `onAbrir` y `linksDropbox` antes de editar y conservar su forma.

`components/partidos/TarjetaPartido.tsx`: el bloque `<div className="caras">` solo si no es selección:

```tsx
        {!p.esSeleccion && (
          <div className="caras">
            …(contenido actual sin cambios)…
          </div>
        )}
```

`app/(app)/partidos/page.tsx`: sumar al `Promise.all` (al final):

```ts
    // Partidos de la selección uruguaya (0031). Si falla, los filtros Selección/Todos siguen sin ellos.
    repositorioPartidos.listarProximosSeleccion().catch((e) => {
      console.error('partidos de la selección:', e);
      return [];
    }),
```

con `partidosSeleccion` al final del destructuring, y pasar `partidosSeleccion={partidosSeleccion}` a `<SeccionPartidos>`.

- [ ] **Step 4: Run tests, types, lint**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"; npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | head; npm run lint 2>&1 | tail -1`
Expected: `fail 0`; tsc sin salida; lint sin warnings.

- [ ] **Step 5: Commit**

```bash
git add lib components app
git commit -m "feat(partidos): filtro Selección con los partidos de Uruguay (también en Todos)"
```

---

### Task 5: Calendario — filtro Selección

**Files:**
- Modify: `lib/calendario/eventos.ts` (+ `lib/calendario/eventos.test.ts`)
- Modify: `lib/repositorios/repositorio-agenda.ts`
- Modify: `components/calendario/Calendario.tsx`, `app/(app)/calendario/page.tsx`

**Interfaces:**
- Consumes: vista `partidos_seleccion` (Task 2).
- Produces: `GrupoCalendario` incluye `'seleccion'`; `FiltroCalendario` incluye `'seleccion'`; `quitarSeleccionDuplicada(eventos: EventoCalendario[]): EventoCalendario[]`; `RepositorioAgendaSupabase.listarPartidosSeleccion(desde, hasta): Promise<EventoCalendario[]>`.

- [ ] **Step 1: Write the failing test** — agregar a `lib/calendario/eventos.test.ts` (importar `quitarSeleccionDuplicada`):

```ts
test('filtrarCalendario("seleccion") y Todos; un partido de Uruguay ya en Match Day no se repite en Todos', () => {
  const eventos = [
    ev({ fuente: 'partido', refId: 'm1', titulo: 'Uruguay vs India', diaUy: '2026-10-06', grupo: 'matchday' }),
    ev({ fuente: 'partido', refId: 's1', titulo: 'Uruguay vs India', diaUy: '2026-10-06', grupo: 'seleccion' }),
    ev({ fuente: 'partido', refId: 's2', titulo: 'Uruguay vs Chile', diaUy: '2026-11-12', grupo: 'seleccion' }),
    ev({ fuente: 'cumpleanos', refId: 'j1', diaUy: '2026-10-06', grupo: 'contenido' }),
  ];
  assert.deepEqual(filtrarCalendario(eventos, 'seleccion').map((e) => e.refId), ['s1', 's2']);
  assert.deepEqual(quitarSeleccionDuplicada(eventos).map((e) => e.refId), ['m1', 's2', 'j1']);
  assert.deepEqual(filtrarCalendario(eventos, 'matchday').map((e) => e.refId), ['m1']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `fail` ≥ 1.

- [ ] **Step 3: Implement**

`lib/calendario/eventos.ts`: ampliar los tipos (`GrupoCalendario = 'matchday' | 'contenido' | 'seleccion'`, `FiltroCalendario = 'todos' | 'matchday' | 'contenido' | 'seleccion'`) y agregar:

```ts
/**
 * En "Todos": si un partido de la selección (0031) cae el mismo día que un partido de Match Day
 * de Uruguay (un representado convocado), se muestra una sola vez — gana Match Day (tiene
 * ticket). Criterio: mismo día en Uruguay y "Uruguay" en el título del de Match Day.
 */
export function quitarSeleccionDuplicada(eventos: EventoCalendario[]): EventoCalendario[] {
  const dias = new Set(
    eventos
      .filter((e) => e.fuente === 'partido' && (e.grupo ?? 'matchday') === 'matchday' && /uruguay/i.test(e.titulo))
      .map((e) => e.diaUy),
  );
  return eventos.filter((e) => e.grupo !== 'seleccion' || !dias.has(e.diaUy));
}
```

`lib/repositorios/repositorio-agenda.ts`: método nuevo junto a `listarPartidosContenido` (misma forma, otra vista y otro grupo):

```ts
  /** Partidos de la selección uruguaya (`partidos_seleccion`, 0031) entre dos días (grupo Selección). */
  async listarPartidosSeleccion(desdeIso: string, hastaIso: string): Promise<EventoCalendario[]> {
    const { data, error } = await this.supabase
      .from('partidos_seleccion')
      .select('partido_id, club_nombre, rival_nombre, es_local, inicio_utc, dia_uy, dia_local_sede, competencia_codigo, tentativo')
      .gte('dia_uy', desdeIso)
      .lte('dia_uy', hastaIso)
      .returns<
        Array<{
          partido_id: string | null;
          club_nombre: string | null;
          rival_nombre: string | null;
          es_local: boolean | null;
          inicio_utc: string | null;
          dia_uy: string | null;
          dia_local_sede: string | null;
          competencia_codigo: string | null;
          tentativo: boolean | null;
        }>
      >();
    if (error) throw new Error(`No se pudo leer partidos_seleccion: ${error.message}`);
    return (data ?? [])
      .filter((r) => r.partido_id && r.dia_uy)
      .map((r) => ({
        fuente: 'partido' as const,
        refId: r.partido_id,
        // Local primero, como el resto de los partidos.
        titulo: r.es_local === false ? `${r.rival_nombre ?? '?'} vs Uruguay` : `Uruguay vs ${r.rival_nombre ?? '?'}`,
        diaUy: r.dia_uy!,
        diaLocalSede: r.dia_local_sede ?? r.dia_uy!,
        cuandoUtc: r.inicio_utc,
        competenciaCodigo: r.competencia_codigo,
        esInternacional: true,
        tentativo: r.tentativo ?? false,
        grupo: 'seleccion' as const,
      }));
  }
```

`app/(app)/calendario/page.tsx`:
- `const FILTROS: FiltroCalendario[] = ['todos', 'matchday', 'contenido', 'seleccion'];`
- En el `Promise.all`, después de `partidosCo`: `repoMd.listarPartidosSeleccion(desde, hasta).catch(vacio('partidos de la selección')),` y sumar `partidosSel` al destructuring en esa misma posición.
- `const eventos = filtrarCalendario(quitarSeleccionDuplicada(unirEventos(eventosMd, [...eventosCo, ...partidosCo, ...partidosSel])), filtro);` — con el filtro `seleccion`, `quitarSeleccionDuplicada` no debe esconder nada: aplicarlo solo si `filtro === 'todos'`:
  ```ts
  const unidos = unirEventos(eventosMd, [...eventosCo, ...partidosCo, ...partidosSel]);
  const eventos = filtrarCalendario(filtro === 'todos' ? quitarSeleccionDuplicada(unidos) : unidos, filtro);
  ```
- Con `filtro === 'seleccion'`: notas vacías (`[]`), y `estadoPorPartido`, `ticketsPorPartido`, `alertasPorPartido`, `ticketsPorDia` en `{}` (igual que Contenido para los tres primeros).
- Subtítulo: agregar "y los de la selección uruguaya" al texto actual.

`components/calendario/Calendario.tsx`:
- `FILTROS`: agregar `{ f: 'seleccion', etiqueta: 'Selección' }` al final.
- La condición del chip clickeable pasa a `if (e.fuente === 'partido' && e.refId && (e.grupo ?? 'matchday') === 'matchday')` (Contenido y Selección quedan como `div`, sin clic).
- Actualizar el comentario de esa línea: "Partidos de Contenido y de la selección: no tienen panel → chip sin clic".

- [ ] **Step 4: Run tests, types, lint**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)"; npx tsc --noEmit -p . 2>&1 | grep -v TS5097 | head; npm run lint 2>&1 | tail -1`
Expected: `fail 0`; tsc sin salida; lint sin warnings.

- [ ] **Step 5: Commit**

```bash
git add lib components app
git commit -m "feat(calendario): filtro Selección con los partidos de Uruguay (también en Todos)"
```

---

### Task 6: QA + deploy + avances

- [ ] **Step 1:** Pedirle a Gerardo el deploy: `npm run deploy:funcion -- sync-espn-uruguay`. Después, disparo manual (curl con `x-sync-secret` a `https://thplgzufenxrzegwfxkg.functions.supabase.co/sync-espn-uruguay`; si el auto-mode lo bloquea, pedírselo a Gerardo). Verificar con service role: fila `sincronizaciones` espn/partidos `ok|parcial` con `parametros.alcance='uruguay'`; partidos de Peñarol (4/10) y Nacional (5/10) vinculados a sus 2 jugadores; Uruguay–India en `partidos_seleccion`; `avisos_sistema` sin la fuente espn (como Felipe).
- [ ] **Step 2:** Script `qa-espn-uruguay.mjs` (scratchpad) con `browser.mjs --script` contra dev `:3100` (Felipe): `/partidos` chip Selección → tarjeta Uruguay vs India sin cara, sin Dropbox y sin abrir panel; Todos incluye Uruguay–India; Contenido incluye Peñarol 4/10 y Nacional 5/10; `/calendario?f=seleccion` → chip Uruguay–India en octubre (sin clic, sin color); `?f=contenido` → Peñarol/Nacional; 390 px sin scroll lateral; 0 errores de consola. Apagar dev (TaskStop + Stop-Process `*next*dev*-p*3100*`).
- [ ] **Step 3:** `avances.md` §5: puntos 4 y 9 hechos (fecha, función, cron 07:00 UTC, limitación ~2 fechas en uru.1, Copa AUF no disponible en ESPN). Commit `docs(avances): puntos 4 y 9 — ESPN Uruguay`.
- [ ] **Step 4:** Tras merge + push de Gerardo, repetir el QA de Step 2 contra producción.
