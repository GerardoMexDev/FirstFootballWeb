// Tests de la migración 0029 (avisos_sistema + códigos de SportMonks) contra la base real,
// siempre dentro de una transacción que termina en ROLLBACK. Correr: npm run test:avisos
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
const MIGRACION = readFileSync(new URL('../supabase/migrations/0029_avisos_sistema_y_codigos_sportmonks.sql', import.meta.url), 'utf8')
  .replace(/^\s*begin;\s*$/m, '')
  .replace(/^\s*commit;\s*$/m, '');
let aplicada = false;
const ids = {};

before(async () => {
  await c.connect();
  const r = await c.query(`select to_regprocedure('public.avisos_sistema()') is not null as ok`);
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
async function corrida(proveedor, recurso, estado, haceHoras, parametros = null) {
  await comoDueno();
  await c.query(
    `insert into sincronizaciones (proveedor, recurso, iniciado_en, finalizado_en, estado, registros_afectados, parametros)
     values ($1, $2, now() - ($4::numeric * interval '1 hour'), now() - ($4::numeric * interval '1 hour'), $3, 0, $5)`,
    [proveedor, recurso, estado, haceHoras, parametros],
  );
}

test('0029: los 4 uruguayos y sus 2 clubes quedan con código de SportMonks', () =>
  enTransaccion(async () => {
    const j = await c.query(`select nombre, id_externo_sportmonks from jugadores where nombre in ('Abel Hernández','Franco Romero','Gastón Martirena','Maximiliano Silvera') order by nombre`);
    assert.deepEqual(j.rows.map((x) => x.id_externo_sportmonks), ['1568', '260747', '37420346', '261815']);
    const cl = await c.query(`select nombre, id_externo_sportmonks from clubes where nombre in ('CA Peñarol','Club Nacional') and proveedor_externo = 'api-football' order by nombre`);
    assert.deepEqual(cl.rows.map((x) => x.id_externo_sportmonks), ['3338', '828']);
  }));

test('0029: una fuente caída más de 36 h le aparece al Administrador, con la fecha del último ok', () =>
  enTransaccion(async () => {
    await comoDueno();
    await c.query(`delete from sincronizaciones where proveedor = 'api-football' and recurso = 'partidos'`);
    await corrida('api-football', 'partidos', 'ok', 72);
    await corrida('api-football', 'partidos', 'error', 1);
    await como(ids.felipe);
    const { rows } = await c.query(`select clave, texto from avisos_sistema()`);
    const a = rows.find((r) => r.clave === 'fuente:api-football/partidos');
    assert.ok(a, 'no apareció el aviso de la fuente');
    assert.match(a.texto, /^La fuente de partidos de copas y selección no se actualiza desde el \d{2}\/\d{2}\. Avisar a Mazdesign\.$/);
  }));

test('0029: una falla reciente con un ok dentro de las 36 h NO avisa', () =>
  enTransaccion(async () => {
    await comoDueno();
    await c.query(`delete from sincronizaciones where proveedor = 'api-football' and recurso = 'partidos'`);
    await corrida('api-football', 'partidos', 'ok', 20);
    await corrida('api-football', 'partidos', 'error', 1);
    await como(ids.felipe);
    const { rows } = await c.query(`select clave from avisos_sistema() where clave = 'fuente:api-football/partidos'`);
    assert.equal(rows.length, 0);
  }));

test('0029: traspasos detectados y jugadores a revisar de la última revisión semanal', () =>
  enTransaccion(async () => {
    await corrida('sportmonks', 'roster', 'ok', 0.5, JSON.stringify({
      detectados: [{ jugador: 'Nacho', desde: 'RB Bragantino', hacia: 'Flamengo', haciaSmId: '1024', fecha: '2026-08-01' }],
      sin_dato: ['Martirena: SportMonks no muestra su contrato y ya no figura en el plantel de Club Nacional — revisar'],
    }));
    await como(ids.felipe);
    const { rows } = await c.query(`select clave, texto from avisos_sistema() order by clave`);
    const t = rows.find((r) => r.clave === 'traspaso:Nacho');
    assert.equal(t?.texto, 'Traspaso detectado: Nacho pasó de RB Bragantino a Flamengo (01/08/2026). Mazdesign lo aplica.');
    assert.ok(rows.some((r) => r.clave.startsWith('revisar:') && r.texto.startsWith('Revisar club: Martirena')));
  }));

test('0029: a quien no es Administrador no le aparece nada; anon no puede ejecutarla', () =>
  enTransaccion(async () => {
    await corrida('sportmonks', 'roster', 'ok', 0.5, JSON.stringify({ detectados: [{ jugador: 'X', desde: 'A', hacia: 'B', fecha: null }] }));
    await como(ids.maxi);
    const { rows } = await c.query(`select * from avisos_sistema()`);
    assert.equal(rows.length, 0);
    await c.query('reset role');
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'anon' })]);
    await c.query('set local role anon');
    await c.query('savepoint s');
    await assert.rejects(c.query(`select * from avisos_sistema()`), /permission denied/);
    await c.query('rollback to savepoint s');
  }));
