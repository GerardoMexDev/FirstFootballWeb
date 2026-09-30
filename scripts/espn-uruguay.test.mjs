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
const MIGRACION_32 = readFileSync(new URL('../supabase/migrations/0032_convocatoria_seleccion.sql', import.meta.url), 'utf8')
  .replace(/^\s*begin;\s*$/m, '')
  .replace(/^\s*commit;\s*$/m, '');
let aplicada32 = false;
const ids = {};

before(async () => {
  await c.connect();
  const r = await c.query(`select to_regclass('public.partidos_seleccion') is not null as ok`);
  aplicada = r.rows[0].ok;
  aplicada32 = (await c.query("select to_regprocedure('public.seleccion_convocar(uuid,uuid,boolean)') is not null as ok")).rows[0].ok;
  const u = await c.query(`select email, id from auth.users where email in ('felipe@footballfirst.uy','maxi@footballfirst.uy','pedro@footballfirst.uy')`);
  for (const x of u.rows) ids[x.email.split('@')[0]] = x.id;
  assert.ok(ids.felipe && ids.maxi && ids.pedro, 'faltan usuarios');
});
after(async () => c.end());

async function enTransaccion(fn) {
  await c.query('begin');
  try {
    if (!aplicada) await c.query(MIGRACION);
    if (!aplicada32) await c.query(MIGRACION_32);
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

async function partidoUruguay() {
  await comoDueno();
  const uy = (await uno("select id from clubes where proveedor_externo = 'espn' and id_externo = '212'")).id;
  const ind = (await uno("insert into clubes (nombre, origen, proveedor_externo, id_externo) values ('India QA', 'api', 'espn', 'qa-ind') returning id")).id;
  const ami = (await uno("select id from competencias where proveedor_externo = 'espn' and id_externo = 'fifa.friendly'")).id;
  const nandez = (await uno("select id from jugadores where seleccion = 'Uruguay' and servicio_match_day and activo limit 1")).id;
  const p = await partido(ind, uy, ami, 'qa-conv-1'); // India local, Uruguay visitante (2030-06-10)
  return { p, nandez };
}

test('convocar: el CM tilda → Match Day con club = Uruguay y ticket pendiente; destildar lo saca', () =>
  enTransaccion(async () => {
    const { p, nandez } = await partidoUruguay();
    await como(ids.pedro);
    await c.query('select seleccion_convocar($1, $2, true)', [p, nandez]);
    const pp = await uno('select club_nombre, rival_nombre, con_seleccion from proximos_partidos where partido_id = $1 and jugador_id = $2', [p, nandez]);
    assert.deepEqual(pp, { club_nombre: 'Uruguay', rival_nombre: 'India QA', con_seleccion: true });
    const tk = await uno('select estado, titulo from tickets_match_day where partido_id = $1 and jugador_id = $2', [p, nandez]);
    assert.equal(tk.estado, 'pendiente');
    assert.match(tk.titulo, /Uruguay vs India QA/);
    await c.query('select seleccion_convocar($1, $2, false)', [p, nandez]);
    const r = await c.query('select 1 from proximos_partidos where partido_id = $1', [p]);
    assert.equal(r.rows.length, 0);
  }));

test('convocar: el Diseñador no puede (42501); un partido de liga no se puede (22023)', () =>
  enTransaccion(async () => {
    const { p, nandez } = await partidoUruguay();
    await como(ids.maxi);
    // El error aborta la transacción: se aísla en un savepoint para seguir usándola.
    await c.query('savepoint antes');
    await assert.rejects(c.query('select seleccion_convocar($1, $2, true)', [p, nandez]), (e) => e.code === '42501');
    await c.query('rollback to savepoint antes');
    await comoDueno();
    const pen = (await uno("select id from clubes where id_externo = '2348'")).id;
    const nac = (await uno("select id from clubes where id_externo = '2356'")).id;
    const uru1 = (await uno("select id from competencias where proveedor_externo = 'espn' and id_externo = 'uru.1'")).id;
    const liga = await partido(pen, nac, uru1, 'qa-conv-liga');
    await como(ids.felipe);
    await assert.rejects(c.query('select seleccion_convocar($1, $2, true)', [liga, nandez]), (e) => e.code === '22023');
  }));

test('proximos_partidos: los partidos de club siguen con su club (ninguno queda sin club_nombre)', () =>
  enTransaccion(async () => {
    await como(ids.felipe);
    const r = await c.query('select count(*)::int as n from proximos_partidos where not con_seleccion and club_nombre is null');
    assert.equal(r.rows[0].n, 0);
  }));
