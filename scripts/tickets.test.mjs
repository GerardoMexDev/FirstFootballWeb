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

// ═════════════ Task 3: avisos del sistema ═════════════

const avisos = async (cl, t) => {
  await comoDueno(cl);
  return (await cl.query(`select texto from tickets_historial where ticket_id = $1 and tipo = 'sistema' order by id`, [t])).rows.map((r) => r.texto);
};
async function ticketEn(cl, p) {
  await como(cl, ids.felipe);
  return crear(cl, p);
}

test('Aviso: reprogramación ≥ 1 min → texto con antes/ahora y nueva fecha límite', () =>
  enTransaccion(async (cl) => {
    // 2030-06-01 23:00 UTC = sáb 1/6 20:00 UY
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-01T23:00:00Z');
    const t = await ticketEn(cl, p);
    await comoDueno(cl);
    await cl.query(`update partidos set inicio_utc = '2030-06-02T21:00:00Z' where id = $1`, [p]);
    assert.deepEqual(await avisos(cl, t), [
      'El partido se reprogramó: antes sáb 1/6 20:00, ahora dom 2/6 18:00 (hora Uruguay). Nueva fecha límite: vie 31/5.',
    ]);
    const { rows } = await cl.query(`select inicio_utc_conocido from tickets where id = $1`, [t]);
    assert.equal(rows[0].inicio_utc_conocido.toISOString(), '2030-06-02T21:00:00.000Z');
  }));

test('Aviso: cambio < 1 min → ningún aviso', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-01T23:00:00Z');
    const t = await ticketEn(cl, p);
    await comoDueno(cl);
    await cl.query(`update partidos set inicio_utc = '2030-06-01T23:00:30Z' where id = $1`, [p]);
    assert.deepEqual(await avisos(cl, t), []);
  }));

test('Aviso: reprogramado a una fecha cuya fecha límite ya pasó → advertencia', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-01T23:00:00Z');
    const t = await ticketEn(cl, p);
    await comoDueno(cl);
    await cl.query(`update partidos set inicio_utc = now() + interval '1 day' where id = $1`, [p]);
    const [texto] = await avisos(cl, t);
    assert.match(texto, /⚠️ La nueva fecha límite ya pasó\.$/);
  }));

test('Aviso: hora confirmada (antes sin hora)', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd, null);
    const t = await ticketEn(cl, p);
    await comoDueno(cl);
    await cl.query(`update partidos set inicio_utc = '2030-06-01T23:00:00Z' where id = $1`, [p]);
    assert.deepEqual(await avisos(cl, t), ['Hora confirmada: sáb 1/6 20:00 (hora Uruguay). Fecha límite: jue 30/5.']);
  }));

test('Aviso: suspendido y vuelta a programado; finalizado no avisa', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-01T23:00:00Z');
    const t = await ticketEn(cl, p);
    await comoDueno(cl);
    await cl.query(`update partidos set estado = 'suspendido' where id = $1`, [p]);
    await cl.query(`update partidos set estado = 'programado' where id = $1`, [p]);
    await cl.query(`update partidos set estado = 'finalizado' where id = $1`, [p]);
    assert.deepEqual(await avisos(cl, t), [
      'El partido figura como suspendido en la fuente.',
      'El partido vuelve a figurar como programado para sáb 1/6 20:00 (hora Uruguay).',
    ]);
  }));

test('Aviso: tickets publicados o cancelados no reciben avisos', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-01T23:00:00Z');
    const t = await ticketEn(cl, p);
    await cl.query(`select ticket_cancelar($1, 'no va')`, [t]);
    await comoDueno(cl);
    await cl.query(`update partidos set estado = 'suspendido' where id = $1`, [p]);
    assert.deepEqual(await avisos(cl, t), []);
  }));

