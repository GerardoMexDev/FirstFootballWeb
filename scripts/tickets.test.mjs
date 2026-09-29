/**
 * Tests de la migración 0025 (tickets de diseño) contra la base REAL, sin dejar rastro:
 * cada test corre en una transacción que termina en ROLLBACK. Si la 0025 todavía no está
 * aplicada, el propio test la ejecuta dentro de su transacción (sin su begin/commit).
 * Imprescindible porque el historial de tickets es imborrable.
 *
 * Usuarios simulados como en PostgREST: `set local role authenticated` + claims con el `sub`.
 * Conexión `pg` directa (IPv6, ver avances.md §10b).
 *
 * Uso:  npm run test:tickets
 *
 * Football First. Creado 2026-09-28.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

process.loadEnvFile('.secretos/.env');
const require = createRequire(import.meta.url);
const { Client } = require('pg');

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DB_PASSWORD } = process.env;
const ref = new URL(NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const conexion = () =>
  new Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(SUPABASE_DB_PASSWORD)}@db.${ref}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

const MIGRACION = readFileSync(new URL('../supabase/migrations/0025_tickets_diseno.sql', import.meta.url), 'utf8')
  .replace(/^\s*begin;\s*$/m, '')
  .replace(/^\s*commit;\s*$/m, '');

const c = conexion();
let aplicada = false;
export const ids = {};

before(async () => {
  await c.connect();
  const { rows } = await c.query(`select to_regclass('public.tickets') is not null as ok`);
  aplicada = rows[0].ok;
  const usuarios = await c.query(
    `select u.email, u.id from auth.users u where u.email in
      ('felipe@footballfirst.uy','pedro@footballfirst.uy','maxi@footballfirst.uy','alexis@footballfirst.uy')`,
  );
  for (const u of usuarios.rows) ids[u.email.split('@')[0]] = u.id;
  const jug = await c.query(
    `select id from jugadores where activo and servicio_match_day order by nombre limit 1`,
  );
  ids.jugadorMd = jug.rows[0].id;
  assert.ok(ids.felipe && ids.pedro && ids.maxi && ids.alexis && ids.jugadorMd, 'faltan usuarios o jugador');
});

after(async () => {
  await c.end();
});

/** Corre `fn` en una transacción que siempre termina en rollback. */
async function enTransaccion(fn) {
  await c.query('begin');
  try {
    if (!aplicada) await c.query(MIGRACION);
    await fn(c);
  } finally {
    await c.query('rollback');
  }
}

/** Simula al usuario `uid` logueado (como PostgREST). */
async function como(cl, uid) {
  await cl.query('reset role');
  await cl.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: uid, role: 'authenticated' }),
  ]);
  await cl.query('set local role authenticated');
}

async function comoAnon(cl) {
  await cl.query('reset role');
  await cl.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'anon' })]);
  await cl.query('set local role anon');
}

async function comoServicio(cl) {
  await cl.query('reset role');
  await cl.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })]);
  await cl.query('set local role service_role');
}

async function comoDueno(cl) {
  await cl.query('reset role');
  await cl.query(`select set_config('request.jwt.claims', '', true)`);
}

/** Ejecuta `sql` esperando que falle con un mensaje que matchee `patron`; no aborta la transacción. */
async function debeFallar(cl, sql, params, patron) {
  await cl.query('savepoint s');
  try {
    await cl.query(sql, params);
  } catch (e) {
    await cl.query('rollback to savepoint s');
    assert.match(e.message, patron);
    return e;
  }
  await cl.query('rollback to savepoint s');
  assert.fail(`Se esperaba un error ${patron} y la consulta pasó: ${sql}`);
}

/** Partido falso (dentro de la transacción) con el jugador de Match Day. Como dueño. */
async function partidoDePrueba(cl, jugadorId, inicioIso = '2030-06-01T20:00:00Z') {
  await comoDueno(cl);
  const { rows } = await cl.query(
    `insert into partidos (inicio_utc, estado, origen) values ($1, 'programado', 'manual') returning id`,
    [inicioIso],
  );
  await cl.query(`insert into partidos_jugadores (partido_id, jugador_id) values ($1, $2)`, [rows[0].id, jugadorId]);
  return rows[0].id;
}

