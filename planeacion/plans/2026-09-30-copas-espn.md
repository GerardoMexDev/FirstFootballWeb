# Copas de Match Day desde ESPN — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Traer de ESPN, con meses de anticipación, las copas de los 6 clubes de Match Day para que generen su ticket automático a tiempo (Parte 1 del spec).

**Architecture:** Se extiende `sync-espn-uruguay`: la config pura (`_shared/espn-uruguay.ts`) suma los 6 clubes con `servicio: 'matchday'` y sus torneos; el vínculo jugador↔partido depende del servicio del club. La migración `0033` siembra las competencias nuevas y cambia la prioridad de `proximos_partidos` a SportMonks → ESPN → API-Football para que el ticket no cambie de partido cuando API-Football trae la copa días después.

**Tech Stack:** Deno Edge Functions, Supabase Postgres, `node --test`, `pg` + ROLLBACK.

**Spec:** `planeacion/specs/2026-09-30-copas-espn-y-estadios.md` (Parte 1)

## Global Constraints

- Solo copas: las ligas domésticas siguen con SportMonks (no se agregan slugs de liga de los 6 clubes).
- Torneos por club = tabla 1.2 del spec, exactos.
- Vínculo Match Day: jugadores `activo` + `servicio_match_day` con `club_actual_id` = club. Contenido: como hoy.
- Prioridad de `proximos_partidos`: `sportmonks` 0, `espn` 1, `api-football` 2, resto 3. Columnas y resto del cuerpo idénticos a 0032.
- Claude no aplica migraciones, no deploya ni pushea (§10b). Scripts `.cjs` con `split/join` (no `String.replace` con texto que tenga `$`). No correr Prettier.

## Review Focus

1. **Copa ESPN + la misma copa de API-Football 2 días antes (mismo día UY):** `proximos_partidos` sigue mostrando la fila ESPN (ticket estable). → test de base (Task 2).
2. **Liga SportMonks + fila ESPN del mismo día:** gana SportMonks. → test de base (Task 2).
3. **Toluca vs Atlante en Leagues Cup:** un solo partido, rival = nuestro club, los dos representados vinculados. → test `mapaCarteraEspn` (Task 1).
4. **Club de Match Day sin representado activo (traspaso):** no se vincula a nadie y los vínculos futuros sobrantes se borran. → test `jugadoresPorClub` / `vinculosSobrantes` (Task 1).
5. **Corrida más larga (≈50 listados):** no pasa el límite de la Edge Function. → corrida local medida (Task 3).

---

### Task 1: Config y vínculo por servicio

**Files:**
- Modify: `supabase/functions/_shared/espn-uruguay.ts`, `supabase/functions/_shared/espn-uruguay.test.ts`

**Interfaces:**
- Produces:
  - `EquipoUruguay` gana `servicio: 'contenido' | 'matchday'`; `clave` pasa a `string`.
  - `EQUIPOS_COPAS_MD: EquipoUruguay[]` (6 clubes) y `EQUIPOS_ESPN = [...EQUIPOS_URUGUAY, ...EQUIPOS_COPAS_MD]`.
  - `tareasDeSync(equipos = EQUIPOS_ESPN)`; `mapaCarteraEspn(clubIdPorAf, equipos = EQUIPOS_ESPN)`.
  - `jugadoresPorClub(jugadores: JugadorSync[], servicioPorClub: Map<string, 'contenido' | 'matchday'>): Map<string, string[]>`.

- [ ] **Step 1: Tests** — en `espn-uruguay.test.ts`: cambiar el import a incluir `EQUIPOS_COPAS_MD, EQUIPOS_ESPN`; reemplazar el test `tareasDeSync` y el de `jugadoresPorClub`, y agregar:

```ts
test('tareasDeSync: Uruguay (10) + copas de los 6 clubes de Match Day (40) = 50', () => {
  const t = tareasDeSync();
  assert.equal(t.length, 50);
  assert.deepEqual(
    t.filter((x) => x.equipo.clave === 'uruguay').map((x) => x.slug),
    ['fifa.friendly', 'fifa.worldq.conmebol', 'conmebol.america', 'fifa.world'],
  );
  assert.deepEqual(t.find((x) => x.equipo.clave === 'penarol' && x.slug === 'conmebol.libertadores')?.competencia, { proveedor: 'api-football', idExterno: '13' });
  assert.deepEqual(t.find((x) => x.equipo.clave === 'colo-colo' && x.slug === 'chi.copa_chi')?.competencia, { proveedor: 'api-football', idExterno: '267' });
  assert.deepEqual(t.find((x) => x.equipo.clave === 'genk' && x.slug === 'uefa.europa_qual')?.competencia, { proveedor: 'api-football', idExterno: '3' });
  assert.deepEqual(t.find((x) => x.equipo.clave === 'al-qadisiyah' && x.slug === 'afc.champions')?.competencia, { proveedor: 'api-football', idExterno: '17' });
  assert.deepEqual(t.find((x) => x.equipo.clave === 'bragantino' && x.slug === 'bra.camp.paulista')?.competencia, { proveedor: 'espn', idExterno: 'bra.camp.paulista' });
  // Ninguna liga doméstica de los 6 clubes (esas son de SportMonks).
  const ligas = new Set(['mex.1', 'bra.1', 'chi.1', 'bel.1', 'ksa.1']);
  assert.equal(t.filter((x) => ligas.has(x.slug)).length, 0);
  assert.equal(EQUIPOS_URUGUAY.find((e) => e.esSeleccion)?.espnTeamId, URUGUAY_ESPN_ID);
  assert.equal(EQUIPOS_COPAS_MD.every((e) => e.servicio === 'matchday'), true);
  assert.equal(EQUIPOS_ESPN.length, 9);
});

test('jugadoresPorClub: Contenido → solo-Contenido; Match Day → de Match Day; activos y del club', () => {
  const j = (id: string, club: string, md: boolean, co: boolean, activo = true) =>
    ({ id, club_actual_id: club, activo, servicio_match_day: md, servicio_contenido: co });
  const m = jugadoresPorClub(
    [
      j('abel', 'PEN', false, true),
      j('franco', 'PEN', false, true),
      j('mdEnPen', 'PEN', true, true), // de Match Day en un club de Contenido: no
      j('javi', 'COL', true, true),
      j('soloCoEnCol', 'COL', false, true), // solo-Contenido en un club de Match Day: no
      j('baja', 'COL', true, true, false),
      j('seFue', 'BOCA', false, true),
    ],
    new Map([['PEN', 'contenido'], ['COL', 'matchday']]),
  );
  assert.deepEqual(m.get('PEN'), ['abel', 'franco']);
  assert.deepEqual(m.get('COL'), ['javi']);
  assert.equal(m.has('BOCA'), false);
});

test('mapaCarteraEspn: Toluca vs Atlante (Leagues Cup) → cada id ESPN apunta a nuestro club', () => {
  const m = mapaCarteraEspn(new Map([['2281', 'uuid-tol'], ['2312', 'uuid-atl'], ['2348', 'uuid-pen']]));
  assert.equal(m.get('223'), 'uuid-tol');
  assert.equal(m.get('226'), 'uuid-atl');
  assert.equal(m.get('2683'), 'uuid-pen');
});
```

(El test viejo `jugadoresPorClub: solo activos, solo-Contenido, del club pedido` y el viejo `tareasDeSync: … = 10 tareas` se borran: los reemplazan estos.)

- [ ] **Step 2: Run** `npm test 2>&1 | grep -E "^ℹ (pass|fail)"` → Expected: fail (no existen `EQUIPOS_COPAS_MD` / nueva firma).

- [ ] **Step 3: Implement** en `espn-uruguay.ts`:
  - `EquipoUruguay`: `clave: string;` y agregar `servicio: 'contenido' | 'matchday';`. Peñarol y Nacional `servicio: 'contenido'`; Uruguay `servicio: 'contenido'` (no se vincula).
  - Constantes:

```ts
const af = (idExterno: string): RefCompetencia => ({ proveedor: 'api-football', idExterno });
const espn = (slug: string): RefCompetencia => ({ proveedor: 'espn', idExterno: slug });
const GLOBALES: EquipoUruguay['ligas'] = [
  { slug: 'fifa.cwc', competencia: espn('fifa.cwc') },
  { slug: 'fifa.intercontinental_cup', competencia: espn('fifa.intercontinental_cup') },
];
const COPAS_MEXICO: EquipoUruguay['ligas'] = [
  { slug: 'mex.campeon', competencia: espn('mex.campeon') },
  { slug: 'concacaf.champions', competencia: af('16') },
  { slug: 'concacaf.leagues.cup', competencia: af('772') },
  { slug: 'campeones.cup', competencia: espn('campeones.cup') },
  ...GLOBALES,
];
const CONMEBOL: EquipoUruguay['ligas'] = [
  { slug: 'conmebol.libertadores', competencia: af('13') },
  { slug: 'conmebol.sudamericana', competencia: af('11') },
  { slug: 'conmebol.recopa', competencia: espn('conmebol.recopa') },
];

/**
 * Copas de los 6 clubes de Match Day (lista de torneos de Gerardo, 2026-09-30) — SOLO copas: las
 * ligas vienen de SportMonks. Ids de ESPN y de API-Football (\`clubAfId\`) los mismos que usaba
 * \`sync-fixtures-espn\`.
 */
export const EQUIPOS_COPAS_MD: EquipoUruguay[] = [
  { clave: 'toluca', espnTeamId: '223', clubAfId: '2281', esSeleccion: false, servicio: 'matchday', ligas: COPAS_MEXICO },
  { clave: 'atlante', espnTeamId: '226', clubAfId: '2312', esSeleccion: false, servicio: 'matchday', ligas: COPAS_MEXICO },
  {
    clave: 'bragantino', espnTeamId: '6079', clubAfId: '794', esSeleccion: false, servicio: 'matchday',
    ligas: [
      { slug: 'bra.copa_do_brazil', competencia: af('73') },
      { slug: 'bra.supercopa_do_brazil', competencia: espn('bra.supercopa_do_brazil') },
      { slug: 'bra.camp.paulista', competencia: espn('bra.camp.paulista') },
      ...CONMEBOL,
      ...GLOBALES,
    ],
  },
  {
    clave: 'colo-colo', espnTeamId: '2688', clubAfId: '2315', esSeleccion: false, servicio: 'matchday',
    ligas: [
      { slug: 'chi.copa_chi', competencia: af('267') },
      { slug: 'chi.super_cup', competencia: espn('chi.super_cup') },
      ...CONMEBOL,
      ...GLOBALES,
    ],
  },
  {
    clave: 'genk', espnTeamId: '938', clubAfId: '742', esSeleccion: false, servicio: 'matchday',
    ligas: [
      { slug: 'uefa.champions', competencia: espn('uefa.champions') },
      { slug: 'uefa.champions_qual', competencia: espn('uefa.champions') },
      { slug: 'uefa.europa', competencia: af('3') },
      { slug: 'uefa.europa_qual', competencia: af('3') },
      { slug: 'uefa.europa.conf', competencia: espn('uefa.europa.conf') },
      { slug: 'uefa.europa.conf_qual', competencia: espn('uefa.europa.conf') },
      ...GLOBALES,
    ],
  },
  {
    clave: 'al-qadisiyah', espnTeamId: '22022', clubAfId: '2933', esSeleccion: false, servicio: 'matchday',
    ligas: [
      { slug: 'ksa.kings.cup', competencia: af('504') },
      { slug: 'afc.champions', competencia: af('17') },
      { slug: 'afc.cup', competencia: af('18') },
      ...GLOBALES,
    ],
  },
];

/** Todo lo que sincroniza la función: Uruguay (Contenido + selección) + copas de Match Day. */
export const EQUIPOS_ESPN: EquipoUruguay[] = [...EQUIPOS_URUGUAY, ...EQUIPOS_COPAS_MD];
```

  (`EQUIPOS_COPAS_MD`/`EQUIPOS_ESPN` van DESPUÉS de `EQUIPOS_URUGUAY` en el archivo.) Conteo: Toluca 6 + Atlante 6 + Bragantino 8 + Colo-Colo 7 + Genk 8 + Al-Qadisiyah 5 = 40.
  - `tareasDeSync(equipos = EQUIPOS_ESPN)` y `mapaCarteraEspn(clubIdPorAf, equipos = EQUIPOS_ESPN)`.
  - `jugadoresPorClub`:

```ts
/**
 * Jugadores a vincular por club, según el servicio del club: Contenido → activos solo-Contenido
 * (los de Match Day los trae SportMonks); Match Day → activos de Match Day (sus copas). Se
 * recalcula en cada corrida: si uno cambia de club, deja de vincularse.
 */
export function jugadoresPorClub(jugadores: JugadorSync[], servicioPorClub: Map<string, 'contenido' | 'matchday'>): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const j of jugadores) {
    if (!j.activo || !j.club_actual_id) continue;
    const servicio = servicioPorClub.get(j.club_actual_id);
    if (!servicio) continue;
    const va = servicio === 'matchday' ? j.servicio_match_day : j.servicio_contenido && !j.servicio_match_day;
    if (!va) continue;
    const lista = m.get(j.club_actual_id) ?? [];
    lista.push(j.id);
    m.set(j.club_actual_id, lista);
  }
  return m;
}
```

  - Actualizar la cabecera del archivo: "y las copas de los 6 clubes de Match Day (2026-09-30)".

- [ ] **Step 4: Run** `npm test 2>&1 | grep -E "^ℹ (pass|fail)"` → Expected: `fail 0`.
- [ ] **Step 5: Commit** `feat(espn): copas de los 6 clubes de Match Day en la config de ESPN`.

---

### Task 2: Migración `0033` + tests de base

**Files:**
- Create: `supabase/migrations/0033_copas_espn.sql`, `scripts/copas-espn.test.mjs`
- Modify: `package.json` (`"test:copas-espn": "node --test scripts/copas-espn.test.mjs"`)

**Interfaces:**
- Consumes: slugs `espn(...)` de Task 1.
- Produces: 10 competencias espn; `proximos_partidos` con prioridad nueva.

- [ ] **Step 1: Test** — `scripts/copas-espn.test.mjs`: mismo arnés que `scripts/espn-uruguay.test.mjs` (conexión `pg`, `enTransaccion` que aplica la migración si falta — detectar con `select count(*)=10 from competencias where proveedor_externo='espn' and id_externo in (…10 slugs…)` —, `como`, `comoDueno`, `uno`). Tests:

```js
const SLUGS = ['mex.campeon', 'campeones.cup', 'fifa.cwc', 'fifa.intercontinental_cup', 'bra.supercopa_do_brazil',
  'bra.camp.paulista', 'chi.super_cup', 'conmebol.recopa', 'uefa.champions', 'uefa.europa.conf'];

/** Partido 2030-07-15 de Colo-Colo vs un rival de prueba, de `proveedor`, vinculado a Javi. */
async function partidoDeJavi(proveedor, idExterno, competenciaId) {
  await comoDueno();
  const col = (await uno(`select id from clubes where proveedor_externo = 'api-football' and id_externo = '2315'`)).id;
  const riv = (await uno(`insert into clubes (nombre, origen, proveedor_externo, id_externo) values ($1, 'api', 'espn', $2) returning id`, ['Rival QA ' + idExterno, 'qa-' + idExterno])).id;
  const javi = (await uno(`select id from jugadores where club_actual_id = $1 and servicio_match_day and activo limit 1`, [col])).id;
  const p = (await uno(
    `insert into partidos (competencia_id, club_local_id, club_visitante_id, inicio_utc, zona_horaria_evento, estado, origen, proveedor_externo, id_externo, sincronizado_en)
     values ($1, $2, $3, '2030-07-15T23:00:00Z', 'America/Santiago', 'programado', 'api', $4, $5, now()) returning id`,
    [competenciaId, col, riv, proveedor, idExterno],
  )).id;
  await c.query(`insert into partidos_jugadores (partido_id, jugador_id, convocado, con_seleccion) values ($1, $2, null, false)`, [p, javi]);
  return { p, javi };
}
const copaChile = async () => (await uno(`select id from competencias where proveedor_externo = 'api-football' and id_externo = '267'`)).id;

test('siembra: las 10 competencias de ESPN, una sola vez', () =>
  enTransaccion(async () => {
    await comoDueno();
    const r = await c.query(`select id_externo, tipo from competencias where proveedor_externo = 'espn' and id_externo = any($1) order by 1`, [SLUGS]);
    assert.equal(r.rows.length, 10);
    assert.equal(r.rows.find((x) => x.id_externo === 'uefa.champions').tipo, 'continental');
    assert.equal(r.rows.find((x) => x.id_externo === 'chi.super_cup').tipo, 'copa');
  }));

test('prioridad: copa de ESPN + la misma de API-Football el mismo día → se ve la de ESPN (ticket estable)', () =>
  enTransaccion(async () => {
    const cc = await copaChile();
    const { p: pEspn, javi } = await partidoDeJavi('espn', 'qa-copa-espn', cc);
    await partidoDeJavi('api-football', 'qa-copa-af', cc);
    await como(ids.felipe);
    const r = await c.query(`select partido_id from proximos_partidos where jugador_id = $1 and dia_uy = '2030-07-15'`, [javi]);
    assert.deepEqual(r.rows.map((x) => x.partido_id), [pEspn]);
    const tk = await uno(`select estado from tickets_match_day where partido_id = $1 and jugador_id = $2`, [pEspn, javi]);
    assert.equal(tk.estado, 'pendiente');
  }));

test('prioridad: liga de SportMonks + fila ESPN el mismo día → se ve la de SportMonks', () =>
  enTransaccion(async () => {
    const cc = await copaChile();
    const { p: pSm, javi } = await partidoDeJavi('sportmonks', 'qa-liga-sm', cc);
    await partidoDeJavi('espn', 'qa-liga-espn', cc);
    await como(ids.felipe);
    const r = await c.query(`select partido_id from proximos_partidos where jugador_id = $1 and dia_uy = '2030-07-15'`, [javi]);
    assert.deepEqual(r.rows.map((x) => x.partido_id), [pSm]);
  }));

test('proximos_partidos: mismas columnas que antes y ningún partido de club sin club', () =>
  enTransaccion(async () => {
    await como(ids.felipe);
    const r = await c.query(`select count(*)::int as n from proximos_partidos where not con_seleccion and club_nombre is null`);
    assert.equal(r.rows[0].n, 0);
    const cols = await c.query(`select column_name from information_schema.columns where table_name = 'proximos_partidos' order by ordinal_position`);
    assert.equal(cols.rows.length, 35);
  }));
```

(Antes de escribir el último `assert.equal(..., 35)`, contar las columnas reales con esa misma consulta contra la base y usar ese número.)

- [ ] **Step 2: Run** `npm run test:copas-espn` → Expected: ENOENT de `0033_copas_espn.sql`.
- [ ] **Step 3: Migración** `supabase/migrations/0033_copas_espn.sql` — cabecera (qué/por qué: copas de Match Day desde ESPN, ticket estable; reversible), `begin;`, y:
  1. Siembra (mismo patrón que 0031, `where not exists`):

```sql
insert into competencias (nombre, pais, tipo, codigo, origen, proveedor_externo, id_externo)
select v.nombre, v.pais, v.tipo::tipo_competencia, v.codigo, 'api'::origen_dato, 'espn', v.id_externo
from (values
  ('Campeón de Campeones',       'México', 'copa',        'CDC',  'mex.campeon'),
  ('Campeones Cup',              null,     'continental', 'CCUP', 'campeones.cup'),
  ('Mundial de Clubes',          null,     'continental', 'MDC',  'fifa.cwc'),
  ('Copa Intercontinental',      null,     'continental', 'INT',  'fifa.intercontinental_cup'),
  ('Supercopa de Brasil',        'Brasil', 'copa',        'SCB',  'bra.supercopa_do_brazil'),
  ('Campeonato Paulista',        'Brasil', 'copa',        'PAU',  'bra.camp.paulista'),
  ('Supercopa de Chile',         'Chile',  'copa',        'SCC',  'chi.super_cup'),
  ('Recopa Sudamericana',        null,     'continental', 'REC',  'conmebol.recopa'),
  ('UEFA Champions League',      null,     'continental', 'UCL',  'uefa.champions'),
  ('UEFA Conference League',     null,     'continental', 'UECL', 'uefa.europa.conf')
) as v(nombre, pais, tipo, codigo, id_externo)
where not exists (select 1 from competencias c where c.proveedor_externo = 'espn' and c.id_externo = v.id_externo);
```

  2. `create or replace view proximos_partidos` = cuerpo **exacto** de `0032_convocatoria_seleccion.sql` (desde `create or replace view proximos_partidos` hasta el `comment on view …;`), cambiando SOLO la línea del `order by`:
     `  (p.proveedor_externo is distinct from 'api-football'),` →
     `  case p.proveedor_externo when 'sportmonks' then 0 when 'espn' then 1 when 'api-football' then 2 else 3 end,`
     y el comment agrega " Prioridad 0033: sportmonks → espn → api-football."
     Armarlo con un `.cjs` que lea 0032 y use `split/join`. `commit;`.