test('Partido borrado: el ticket vive, queda sin partido, conserva la fecha y avisa', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-01T23:00:00Z');
    const t = await ticketEn(cl, p);
    await comoDueno(cl);
    await cl.query(`delete from partidos where id = $1`, [p]);
    const { rows } = await cl.query(`select partido_id, inicio_utc_conocido from tickets where id = $1`, [t]);
    assert.equal(rows[0].partido_id, null);
    assert.equal(rows[0].inicio_utc_conocido.toISOString(), '2030-06-01T23:00:00.000Z');
    assert.deepEqual(await avisos(cl, t), ['El partido ya no figura en la fuente de datos. El ticket se conserva.']);
    await como(cl, ids.maxi);
    const v = await cl.query(`select partido_eliminado, to_char(fecha_limite,'YYYY-MM-DD') fl from tickets_vista where id = $1`, [t]);
    assert.deepEqual(v.rows[0], { partido_eliminado: true, fl: '2030-05-30' });
  }));

test('Un error dentro del aviso NO frena el update del partido', () =>
  enTransaccion(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd, '2030-06-01T23:00:00Z');
    const t = await ticketEn(cl, p);
    await comoDueno(cl);
    await cl.query(`create or replace function ticket__fecha_hora_uy(p timestamptz) returns text
                    language plpgsql as $$ begin raise exception 'roto a propósito'; end $$`);
    await cl.query(`update partidos set inicio_utc = '2030-06-05T23:00:00Z' where id = $1`, [p]);
    const { rows } = await cl.query(`select inicio_utc from partidos where id = $1`, [p]);
    assert.equal(rows[0].inicio_utc.toISOString(), '2030-06-05T23:00:00.000Z');
    assert.deepEqual(await avisos(cl, t), []);
  }));

// ═════════════ Task 4: concurrencia (necesita la 0025 aplicada) ═════════════
// Usa datos COMMITEADOS (dos conexiones no ven lo no commiteado de la otra) sobre un
// partido falso en el año 2000 (no aparece en "próximos"), y los borra al final como
// dueño deshabilitando los triggers de inmutabilidad (igual que limpiar-tickets.sql).

