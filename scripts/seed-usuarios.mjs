/**
 * Crea (o completa) las 4 cuentas fijas de Fase 1 en Supabase Auth + su fila en `perfiles`.
 * Usa la clave service_role (salta RLS) — solo se corre a mano, nunca desde el navegador.
 * Idempotente: si una cuenta ya existe, no falla, solo actualiza `cargo`/`nombre_completo`.
 *
 * Uso:  npm run seed:usuarios   (o: node scripts/seed-usuarios.mjs)
 *
 * Nota: el plan original (avances.md) preveía `seed-usuarios.ts`. Se escribe en `.mjs`,
 * como los otros scripts de administración (aplicar-migracion.mjs, generar-tipos.mjs),
 * para no sumar una dependencia (ts-node/tsx) solo para correr un script de un solo uso.
 */
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.secretos/.env');

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .secretos/.env');
  process.exit(1);
}

// Dominio interno que la app agrega al nombre de login (ver lib de auth / contexto.md §"Usuarios semilla").
const DOMINIO = 'footballfirst.uy';
// Contraseña compartida de las 4 cuentas demo, confirmada por Gerardo (Sesión 1) — ver avances.md §8.
const CONTRASENA_DEMO = 'demo1234';

/** Las 4 cuentas fijas de Fase 1 (contexto.md §"Usuarios semilla"). */
const CUENTAS = [
  { login: 'maxi', nombreCompleto: 'Maxi Rosales', cargo: 'Diseñador' },
  { login: 'pedro', nombreCompleto: 'Pedro Vidal', cargo: 'Community Manager' },
  { login: 'felipe', nombreCompleto: 'Felipe Merola', cargo: 'Administrador' },
  { login: 'alexis', nombreCompleto: 'Alexis Agustín', cargo: 'Prueba' },
];

const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Busca un usuario de Auth por correo (la API admin no tiene "getUserByEmail"). */
async function buscarPorCorreo(correo) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === correo) ?? null;
}

let huboError = false;

for (const cuenta of CUENTAS) {
  const correo = `${cuenta.login}@${DOMINIO}`;

  let usuarioId;
  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    password: CONTRASENA_DEMO,
    email_confirm: true, // confirmación de email desactivada en Fase 1 (contexto.md)
    user_metadata: { nombre_completo: cuenta.nombreCompleto },
  });

  if (error) {
    // "ya existe" no es un error real acá: el script es idempotente.
    if (!/already.*registered|already.*exists/i.test(error.message)) {
      console.error(`❌ ${correo}: ${error.message}`);
      huboError = true;
      continue;
    }
    const existente = await buscarPorCorreo(correo);
    if (!existente) {
      console.error(`❌ ${correo}: Supabase dice que ya existe pero no lo encuentro en la lista.`);
      huboError = true;
      continue;
    }
    usuarioId = existente.id;
    console.log(`= ${correo} ya existía (id ${usuarioId})`);
  } else {
    usuarioId = data.user.id;
    console.log(`+ ${correo} creada (id ${usuarioId})`);
  }

  // El trigger handle_new_user ya insertó la fila de perfiles con nombre_completo.
  // Acá se fija (o corrige) nombre_completo + cargo; service_role salta la RLS.
  const { error: errorPerfil } = await admin
    .from('perfiles')
    .update({ nombre_completo: cuenta.nombreCompleto, cargo: cuenta.cargo })
    .eq('id', usuarioId);

  if (errorPerfil) {
    console.error(`❌ perfiles de ${correo}: ${errorPerfil.message}`);
    huboError = true;
  }
}

if (huboError) {
  console.error('\n⚠️  Terminó con errores — revisar arriba.');
  process.exit(1);
}
console.log('\n✅ Las 4 cuentas están creadas y con su perfil al día.');