/** Ticket insertado directo como dueño (solo para fixtures de Task 1). */
async function ticketDirecto(cl, partidoId) {
  await comoDueno(cl);
  const { rows } = await cl.query(
    `insert into tickets (partido_id, jugador_id, titulo, nota, creado_por)
     values ($1, $2, 'Match Day — prueba', 'nota de prueba', $3) returning id`,
    [partidoId, ids.jugadorMd, ids.felipe],
  );
  await cl.query(
    `insert into tickets_historial (ticket_id, tipo, autor_id, texto, estado_hasta)
     values ($1, 'creado', $2, 'nota de prueba', 'pendiente')`,
    [rows[0].id, ids.felipe],
  );
  return rows[0].id;
}

// ═════════════ Task 1: esquema, vistas, inmutabilidad, RLS ═════════════

test('RLS: sin sesión no se lee ninguna tabla ni vista de tickets', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await ticketDirecto(cl, p);
    await comoAnon(cl);
    for (const rel of ['tickets', 'tickets_historial', 'tickets_vista', 'tickets_historial_vista', 'perfiles_publicos']) {
      await cl.query('savepoint s');
      try {
        const { rows } = await cl.query(`select * from ${rel}`);
        assert.equal(rows.length, 0, `${rel} devolvió filas a anon`);
      } catch (e) {
        assert.match(e.message, /permission denied/);
      }
      await cl.query('rollback to savepoint s');
    }
  }));

test('RLS: con sesión activa se leen tickets, historial y las vistas', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    const t = await ticketDirecto(cl, p);
    await como(cl, ids.maxi);
    const { rows } = await cl.query(`select * from tickets_vista where id = $1`, [t]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].creado_por_nombre, 'Felipe Merola');
    const h = await cl.query(`select * from tickets_historial_vista where ticket_id = $1`, [t]);
    assert.equal(h.rows[0].autor_nombre, 'Felipe Merola');
  }));

test('RLS: un usuario logueado no puede insertar, editar ni borrar directo', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    const t = await ticketDirecto(cl, p);
    await como(cl, ids.felipe);
    await debeFallar(
      cl,
      `insert into tickets (partido_id, jugador_id, titulo, nota, creado_por) values ($1,$2,'x','x',$3)`,
      [p, ids.jugadorMd, ids.felipe],
      /permission denied/,
    );
    await debeFallar(cl, `update tickets set estado = 'publicado' where id = $1`, [t], /permission denied/);
    await debeFallar(cl, `delete from tickets where id = $1`, [t], /permission denied/);
    await debeFallar(
      cl,
      `insert into tickets_historial (ticket_id, tipo, autor_id, texto) values ($1,'comentario',$2,'x')`,
      [t, ids.felipe],
      /permission denied/,
    );
  }));

test('Inmutable: el historial no se edita ni se borra, ni como service_role', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    const t = await ticketDirecto(cl, p);
    await comoServicio(cl);
    await debeFallar(cl, `update tickets_historial set texto = 'otro' where ticket_id = $1`, [t], /no se puede editar ni borrar/);
    await debeFallar(cl, `delete from tickets_historial where ticket_id = $1`, [t], /no se puede editar ni borrar/);
    await comoDueno(cl);
    await debeFallar(cl, `delete from tickets_historial where ticket_id = $1`, [t], /no se puede editar ni borrar/);
  }));

test('Inmutable: un ticket no se borra (ni como service_role)', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    const t = await ticketDirecto(cl, p);
    await comoServicio(cl);
    await debeFallar(cl, `delete from tickets where id = $1`, [t], /se cancela/);
  }));

test('perfiles_publicos: con sesión activa, solo id/nombre/cargo de los activos', () =>
  enTransaccion(async (cl) => {
    await como(cl, ids.maxi);
    const { rows, fields } = await cl.query(`select * from perfiles_publicos`);
    assert.deepEqual(fields.map((f) => f.name), ['id', 'nombre_completo', 'cargo']);
    const nombres = rows.map((r) => r.nombre_completo).sort();
    assert.ok(nombres.includes('Felipe Merola') && nombres.includes('Pedro Vidal'));
  }));

