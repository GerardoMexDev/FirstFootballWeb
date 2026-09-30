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