test('Concurrencia: aprobar y devolver a la vez → gana uno solo', async () => {
  // Necesita la 0025 aplicada (datos commiteados). Si no lo está, no hay nada que probar.
  if (!aplicada) return;
  const a = conexion();
  const b = conexion();
  let partido;
  let ticket;
  try {
    await a.connect();
    await b.connect();
    const r = await c.query(
      `insert into partidos (inicio_utc, estado, origen) values ('2000-01-01T20:00:00Z','programado','manual') returning id`,
    );
    partido = r.rows[0].id;
    await c.query(`insert into partidos_jugadores (partido_id, jugador_id) values ($1,$2)`, [partido, ids.jugadorMd]);
    await c.query('begin');
    await como(c, ids.felipe);
    ticket = (await c.query(`select ticket_crear($1,$2,'concurrencia') id`, [partido, ids.jugadorMd])).rows[0].id;
    await como(c, ids.maxi);
    await c.query(`select ticket_entregar($1,'https://x.com/c')`, [ticket]);
    await c.query('commit');
    await c.query('reset role');

    await a.query('begin');
    await como(a, ids.felipe);
    await a.query(`select ticket_aprobar($1)`, [ticket]); // toma el lock
    await b.query('begin');
    await como(b, ids.felipe);
    const devolver = b.query(`select ticket_devolver($1,'tarde')`, [ticket]).then(
      () => null,
      (e) => e,
    );
    // b debe quedar esperando el lock de a: si "devolver" resolviera antes del commit de a,
    // el test de concurrencia real no estaría probando nada (no habría contención real).
    const PENDIENTE = Symbol('pendiente');
    const antesDelCommit = await Promise.race([devolver, new Promise((res) => setTimeout(() => res(PENDIENTE), 500))]);
    assert.equal(antesDelCommit, PENDIENTE, 'b debería seguir esperando el lock de a en vez de resolver antes');
    await a.query('commit');
    const error = await devolver;
    await b.query('rollback');
    assert.ok(error, 'la segunda acción debería fallar');
    assert.match(error.message, /cambió de estado/);
    const { rows } = await c.query(`select estado from tickets where id = $1`, [ticket]);
    assert.equal(rows[0].estado, 'aprobado');
  } finally {
    try {
      // Si el test se cortó entre el `begin`+lock de `a` y su `commit` (p. ej. porque la
      // aserción de "b sigue pendiente" falló), `a` puede seguir reteniendo el lock de fila del
      // ticket. Liberarlo (y el de `b`, por las dudas) ANTES de que `c` intente borrar esa fila
      // evita una espera circular: `c` bloqueado por el lock de `a`, y `a.end()`/`b.end()` sin
      // correr todavía porque están en el finally más externo, después de esta limpieza.
      await a.query('rollback').catch(() => {});
      await b.query('rollback').catch(() => {});
      await c.query('rollback').catch(() => {});
      await c.query('reset role').catch(() => {});
      await c.query('begin');
      try {
        // Red de seguridad: si por algún motivo imprevisto igual queda un lock (p. ej. otra
        // sesión), que la limpieza tire en vez de colgar la suite para siempre.
        await c.query(`set local lock_timeout = '10s'`);
        await c.query('alter table tickets_historial disable trigger tickets_historial_inmutable');
        await c.query('alter table tickets disable trigger tickets_sin_borrado');
        try {
          if (ticket) {
            await c.query('delete from tickets_historial where ticket_id = $1', [ticket]);
            await c.query('delete from tickets where id = $1', [ticket]);
          }
          if (partido) await c.query('delete from partidos where id = $1', [partido]);
        } finally {
          // Los triggers se reactivan pase lo que pase con los deletes: si alguno falla, no
          // queda una tabla de producción con la inmutabilidad deshabilitada dentro del commit.
          await c.query('alter table tickets_historial enable trigger tickets_historial_inmutable');
          await c.query('alter table tickets enable trigger tickets_sin_borrado');
        }
        await c.query('commit');
      } catch (e) {
        // Si algo de la limpieza falló, no commiteamos el DISABLE: mejor un rollback completo
        // (los triggers vuelven a como estaban) y que el test falle fuerte para que se note.
        await c.query('rollback').catch(() => {});
        throw e;
      }
      // Verificación de solo lectura post-limpieza: no debe quedar basura ni triggers apagados.
      const trig = await c.query(
        `select tgname, tgenabled from pg_trigger where tgname in ('tickets_historial_inmutable','tickets_sin_borrado')`,
      );
      for (const fila of trig.rows) {
        assert.equal(fila.tgenabled, 'O', `${fila.tgname} debería quedar habilitado ('O') después de la limpieza`);
      }
      if (ticket) {
        const t = await c.query('select count(*)::int as n from tickets where id = $1', [ticket]);
        assert.equal(t.rows[0].n, 0, 'quedó un ticket sin borrar');
        const h = await c.query('select count(*)::int as n from tickets_historial where ticket_id = $1', [ticket]);
        assert.equal(h.rows[0].n, 0, 'quedó historial sin borrar');
      }
      if (partido) {
        const p = await c.query('select count(*)::int as n from partidos where id = $1', [partido]);
        assert.equal(p.rows[0].n, 0, 'quedó el partido de prueba sin borrar');
      }
    } finally {
      await a.end().catch(() => {});
      await b.end().catch(() => {});
    }
  }
});

// ═════════════ 0028: tickets de fecha (sin partido), desde la ficha del jugador ═════════════

const MIGRACION_0028 = readFileSync(new URL('../supabase/migrations/0028_tickets_evento.sql', import.meta.url), 'utf8')
  .replace(/^\s*begin;\s*$/m, '')
  .replace(/^\s*commit;\s*$/m, '');