test('perfiles_publicos: un perfil inactivo no ve a nadie', () =>
  enTransaccion(async (cl) => {
    await comoDueno(cl);
    await cl.query(`update perfiles set activo = false where id = $1`, [ids.alexis]);
    await como(cl, ids.alexis);
    const { rows } = await cl.query(`select * from perfiles_publicos`);
    assert.equal(rows.length, 0);
  }));

test('Fecha límite: 2 días antes del partido en hora de Uruguay; null sin hora', () =>
  enTransaccion(async (cl) => {
    // 2030-06-02 01:30 UTC = 2030-06-01 22:30 en Montevideo → límite 2030-05-30
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-02T01:30:00Z');
    const t = await ticketDirecto(cl, p);
    const sinHora = await partidoDePrueba(cl, ids.jugadorMd, null);
    const t2 = await ticketDirecto(cl, sinHora);
    await como(cl, ids.maxi);
    const { rows } = await cl.query(
      `select id, to_char(fecha_limite, 'YYYY-MM-DD') as fl from tickets_vista where id in ($1, $2)`,
      [t, t2],
    );
    const porId = Object.fromEntries(rows.map((r) => [r.id, r.fl]));
    assert.equal(porId[t], '2030-05-30');
    assert.equal(porId[t2], null);
  }));

test('Checks: link no https y texto > 2000 rechazados a nivel tabla', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    const t = await ticketDirecto(cl, p);
    await comoDueno(cl);
    await debeFallar(cl, `update tickets set link_entrega = 'http://x.com' where id = $1`, [t], /check constraint/);
    await debeFallar(
      cl,
      `insert into tickets_historial (ticket_id, tipo, autor_id, texto) values ($1, 'comentario', $2, repeat('a', 2001))`,
      [t, ids.felipe],
      /check constraint/,
    );
    await debeFallar(
      cl,
      `insert into tickets_historial (ticket_id, tipo, autor_id, texto) values ($1, 'sistema', $2, 'x')`,
      [t, ids.felipe],
      /check constraint/,
    );
  }));

test('RLS: nadie escribe a través de las vistas (perfiles_publicos, tickets_vista, tickets_historial_vista)', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    const t = await ticketDirecto(cl, p);
    await como(cl, ids.maxi);
    // perfiles_publicos es una vista de una sola tabla (auto-actualizable) que corre con los
    // permisos del dueño, no de quien consulta: sin el revoke correcto, cualquier logueado
    // podría escribir sobre `perfiles` a través de ella, esquivando su RLS.
    await debeFallar(
      cl,
      `update perfiles_publicos set nombre_completo = 'x' where id = $1`,
      [ids.felipe],
      /permission denied/,
    );
    await debeFallar(cl, `delete from perfiles_publicos where id = $1`, [ids.felipe], /permission denied/);
    await debeFallar(
      cl,
      `insert into perfiles_publicos (id, nombre_completo, cargo) values (gen_random_uuid(), 'x', 'Prueba')`,
      [],
      /permission denied/,
    );
    // tickets_vista y tickets_historial_vista son vistas con join (no auto-actualizables): ya
    // rechazan la escritura por estructura, pero deben hacerlo sin exponer permiso de escritura.
    await debeFallar(
      cl,
      `update tickets_vista set titulo = 'x' where id = $1`,
      [t],
      /permission denied|cannot update view/,
    );
    await debeFallar(
      cl,
      `delete from tickets_vista where id = $1`,
      [t],
      /permission denied|cannot delete from view/,
    );
    await debeFallar(
      cl,
      `update tickets_historial_vista set texto = 'x' where ticket_id = $1`,
      [t],
      /permission denied|cannot update view/,
    );
    await debeFallar(
      cl,
      `delete from tickets_historial_vista where ticket_id = $1`,
      [t],
      /permission denied|cannot delete from view/,
    );
    await comoDueno(cl);
    const { rows } = await cl.query(`select nombre_completo from perfiles where id = $1`, [ids.felipe]);
    assert.equal(rows[0].nombre_completo, 'Felipe Merola');
  }));

