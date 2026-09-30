// Tests de la migración 0033 (copas de Match Day desde ESPN + prioridad de proximos_partidos) contra
// la base real, siempre con ROLLBACK. Correr: npm run test:copas-espn
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
const MIGRACION = readFileSync(new URL('../supabase/migrations/0033_copas_espn.sql', import.meta.url), 'utf8')
  .replace(/^\s*begin;\s*$/m, '')
  .replace(/^\s*commit;\s*$/m, '');
let aplicada = false;
const ids = {};

before(async () => {
  await c.connect();
  // Aplicada = la vista ya tiene la prioridad nueva (el texto de la vista la incluye).
  const r = await c.query(`select pg_get_viewdef('public.proximos_partidos'::regclass) like '%sportmonks%' as ok`);
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
const uno = async (sql, p = []) => (await c.query(sql, p)).rows[0];

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