let aplicada0028 = false;
before(async () => {
  const { rows } = await c.query(`select to_regprocedure('public.ticket_crear_evento(uuid,date,text,text)') is not null as ok`);
  aplicada0028 = rows[0].ok;
  const j = await c.query(`select id from jugadores where activo and servicio_contenido order by nombre limit 1`);
  ids.jugadorContenido = j.rows[0].id;
});

/** Como enTransaccion, aplicando 0028 adentro si todavía no está en la base. */
async function enTransaccion0028(fn) {
  await c.query('begin');
  try {
    if (!aplicada) await c.query(MIGRACION);
    if (!aplicada0028) await c.query(MIGRACION_0028);
    await fn(c);
  } finally {
    await c.query('rollback');
  }
}

const HOY_UY = `(now() at time zone 'America/Montevideo')::date`;

test('0028: Admin crea un ticket de fecha; título, fecha límite y no-huérfano', () =>
  enTransaccion0028(async (cl) => {
    await como(cl, ids.felipe);
    const { rows } = await cl.query(
      `select ticket_crear_evento($1, ${HOY_UY} + 10, 'Cumpleaños', 'Diseño del cumple') id`,
      [ids.jugadorContenido],
    );
    const v = await cl.query(
      `select titulo, fecha_evento, motivo, fecha_limite, partido_eliminado, partido_id, estado,
              (fecha_evento - fecha_limite) as anticipacion, ${HOY_UY} + 10 as esperado
       from tickets_vista where id = $1`,
      [rows[0].id],
    );
    const t = v.rows[0];
    assert.match(t.titulo, /^Contenido — .+ · Cumpleaños \(\d{1,2}\/\d{1,2}\)$/);
    assert.equal(t.motivo, 'Cumpleaños');
    assert.equal(t.anticipacion, 2);
    assert.equal(t.partido_eliminado, false);
    assert.equal(t.partido_id, null);
    assert.equal(t.estado, 'pendiente');
    assert.equal(t.fecha_evento.toISOString(), t.esperado.toISOString());
    const h = await cl.query(`select tipo from tickets_historial_vista where ticket_id = $1`, [rows[0].id]);
    assert.deepEqual(h.rows.map((x) => x.tipo), ['creado']);
  }));

test('0028: el CM también crea; Diseñador y Prueba no (42501)', () =>
  enTransaccion0028(async (cl) => {
    await como(cl, ids.pedro);
    await cl.query(`select ticket_crear_evento($1, ${HOY_UY} + 3, 'Convocado a la selección', 'Pieza de convocatoria')`, [ids.jugadorContenido]);
    for (const quien of [ids.maxi, ids.alexis]) {
      await como(cl, quien);
      const e = await debeFallar(
        cl,
        `select ticket_crear_evento($1, ${HOY_UY} + 3, 'Cumpleaños', 'x')`,
        [ids.jugadorContenido],
        /Solo el Administrador o el Community Manager pueden crear tickets\./,
      );
      assert.equal(e.code, '42501');
    }
  }));

test('0028: fecha pasada, motivo vacío o largo, nota vacía → error', () =>
  enTransaccion0028(async (cl) => {
    await como(cl, ids.felipe);
    await debeFallar(cl, `select ticket_crear_evento($1, ${HOY_UY} - 1, 'Cumpleaños', 'x')`, [ids.jugadorContenido], /La fecha del evento no puede ser anterior a hoy\./);
    await debeFallar(cl, `select ticket_crear_evento($1, null, 'Cumpleaños', 'x')`, [ids.jugadorContenido], /La fecha del evento no puede ser anterior a hoy\./);
    await debeFallar(cl, `select ticket_crear_evento($1, ${HOY_UY} + 1, '   ', 'x')`, [ids.jugadorContenido], /Escribí el motivo \(hasta 120 caracteres\)\./);
    await debeFallar(cl, `select ticket_crear_evento($1, ${HOY_UY} + 1, repeat('a', 121), 'x')`, [ids.jugadorContenido], /Escribí el motivo \(hasta 120 caracteres\)\./);
    await debeFallar(cl, `select ticket_crear_evento($1, ${HOY_UY} + 1, 'Cumpleaños', '  ')`, [ids.jugadorContenido], /Escribí qué hay que hacer\./);
    // hoy mismo sí se puede
    await cl.query(`select ticket_crear_evento($1, ${HOY_UY}, 'Cumpleaños', 'hoy')`, [ids.jugadorContenido]);
  }));