// ═════════════ Task 2: funciones de acción ═════════════

const crear = (cl, p, nota = 'Diseño del Match Day') =>
  cl.query(`select ticket_crear($1, $2, $3) as id`, [p, ids.jugadorMd, nota]).then((r) => r.rows[0].id);
const estadoDe = async (cl, t) => {
  await comoDueno(cl);
  return (await cl.query(`select estado from tickets where id = $1`, [t])).rows[0].estado;
};
const historialDe = async (cl, t) => {
  await comoDueno(cl);
  return (await cl.query(`select tipo, autor_id, texto, link, estado_desde, estado_hasta from tickets_historial where ticket_id = $1 order by id`, [t])).rows;
};

test('Crear: Admin y CM crean; queda pendiente con título armado e historial "creado"', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t1 = await crear(cl, p, '  Previa del partido  ');
    await como(cl, ids.pedro);
    const t2 = await crear(cl, p);
    assert.equal(await estadoDe(cl, t1), 'pendiente');
    const { rows } = await cl.query(`select titulo, nota, creado_por from tickets where id = $1`, [t1]);
    assert.match(rows[0].titulo, /^Match Day — .+ · \? vs \?$/);
    assert.equal(rows[0].nota, 'Previa del partido');
    assert.equal(rows[0].creado_por, ids.felipe);
    const h = await historialDe(cl, t1);
    assert.deepEqual(h.map((x) => [x.tipo, x.estado_hasta]), [['creado', 'pendiente']]);
    assert.ok(t2);
  }));

test('Crear: Diseñador, Prueba e inactivo no pueden', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.maxi);
    await debeFallar(cl, `select ticket_crear($1,$2,'x')`, [p, ids.jugadorMd], /Solo el Administrador o el Community Manager/);
    await como(cl, ids.alexis);
    await debeFallar(cl, `select ticket_crear($1,$2,'x')`, [p, ids.jugadorMd], /Solo el Administrador o el Community Manager/);
    await comoDueno(cl);
    await cl.query(`update perfiles set activo = false where id = $1`, [ids.pedro]);
    await como(cl, ids.pedro);
    await debeFallar(cl, `select ticket_crear($1,$2,'x')`, [p, ids.jugadorMd], /sesión activa/);
  }));

test('Crear: nota vacía o de solo espacios, jugador que no está en el partido → rechazado', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await comoDueno(cl);
    const otro = (await cl.query(`select id from jugadores where id <> $1 and activo limit 1`, [ids.jugadorMd])).rows[0].id;
    await como(cl, ids.felipe);
    await debeFallar(cl, `select ticket_crear($1,$2,'   ')`, [p, ids.jugadorMd], /Escribí qué hay que hacer/);
    await debeFallar(cl, `select ticket_crear($1,$2,repeat('a',2001))`, [p, ids.jugadorMd], /muy largo/);
    await debeFallar(cl, `select ticket_crear($1,$2,'x')`, [p, otro], /no figura en ese partido/);
  }));

test('Ciclo completo: entregar → devolver → entregar → aprobar → publicar', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t = await crear(cl, p);
    await como(cl, ids.maxi);
    await cl.query(`select ticket_entregar($1, $2)`, [t, '  https://www.dropbox.com/s/abc?dl=0  ']);
    assert.equal(await estadoDe(cl, t), 'en_revision');
    await como(cl, ids.felipe);
    await cl.query(`select ticket_devolver($1, 'Cambiá el fondo')`, [t]);
    assert.equal(await estadoDe(cl, t), 'pendiente');
    await como(cl, ids.maxi);
    await cl.query(`select ticket_entregar($1, 'https://www.dropbox.com/s/v2')`, [t]);
    await como(cl, ids.felipe);
    await cl.query(`select ticket_aprobar($1)`, [t]);
    await como(cl, ids.maxi);
    await cl.query(`select ticket_publicar($1)`, [t]);
    assert.equal(await estadoDe(cl, t), 'publicado');
    const h = await historialDe(cl, t);
    assert.deepEqual(h.map((x) => x.tipo), ['creado', 'entrega', 'devuelto', 'entrega', 'aprobado', 'publicado']);
    assert.equal(h[1].link, 'https://www.dropbox.com/s/abc?dl=0');
    assert.equal(h[2].texto, 'Cambiá el fondo');
    const { rows } = await cl.query(`select link_entrega from tickets where id = $1`, [t]);
    assert.equal(rows[0].link_entrega, 'https://www.dropbox.com/s/v2');
  }));

