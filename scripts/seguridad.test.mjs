/**
 * Tests de seguridad y funcionamiento del login contra el Supabase REAL del proyecto.
 * No corren con `npm test` (esos son unitarios, sin red): se corren a mano con
 *
 *     npm run test:seguridad
 *
 * Qué verifican:
 *  - Registro público cerrado (config de Auth + intento real de signUp).
 *  - Sin sesión no se lee ningún dato (RLS).
 *  - Login: credenciales malas rechazadas, con el MISMO mensaje exista o no el usuario
 *    (no se puede averiguar qué usuarios existen).
 *  - Las 4 cuentas fijas existen, activas y con su cargo.
 *  - Con sesión (cuenta de prueba `alexis`): lee datos, ve solo SU perfil, puede cambiar su
 *    nombre/tema, pero NO puede cambiarse cargo, rol ni activo.
 *  - Un perfil nuevo nace INACTIVO y no ve datos aunque tenga usuario de Auth.
 *  - Cerrar sesión invalida el refresh token en el servidor.
 *
 * Usa la cuenta `alexis` (cargo "Prueba") con la contraseña de CLAVE_PRUEBA (o `demo1234`).
 * Todo lo que modifica lo deja como estaba (bloques finally, con service_role).
 *
 * Football First. Creado 2026-09-28.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.secretos/.env');

const {
  NEXT_PUBLIC_SUPABASE_URL: URL_SB,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE,
} = process.env;
const CLAVE_PRUEBA = process.env.CLAVE_PRUEBA || 'demo1234';
const DOMINIO = 'footballfirst.uy';
const CORREO_PRUEBA = `alexis@${DOMINIO}`;

const opciones = { auth: { autoRefreshToken: false, persistSession: false } };
const nuevoCliente = () => createClient(URL_SB, ANON, opciones);
const admin = createClient(URL_SB, SERVICE, opciones);

/** Las 4 cuentas fijas y su cargo esperado. */
const CUENTAS = [
  { correo: `felipe@${DOMINIO}`, nombre: 'Felipe Merola', cargo: 'Administrador' },
  { correo: `pedro@${DOMINIO}`, nombre: 'Pedro Vidal', cargo: 'Community Manager' },
  { correo: `maxi@${DOMINIO}`, nombre: 'Maxi Rosales', cargo: 'Diseñador' },
  { correo: CORREO_PRUEBA, nombre: 'Alexis Agustín', cargo: 'Prueba' },
];

/** Cliente logueado como la cuenta de prueba. */
async function clientePrueba() {
  const cliente = nuevoCliente();
  const { data, error } = await cliente.auth.signInWithPassword({
    email: CORREO_PRUEBA,
    password: CLAVE_PRUEBA,
  });
  assert.ifError(error);
  return { cliente, usuarioId: data.user.id };
}

// ── Registro público ─────────────────────────────────────────────────────────

test('Auth: el registro público está deshabilitado en la config', async () => {
  const r = await fetch(`${URL_SB}/auth/v1/settings`, { headers: { apikey: ANON } });
  const config = await r.json();
  assert.equal(config.disable_signup, true);
  assert.equal(config.external.anonymous_users, false);
});

test('Auth: un signUp desde el navegador es rechazado', async () => {
  const correo = `intruso-${Date.now()}@example.com`;
  const { data, error } = await nuevoCliente().auth.signUp({ email: correo, password: 'Intruso12345!' });
  assert.ok(error, 'signUp debería fallar');
  assert.equal(data.user, null);
});

// ── Sin sesión ───────────────────────────────────────────────────────────────

const TABLAS = ['perfiles', 'jugadores', 'partidos', 'partidos_jugadores', 'clubes', 'hitos', 'estadisticas_partido', 'sincronizaciones'];
for (const tabla of TABLAS) {
  test(`RLS: sin sesión no se lee "${tabla}"`, async () => {
    const { data, error } = await nuevoCliente().from(tabla).select('*').limit(5);
    // RLS devuelve lista vacía, o error de permiso (42501). Cualquier OTRO error (p.ej. tabla
    // inexistente) haría pasar el test sin probar nada, así que se rechaza.
    if (error) assert.equal(error.code, '42501', `error inesperado en ${tabla}: ${error.message}`);
    else assert.equal(data.length, 0, `se leyeron ${data.length} filas de ${tabla}`);
  });
}

test('RLS: con service_role sí hay datos (control: las tablas no están vacías)', async () => {
  for (const tabla of ['jugadores', 'partidos', 'clubes']) {
    const { data } = await admin.from(tabla).select('id').limit(1);
    assert.equal(data.length, 1, `${tabla} vacía — el test sin sesión no probaría nada`);
  }
});

// ── Login ────────────────────────────────────────────────────────────────────

test('Login: contraseña incorrecta es rechazada', async () => {
  const { data, error } = await nuevoCliente().auth.signInWithPassword({
    email: CORREO_PRUEBA,
    password: 'no-es-la-clave',
  });
  assert.ok(error);
  assert.equal(data.session, null);
});

test('Login: usuario inexistente da el MISMO error que clave incorrecta (sin enumeración)', async () => {
  const existente = await nuevoCliente().auth.signInWithPassword({ email: CORREO_PRUEBA, password: 'x-mala-1234' });
  const inexistente = await nuevoCliente().auth.signInWithPassword({
    email: `nadie-${Date.now()}@${DOMINIO}`,
    password: 'x-mala-1234',
  });
  assert.equal(inexistente.error?.message, existente.error?.message);
});