test('0028: jugador sin Contenido o inactivo → error', () =>
  enTransaccion0028(async (cl) => {
    await comoDueno(cl);
    await cl.query(`update jugadores set servicio_contenido = false where id = $1`, [ids.jugadorContenido]);
    await como(cl, ids.felipe);
    await debeFallar(cl, `select ticket_crear_evento($1, ${HOY_UY} + 1, 'Cumpleaños', 'x')`, [ids.jugadorContenido], /Ese jugador no está en el servicio de Contenido\./);
    await comoDueno(cl);
    await cl.query(`update jugadores set servicio_contenido = true, activo = false where id = $1`, [ids.jugadorContenido]);
    await como(cl, ids.felipe);
    await debeFallar(cl, `select ticket_crear_evento($1, ${HOY_UY} + 1, 'Cumpleaños', 'x')`, [ids.jugadorContenido], /Ese jugador no está en el servicio de Contenido\./);
  }));

test('0028: un ticket no puede tener partido y fecha a la vez; fecha y motivo van juntos', () =>
  enTransaccion0028(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await comoDueno(cl);
    await debeFallar(
      cl,
      `insert into tickets (partido_id, jugador_id, titulo, nota, creado_por, fecha_evento, motivo)
       values ($1, $2, 't', 'n', $3, current_date, 'Cumpleaños')`,
      [p, ids.jugadorMd, ids.felipe],
      /tickets_partido_o_fecha/,
    );
    await debeFallar(
      cl,
      `insert into tickets (jugador_id, titulo, nota, creado_por, fecha_evento) values ($1, 't', 'n', $2, current_date)`,
      [ids.jugadorMd, ids.felipe],
      /tickets_fecha_con_motivo/,
    );
  }));

test('0028: ciclo completo sobre un ticket de fecha (entregar → aprobar → publicar)', () =>
  enTransaccion0028(async (cl) => {
    await como(cl, ids.felipe);
    const { rows } = await cl.query(`select ticket_crear_evento($1, ${HOY_UY} + 5, 'Cumpleaños', 'cumple') id`, [ids.jugadorContenido]);
    const id = rows[0].id;
    await como(cl, ids.maxi);
    await cl.query(`select ticket_entregar($1, 'https://www.dropbox.com/s/cumple')`, [id]);
    await como(cl, ids.felipe);
    await cl.query(`select ticket_aprobar($1)`, [id]);
    await como(cl, ids.maxi);
    await cl.query(`select ticket_publicar($1)`, [id]);
    const v = await cl.query(`select estado from tickets_vista where id = $1`, [id]);
    assert.equal(v.rows[0].estado, 'publicado');
  }));

test('0028: la vista sigue sin leerse sin sesión y la función no la ejecuta anon', () =>
  enTransaccion0028(async (cl) => {
    await comoAnon(cl);
    await debeFallar(cl, `select ticket_crear_evento($1, current_date + 1, 'x', 'x')`, [ids.jugadorContenido], /permission denied/);
    await cl.query('savepoint s');
    try {
      const { rows } = await cl.query(`select * from tickets_vista`);
      assert.equal(rows.length, 0);
    } catch (e) {
      assert.match(e.message, /permission denied/);
    }
    await cl.query('rollback to savepoint s');
  }));

// ═════════════ 0030: Match Day automático + tickets simplificados ═════════════
const MIGRACION_0030 = readFileSync(new URL('../supabase/migrations/0030_match_day_automatico.sql', import.meta.url), 'utf8')
  .replace(/^\s*begin;\s*$/m, '')
  .replace(/^\s*commit;\s*$/m, '');