test('Entregar: solo Diseñador, solo desde pendiente, link https obligatorio', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t = await crear(cl, p);
    await debeFallar(cl, `select ticket_entregar($1,'https://x.com/a')`, [t], /Solo el Diseñador/);
    await como(cl, ids.maxi);
    await debeFallar(cl, `select ticket_entregar($1,'http://x.com/a')`, [t], /https:\/\//);
    await debeFallar(cl, `select ticket_entregar($1,'javascript:alert(1)')`, [t], /https:\/\//);
    await debeFallar(cl, `select ticket_entregar($1, null)`, [t], /https:\/\//);
    await cl.query(`select ticket_entregar($1,'https://x.com/a')`, [t]);
    await debeFallar(cl, `select ticket_entregar($1,'https://x.com/b')`, [t], /cambió de estado/);
  }));

test('Revisar: CM no aprueba ni devuelve un ticket de Felipe; Admin sí aprueba uno del CM', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const deFelipe = await crear(cl, p);
    await como(cl, ids.pedro);
    const dePedro = await crear(cl, p);
    await como(cl, ids.maxi);
    await cl.query(`select ticket_entregar($1,'https://x.com/a')`, [deFelipe]);
    await cl.query(`select ticket_entregar($1,'https://x.com/b')`, [dePedro]);
    await debeFallar(cl, `select ticket_aprobar($1)`, [deFelipe], /Solo quien creó el ticket o el Administrador/);
    await como(cl, ids.pedro);
    await debeFallar(cl, `select ticket_aprobar($1)`, [deFelipe], /Solo quien creó el ticket o el Administrador/);
    await debeFallar(cl, `select ticket_devolver($1,'x')`, [deFelipe], /Solo quien creó el ticket o el Administrador/);
    await como(cl, ids.felipe);
    await cl.query(`select ticket_aprobar($1)`, [dePedro]);
    assert.equal(await estadoDe(cl, dePedro), 'aprobado');
  }));

test('Saltos inválidos: pendiente → aprobado/publicado; aprobar dos veces', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t = await crear(cl, p);
    await debeFallar(cl, `select ticket_aprobar($1)`, [t], /cambió de estado/);
    await como(cl, ids.maxi);
    await debeFallar(cl, `select ticket_publicar($1)`, [t], /cambió de estado/);
    await cl.query(`select ticket_entregar($1,'https://x.com/a')`, [t]);
    await como(cl, ids.felipe);
    await cl.query(`select ticket_aprobar($1)`, [t]);
    await debeFallar(cl, `select ticket_aprobar($1)`, [t], /cambió de estado/);
  }));

test('Devolver/cancelar exigen texto (no solo espacios)', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t = await crear(cl, p);
    await debeFallar(cl, `select ticket_cancelar($1,'   ')`, [t], /por qué se cancela/);
    await como(cl, ids.maxi);
    await cl.query(`select ticket_entregar($1,'https://x.com/a')`, [t]);
    await como(cl, ids.felipe);
    await debeFallar(cl, `select ticket_devolver($1,'  ')`, [t], /qué hay que corregir/);
  }));