- [ ] **Step 4: Run** `npm run test:copas-espn` y `npm run test:tickets` y `npm run test:espn-uruguay` → Expected: todos `fail 0`.
- [ ] **Step 5: Commit** `feat(db): 0033 competencias ESPN de copas y prioridad sportmonks→espn→api-football`.
- [ ] **Step 6:** Pedirle a Gerardo que aplique `0033`. Verificar con service role (`competencias` espn = 14 en total: 4 de 0031 + 10) y `npm run tipos:db` (commit si cambia).

---

### Task 3: La función usa el servicio de cada club

**Files:**
- Modify: `supabase/functions/sync-espn-uruguay/index.ts`

- [ ] **Step 1:** Cambios:
  - Importar `EQUIPOS_ESPN` en lugar de `EQUIPOS_URUGUAY` y usarlo para `afIds`.
  - `const servicioPorClub = new Map<string, 'contenido' | 'matchday'>();` armado con `EQUIPOS_ESPN`: para cada equipo con `clubAfId`, si `clubIdPorAf.get(clubAfId)` existe → `set(uuid, equipo.servicio)`.
  - `const vinculos = jugadoresPorClub(jugadores, servicioPorClub);`
  - Cabecera: agregar el párrafo de las copas de Match Day (2026-09-30) y que el nombre quedó por el deploy/cron ya hechos.
- [ ] **Step 2:** `cd supabase/functions && deno check sync-espn-uruguay/index.ts` → sin errores.
- [ ] **Step 3:** Requiere 0033 aplicada. Corrida local (como en el plan ESPN Uruguay, Task 3: `.env` temporal en el scratchpad, `deno run -A --env-file=…`, POST con `x-sync-secret`, y borrar el `.env` al final), midiendo el tiempo con `time`. Expected: `estado ok` (o `parcial` con el detalle), tiempo < 150 s. Verificar con service role: `proximos_partidos` tiene Colo-Colo vs Puerto Montt 2026-10-06 (Copa Chile) para Javi y Al-Qadisiyah en AFC Champions League Elite 2026-10-12 para Nahitan; `tickets_match_day` los tiene `pendiente`. Segunda corrida: sin filas nuevas en `partidos`.
- [ ] **Step 4: Commit** `feat(sync): sync-espn-uruguay trae las copas de los clubes de Match Day`.

---

### Task 4: Deploy + QA + avances

- [ ] **Step 1:** Gerardo: `npm run deploy:funcion -- sync-espn-uruguay`. Disparo manual de la función deployada y bitácora `ok`.
- [ ] **Step 2:** QA dev `:3100` (Felipe y Maxi): /partidos Match Day muestra Colo-Colo–Puerto Montt (Copa Chile, cara de Javi, pastilla Pendiente) y el de AFC de Nahitan; Tickets de Maxi los lista; calendario octubre con sus chips; 390 px sin scroll; 0 errores. Apagar dev.
- [ ] **Step 3:** `avances.md` §5 punto 10: parte 1 hecha. Commit.
- [ ] **Step 4:** Revisión final (subagente), merge, push de Gerardo, QA en prod.