let aplicada0030 = false;
before(async () => {
  const { rows } = await c.query(`select to_regprocedure('public.diseno_partido_marcar(uuid,uuid,boolean)') is not null as ok`);
  aplicada0030 = rows[0].ok;
});
async function enTransaccion0030(fn) {
  await c.query('begin');
  try {
    if (!aplicada) await c.query(MIGRACION);
    if (!aplicada0030) await c.query(MIGRACION_0030);
    await fn(c);
  } finally {
    await c.query('rollback');
  }
}
const HOY = `(now() at time zone 'America/Montevideo')::date`;
/** Partido de prueba a `dias` de hoy (hora 20:00 UY), con el jugador de Match Day. */
async function partidoEnDias(cl, dias) {
  const { rows } = await cl.query(`select ((${HOY} + $1::int)::text || 'T23:00:00Z') as iso`, [dias]);
  return partidoDePrueba(cl, ids.jugadorMd, rows[0].iso);
}
async function estadoMd(cl, partido) {
  await como(cl, ids.felipe);
  const { rows } = await cl.query(`select estado, fecha_limite from tickets_match_day where partido_id = $1 and jugador_id = $2`, [partido, ids.jugadorMd]);
  return rows[0];
}

test('0030: partido futuro sin marca → pendiente; con marca del Diseñador → completado; desmarcar vuelve', () =>
  enTransaccion0030(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd) // 2030: sin partidos reales ese día (la vista deja 1 por jugador y día);
    assert.equal((await estadoMd(cl, p)).estado, 'pendiente');
    await como(cl, ids.maxi);
    await cl.query(`select diseno_partido_marcar($1, $2, true)`, [p, ids.jugadorMd]);
    await cl.query(`select diseno_partido_marcar($1, $2, true)`, [p, ids.jugadorMd]); // idempotente
    assert.equal((await estadoMd(cl, p)).estado, 'completado');
    await como(cl, ids.maxi);
    await cl.query(`select diseno_partido_marcar($1, $2, false)`, [p, ids.jugadorMd]);
    assert.equal((await estadoMd(cl, p)).estado, 'pendiente');
  }));

test('0030: pasado el límite y sin marca → vencido; anterior a match_day_desde → sin estado', () =>
  enTransaccion0030(async (cl) => {
    const manana = await partidoEnDias(cl, 1); // límite = ayer
    // Cargado con tiempo (si no, 0040 lo trata como de último momento y vence el día del partido).
    await cl.query(`update partidos set creado_en = now() - interval '10 days' where id = $1`, [manana]);
    assert.equal((await estadoMd(cl, manana)).estado, 'vencido');
    await comoDueno(cl);
    const { rows } = await cl.query(`select (match_day_desde() - 3) as d`);
    const viejo = await partidoDePrueba(cl, ids.jugadorMd, `${rows[0].d.toISOString().slice(0, 10)}T23:00:00Z`);
    assert.equal((await estadoMd(cl, viejo)).estado, null);
  }));

test('0030: la fecha límite sigue al partido si se reprograma', () =>
  enTransaccion0030(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    const antes = (await estadoMd(cl, p)).fecha_limite;
    await comoDueno(cl);
    await cl.query(`update partidos set inicio_utc = inicio_utc + interval '5 days' where id = $1`, [p]);
    const despues = (await estadoMd(cl, p)).fecha_limite;
    assert.equal(Math.round((despues - antes) / 86400000), 5);
  }));

test('0030: solo el Diseñador marca; par partido-jugador inexistente → error', () =>
  enTransaccion0030(async (cl) => {
    const p = await partidoEnDias(cl, 10);
    for (const quien of [ids.felipe, ids.pedro, ids.alexis]) {
      await como(cl, quien);
      const e = await debeFallar(cl, `select diseno_partido_marcar($1, $2, true)`, [p, ids.jugadorMd], /Solo el Diseñador puede hacer esto\./);
      assert.equal(e.code, '42501');
    }
    await como(cl, ids.maxi);
    await debeFallar(cl, `select diseno_partido_marcar($1, $2, true)`, [p, ids.felipe], /Ese jugador no figura en ese partido de Match Day\./);
    await comoAnon(cl);
    await debeFallar(cl, `select diseno_partido_marcar($1, $2, true)`, [p, ids.jugadorMd], /permission denied/);
  }));

