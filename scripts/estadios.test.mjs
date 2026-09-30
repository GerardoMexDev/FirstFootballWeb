// Tests de la migración 0034 (nombres de estadios de la agencia) contra la base real, siempre con
// ROLLBACK. Correr: npm run test:estadios
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
const MIGRACION = readFileSync(new URL('../supabase/migrations/0034_estadios_agencia.sql', import.meta.url), 'utf8')
  .replace(/^\s*begin;\s*$/m, '')
  .replace(/^\s*commit;\s*$/m, '');
let aplicada = false;
const ids = {};

before(async () => {
  await c.connect();
  aplicada = (await c.query(`select to_regclass('public.estadios_equipo') is not null as ok`)).rows[0].ok;
  const u = await c.query(`select email, id from auth.users where email = 'felipe@footballfirst.uy'`);
  ids.felipe = u.rows[0]?.id;
  assert.ok(ids.felipe, 'falta Felipe');
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
const uno = async (sql, p = []) => (await c.query(sql, p)).rows[0];

/** Club de prueba con ese nombre (como lo crearía una sync) y un rival cualquiera. */
async function club(nombre) {
  return (await uno(`insert into clubes (nombre, origen, proveedor_externo, id_externo) values ($1, 'api', 'espn', $2) returning id`, [nombre, 'qa-' + nombre])).id;
}
/** Inserta un partido con ese local y estadio/ciudad de la fuente; devuelve lo que quedó guardado. */
async function partido(localId, estadio, ciudad) {
  const riv = await club('Rival QA ' + Math.random().toString(36).slice(2, 8));
  return uno(
    `insert into partidos (club_local_id, club_visitante_id, inicio_utc, estado, origen, proveedor_externo, id_externo, estadio, ciudad)
     values ($1, $2, '2030-08-01T20:00:00Z', 'programado', 'api', 'espn', $3, $4, $5) returning id, estadio, ciudad`,
    [localId, riv, 'qa-' + Math.random().toString(36).slice(2), estadio, ciudad],
  );
}

test('siembra: 102 equipos, sin alias repetidos', () =>
  enTransaccion(async () => {
    assert.equal((await uno(`select count(*)::int as n from estadios_equipo`)).n, 102);
    const rep = await c.query(`select lower(a) as a, count(*) from estadios_equipo, unnest(alias) a group by 1 having count(*) > 1`);
    assert.deepEqual(rep.rows, []);
  }));

test('cancha habitual con otro nombre → el de la agencia (Nemesio Diez sin acento → Díez, ciudad Toluca)', () =>
  enTransaccion(async () => {
    const tol = await club('Toluca');
    const p = await partido(tol, 'Estadio Nemesio Diez', 'Toluca de Lerdo');
    assert.deepEqual([p.estadio, p.ciudad], ['Estadio Nemesio Díez', 'Toluca']);
  }));

test('opción a: Racing de local en el Centenario (contra Peñarol) → queda el de la fuente', () =>
  enTransaccion(async () => {
    const rac = await club('Racing (Montevideo)');
    const p = await partido(rac, 'Estadio Centenario', 'Montevideo');
    assert.deepEqual([p.estadio, p.ciudad], ['Estadio Centenario', 'Montevideo']);
  }));

test('estadio vacío → el de la agencia (respaldo)', () =>
  enTransaccion(async () => {
    const ce = await club('Central Español Fútbol Club');
    const p = await partido(ce, null, null);
    assert.deepEqual([p.estadio, p.ciudad], ['Parque Palermo', 'Montevideo']);
  }));

test('local sin fila en la tabla → sin cambio', () =>
  enTransaccion(async () => {
    const x = await club('Club Sin Tabla QA');
    const p = await partido(x, 'Estadio Cualquiera', 'Ciudad X');
    assert.deepEqual([p.estadio, p.ciudad], ['Estadio Cualquiera', 'Ciudad X']);
  }));

test('re-sync con el nombre de la fuente → vuelve a quedar el de la agencia (idempotente)', () =>
  enTransaccion(async () => {
    const am = await club('América');
    const p = await partido(am, 'Mexico City Stadium', 'Mexico City');
    assert.equal(p.estadio, 'Estadio Azteca');
    const r = await uno(`update partidos set estadio = 'Mexico City Stadium', ciudad = 'Mexico City' where id = $1 returning estadio, ciudad`, [p.id]);
    assert.deepEqual([r.estadio, r.ciudad], ['Estadio Azteca', 'Ciudad de México']);
  }));

test('la tabla no la leen anon ni authenticated', () =>
  enTransaccion(async () => {
    for (const rol of ['anon', 'authenticated']) {
      await c.query('savepoint s');
      await c.query(`set local role ${rol}`);
      await assert.rejects(c.query('select 1 from estadios_equipo limit 1'), (e) => e.code === '42501');
      await c.query('rollback to savepoint s');
    }
  }));

test('otra cancha que es la habitual de OTRO equipo → nombre de la agencia de esa cancha (Atlante en el Azteca)', () =>
  enTransaccion(async () => {
    const atl = await club('Atlante FC');
    const p = await partido(atl, 'Mexico City Stadium', 'Mexico City');
    assert.deepEqual([p.estadio, p.ciudad], ['Estadio Azteca', 'Ciudad de México']);
  }));

test('nombre ambiguo (misma denominación en dos ciudades) → queda el de la fuente', () =>
  enTransaccion(async () => {
    const x = await club('Club Sin Tabla QA 2');
    const p = await partido(x, 'King Abdullah Sport City Stadium', 'Buraydah');
    assert.deepEqual([p.estadio, p.ciudad], ['King Abdullah Sport City Stadium', 'Buraydah']);
  }));