test('Cancelar: creador o Admin, solo desde pendiente; el Diseñador no', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.pedro);
    const t = await crear(cl, p);
    await como(cl, ids.maxi);
    await debeFallar(cl, `select ticket_cancelar($1,'error')`, [t], /Solo quien creó el ticket o el Administrador/);
    await como(cl, ids.felipe);
    await cl.query(`select ticket_cancelar($1,'Creado por error')`, [t]);
    assert.equal(await estadoDe(cl, t), 'cancelado');
    // estadoDe() usa comoDueno() internamente y resetea la sesión: hay que volver a loguearse
    // como Felipe antes de la siguiente acción (mismo patrón que el test "Ciclo completo").
    await como(cl, ids.felipe);
    await debeFallar(cl, `select ticket_cancelar($1,'otra vez')`, [t], /cambió de estado/);
  }));

test('Comentar: los 3 cargos sí (en cualquier estado); Prueba no; texto vacío no', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t = await crear(cl, p);
    for (const uid of [ids.felipe, ids.pedro, ids.maxi]) {
      await como(cl, uid);
      await cl.query(`select ticket_comentar($1,'hola')`, [t]);
    }
    await como(cl, ids.alexis);
    await debeFallar(cl, `select ticket_comentar($1,'hola')`, [t], /No tenés permiso/);
    await como(cl, ids.maxi);
    await debeFallar(cl, `select ticket_comentar($1,'  ')`, [t], /Escribí un comentario/);
    const h = await historialDe(cl, t);
    assert.equal(h.filter((x) => x.tipo === 'comentario').length, 3);
  }));

test('Prueba (Alexis) no ejecuta ninguna acción', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t = await crear(cl, p);
    await como(cl, ids.alexis);
    await debeFallar(cl, `select ticket_entregar($1,'https://x.com/a')`, [t], /Solo el Diseñador/);
    await debeFallar(cl, `select ticket_cancelar($1,'x')`, [t], /Solo quien creó el ticket o el Administrador/);
  }));

test('anon no puede ejecutar las funciones', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await comoAnon(cl);
    await debeFallar(cl, `select ticket_crear($1,$2,'x')`, [p, ids.jugadorMd], /permission denied/);
  }));

// ═════════════ Task 2 — fix round 1: hallazgos de revisión ═════════════

test('ticket__mover: helpers internos con EXECUTE revocado; p_quien inválido no pasa por alto los permisos', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    const t = await crear(cl, p);
    // Los helpers ticket__* no se exponen por RPC: EXECUTE revocado a authenticated/anon.
    // Esto ya debía cumplirse desde la migración original (revoke explícito en §7).
    await debeFallar(cl, `select ticket__mover($1,'pendiente','publicado','publicado','x',null,null)`, [t], /permission denied/);
    await debeFallar(cl, `select ticket__cargo_actual()`, [], /permission denied/);
    await debeFallar(cl, `select ticket__bloquear($1)`, [t], /permission denied/);
    // Como dueño (bypassea el revoke, como lo haría cualquier código que llamara al helper
    // directo) pero con una sesión válida (jwt claims de Felipe, sin cambiar de role): un
    // p_quien fuera de ('disenador','revisor') debe rechazarse explícitamente en vez de
    // saltearse ambos chequeos de permiso y ejecutar el cambio de estado sin control.
    await comoDueno(cl);
    await cl.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: ids.felipe, role: 'authenticated' }),
    ]);
    await debeFallar(cl, `select ticket__mover($1,'pendiente','publicado','publicado','x',null,null)`, [t], /p_quien inválido/);
  }));

test('Revisor: el CM aprueba y cancela sus propios tickets (rama creado_por = auth.uid())', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.pedro);
    const t1 = await crear(cl, p);
    await como(cl, ids.maxi);
    await cl.query(`select ticket_entregar($1,'https://x.com/a')`, [t1]);
    await como(cl, ids.pedro);
    await cl.query(`select ticket_aprobar($1)`, [t1]);
    assert.equal(await estadoDe(cl, t1), 'aprobado');

    await como(cl, ids.pedro);
    const t2 = await crear(cl, p);
    await cl.query(`select ticket_cancelar($1, 'Ya no hace falta')`, [t2]);
    assert.equal(await estadoDe(cl, t2), 'cancelado');
  }));

export { enTransaccion, como, comoAnon, comoServicio, comoDueno, debeFallar, partidoDePrueba };