test('0030: ticket manual pendiente → completar (Diseñador) → reabrir; cancelar sigue siendo del creador/Admin', () =>
  enTransaccion0030(async (cl) => {
    const p = await partidoEnDias(cl, 10);
    await como(cl, ids.pedro);
    const t = (await cl.query(`select ticket_crear($1, $2, 'pieza puntual') id`, [p, ids.jugadorMd])).rows[0].id;
    await como(cl, ids.felipe);
    await debeFallar(cl, `select ticket_completar($1)`, [t], /Solo el Diseñador puede hacer esto\./);
    await como(cl, ids.maxi);
    await cl.query(`select ticket_completar($1)`, [t]);
    let v = await cl.query(`select estado from tickets where id = $1`, [t]);
    assert.equal(v.rows[0].estado, 'publicado');
    await cl.query(`select ticket_reabrir($1, 'faltó una versión')`, [t]);
    v = await cl.query(`select estado from tickets where id = $1`, [t]);
    assert.equal(v.rows[0].estado, 'pendiente');
    const h = await cl.query(`select tipo from tickets_historial where ticket_id = $1 order by id`, [t]);
    assert.deepEqual(h.rows.map((x) => x.tipo), ['creado', 'publicado', 'devuelto']);
    await como(cl, ids.pedro);
    await cl.query(`select ticket_cancelar($1, 'ya no va')`, [t]);
  }));

test('0030: la migración pasa en_revision/aprobado a completado (publicado) con evento sistema', () =>
  enTransaccion0030(async (cl) => {
    // Con 0030 ya aplicada no quedan tickets en esos estados.
    await comoDueno(cl);
    const { rows } = await cl.query(`select count(*)::int n from tickets where estado in ('en_revision','aprobado')`);
    assert.equal(rows[0].n, 0);
  }));

// ═════════════ 0040: Match Day cancelado (con motivo) + último momento ═════════════
const MIGRACION_0040 = readFileSync(new URL('../supabase/migrations/0040_match_day_cancelado_y_ultimo_momento.sql', import.meta.url), 'utf8')
  .replace(/^\s*begin;\s*$/m, '')
  .replace(/^\s*commit;\s*$/m, '');
let aplicada0040 = false;
before(async () => {
  const { rows } = await c.query(`select to_regprocedure('public.diseno_partido_cancelar(uuid,uuid,text)') is not null as ok`);
  aplicada0040 = rows[0].ok;
});
async function enTransaccion0040(fn) {
  return enTransaccion0030(async (cl) => {
    if (!aplicada0040) await cl.query(MIGRACION_0040);
    await fn(cl);
  });
}
async function filaMd(cl, partido) {
  await como(cl, ids.felipe);
  const { rows } = await cl.query(
    `select estado, fecha_limite, dia_uy, motivo_cancelacion, ultimo_momento from tickets_match_day where partido_id = $1 and jugador_id = $2`,
    [partido, ids.jugadorMd],
  );
  return rows[0];
}

test('0040: Admin, CM y Diseñador cancelan con motivo; quitar la cancelación vuelve a pendiente', () =>
  enTransaccion0040(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    for (const quien of [ids.felipe, ids.pedro, ids.maxi]) {
      await como(cl, quien);
      await cl.query(`select diseno_partido_cancelar($1, $2, $3)`, [p, ids.jugadorMd, '  el jugador pidió no hacerlo  ']);
      const f = await filaMd(cl, p);
      assert.equal(f.estado, 'cancelado');
      assert.equal(f.motivo_cancelacion, 'el jugador pidió no hacerlo');
      await como(cl, quien);
      await cl.query(`select diseno_partido_cancelar($1, $2, null)`, [p, ids.jugadorMd]);
      assert.equal((await filaMd(cl, p)).estado, 'pendiente');
    }
  }));