test('Login: la cuenta de prueba entra y recibe sesión', async () => {
  const { cliente } = await clientePrueba();
  const { data } = await cliente.auth.getUser();
  assert.equal(data.user?.email, CORREO_PRUEBA);
});

// ── Cuentas fijas ────────────────────────────────────────────────────────────

test('Cuentas: las 4 existen, activas, con su nombre y cargo', async () => {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  assert.ifError(error);
  for (const cuenta of CUENTAS) {
    const usuario = data.users.find((u) => u.email === cuenta.correo);
    assert.ok(usuario, `falta ${cuenta.correo}`);
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre_completo, cargo, activo')
      .eq('id', usuario.id)
      .single();
    assert.deepEqual(perfil, { nombre_completo: cuenta.nombre, cargo: cuenta.cargo, activo: true });
  }
});

// ── Con sesión ───────────────────────────────────────────────────────────────

test('RLS: con sesión activa se leen los datos de la agencia', async () => {
  const { cliente } = await clientePrueba();
  const { data, error } = await cliente.from('jugadores').select('id').limit(1);
  assert.ifError(error);
  assert.equal(data.length, 1);
});

test('RLS: cada usuario ve solo SU perfil', async () => {
  const { cliente, usuarioId } = await clientePrueba();
  const { data, error } = await cliente.from('perfiles').select('id');
  assert.ifError(error);
  assert.deepEqual(data.map((p) => p.id), [usuarioId]);
});

test('Perfil: el usuario puede cambiar su propio tema', async () => {
  const { cliente, usuarioId } = await clientePrueba();
  const { data: antes } = await admin.from('perfiles').select('tema').eq('id', usuarioId).single();
  const otro = antes.tema === 'oscuro' ? 'claro' : 'oscuro';
  try {
    const { error } = await cliente.from('perfiles').update({ tema: otro }).eq('id', usuarioId);
    assert.ifError(error);
    const { data: despues } = await admin.from('perfiles').select('tema').eq('id', usuarioId).single();
    assert.equal(despues.tema, otro);
  } finally {
    await admin.from('perfiles').update({ tema: antes.tema }).eq('id', usuarioId);
  }
});

for (const [campo, valorMalicioso] of [
  ['cargo', 'Administrador'],
  ['activo', false],
]) {
  test(`Perfil: el usuario NO puede cambiarse "${campo}"`, async () => {
    const { cliente, usuarioId } = await clientePrueba();
    const { data: antes } = await admin.from('perfiles').select(campo).eq('id', usuarioId).single();
    try {
      await cliente.from('perfiles').update({ [campo]: valorMalicioso }).eq('id', usuarioId);
      const { data: despues } = await admin.from('perfiles').select(campo).eq('id', usuarioId).single();
      assert.equal(despues[campo], antes[campo], `${campo} cambió a ${despues[campo]}`);
    } finally {
      await admin.from('perfiles').update({ [campo]: antes[campo] }).eq('id', usuarioId);
    }
  });
}

test('Perfil: el usuario NO puede editar el perfil de otro', async () => {
  const { cliente } = await clientePrueba();
  const { data: usuarios } = await admin.auth.admin.listUsers({ perPage: 200 });
  const felipe = usuarios.users.find((u) => u.email === `felipe@${DOMINIO}`);
  const { data: antes } = await admin.from('perfiles').select('nombre_completo').eq('id', felipe.id).single();
  try {
    await cliente.from('perfiles').update({ nombre_completo: 'Hackeado' }).eq('id', felipe.id);
    const { data: despues } = await admin.from('perfiles').select('nombre_completo').eq('id', felipe.id).single();
    assert.equal(despues.nombre_completo, antes.nombre_completo);
  } finally {
    await admin.from('perfiles').update({ nombre_completo: antes.nombre_completo }).eq('id', felipe.id);
  }
});

// ── Perfil nuevo inactivo ────────────────────────────────────────────────────

const temporales = [];
after(async () => {
  for (const id of temporales) await admin.auth.admin.deleteUser(id);
});

test('Alta: una cuenta nueva nace INACTIVA y no ve datos', async () => {
  const correo = `temporal-${Date.now()}@${DOMINIO}`;
  const clave = `Temp-${Date.now()}-x`;
  const { data: creado, error } = await admin.auth.admin.createUser({
    email: correo,
    password: clave,
    email_confirm: true,
  });
  assert.ifError(error);
  temporales.push(creado.user.id);

  const { data: perfil } = await admin.from('perfiles').select('activo').eq('id', creado.user.id).single();
  assert.equal(perfil.activo, false, 'el perfil nuevo debería nacer inactivo');

  const cliente = nuevoCliente();
  const { error: errorLogin } = await cliente.auth.signInWithPassword({ email: correo, password: clave });
  assert.ifError(errorLogin);
  const { data: filas } = await cliente.from('jugadores').select('id').limit(1);
  assert.equal(filas.length, 0, 'un perfil inactivo no debería leer jugadores');
});

// ── Cerrar sesión ────────────────────────────────────────────────────────────

test('Logout: después de cerrar sesión el refresh token ya no sirve', async () => {
  const { cliente } = await clientePrueba();
  const { data: s } = await cliente.auth.getSession();
  const refresh = s.session.refresh_token;

  const { error } = await cliente.auth.signOut({ scope: 'local' });
  assert.ifError(error);

  const { data, error: errorRefresh } = await nuevoCliente().auth.refreshSession({ refresh_token: refresh });
  assert.ok(errorRefresh, 'el refresh token debería estar revocado');
  assert.equal(data.session, null);
});