test('0040: motivo vacío o largo → error; Prueba (42501), anon y jugador ajeno no', () =>
  enTransaccion0040(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.pedro);
    await debeFallar(cl, `select diseno_partido_cancelar($1, $2, '   ')`, [p, ids.jugadorMd], /Escribí el motivo/);
    await debeFallar(cl, `select diseno_partido_cancelar($1, $2, $3)`, [p, ids.jugadorMd, 'x'.repeat(301)], /demasiado largo/);
    await debeFallar(cl, `select diseno_partido_cancelar($1, $2, 'motivo')`, [p, ids.felipe], /no figura en ese partido/);
    await como(cl, ids.alexis);
    const e = await debeFallar(cl, `select diseno_partido_cancelar($1, $2, 'motivo')`, [p, ids.jugadorMd], /No tenés permiso/);
    assert.equal(e.code, '42501');
    await comoAnon(cl);
    await debeFallar(cl, `select diseno_partido_cancelar($1, $2, 'motivo')`, [p, ids.jugadorMd], /permission denied/);
    await como(cl, ids.pedro);
    await debeFallar(cl, `insert into disenos_partido (partido_id, jugador_id, completado_por, cancelado, motivo_cancelacion) values ($1, $2, $3, true, 'x')`, [p, ids.jugadorMd, ids.pedro], /permission denied/);
  }));

test('0040: Completado y Cancelado se excluyen; destildar Completado no borra un Cancelado', () =>
  enTransaccion0040(async (cl) => {
    const p = await partidoDePrueba(cl, ids.jugadorMd);
    await como(cl, ids.felipe);
    await cl.query(`select diseno_partido_cancelar($1, $2, 'amistoso')`, [p, ids.jugadorMd]);
    await como(cl, ids.maxi);
    await cl.query(`select diseno_partido_marcar($1, $2, false)`, [p, ids.jugadorMd]);
    assert.equal((await filaMd(cl, p)).estado, 'cancelado');
    await como(cl, ids.maxi);
    await cl.query(`select diseno_partido_marcar($1, $2, true)`, [p, ids.jugadorMd]);
    let f = await filaMd(cl, p);
    assert.equal(f.estado, 'completado');
    assert.equal(f.motivo_cancelacion, null);
    await como(cl, ids.pedro);
    await cl.query(`select diseno_partido_cancelar($1, $2, 'al final no')`, [p, ids.jugadorMd]);
    f = await filaMd(cl, p);
    assert.equal(f.estado, 'cancelado');
    await como(cl, ids.pedro);
    await cl.query(`select diseno_partido_cancelar($1, $2, null)`, [p, ids.jugadorMd]);
    assert.equal((await filaMd(cl, p)).estado, 'pendiente');
  }));

test('0040: partido cargado después de su límite → último momento, vence el día del partido', () =>
  enTransaccion0040(async (cl) => {
    const p = await partidoEnDias(cl, 1); // cargado hoy, límite normal = ayer
    let f = await filaMd(cl, p);
    assert.equal(f.ultimo_momento, true);
    assert.equal(f.estado, 'pendiente');
    assert.equal(f.fecha_limite.getTime(), f.dia_uy.getTime());
    await comoDueno(cl);
    await cl.query(`update partidos set creado_en = now() - interval '10 days' where id = $1`, [p]);
    f = await filaMd(cl, p);
    assert.equal(f.ultimo_momento, false);
    assert.equal(f.estado, 'vencido');
    const lejos = await partidoEnDias(cl, 10); // cargado hoy con tiempo de sobra
    assert.equal((await filaMd(cl, lejos)).ultimo_momento, false);
  }));

export { enTransaccion, como, comoAnon, comoServicio, comoDueno, debeFallar, partidoDePrueba };
