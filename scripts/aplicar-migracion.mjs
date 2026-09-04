/**
 * Aplica un archivo .sql de supabase/migrations/ contra la base del proyecto.
 * Conexión directa (Postgres 17, IPv6/SSL). Lee la contraseña de SUPABASE_DB_PASSWORD
 * y la URL de NEXT_PUBLIC_SUPABASE_URL en .env.local.
 *
 * Uso:  node scripts/aplicar-migracion.mjs supabase/migrations/0001_esquema_inicial.sql
 *
 * El archivo .sql debe traer su propio BEGIN/COMMIT (0001 lo trae): si algo falla,
 * Postgres revierte toda la transacción y la base queda como estaba.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

// --- cargar .env.local (sin dependencias) ---
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const archivo = process.argv[2];
if (!archivo) {
  console.error('Falta el archivo. Ej: node scripts/aplicar-migracion.mjs supabase/migrations/0001_esquema_inicial.sql');
  process.exit(1);
}

const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const password = env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error('Falta SUPABASE_DB_PASSWORD en .env.local');
  process.exit(1);
}

const sql = readFileSync(new URL(`../${archivo}`, import.meta.url), 'utf8');
const client = new Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  console.log(`Conectado a db.${ref}.supabase.co — aplicando ${archivo} …`);
  await client.query(sql);
  console.log('✅ Migración aplicada sin errores.');
} catch (e) {
  console.error('❌ Falló la migración (la transacción se revirtió):');
  console.error(`   ${e.message}`);
  if (e.position) console.error(`   posición ${e.position}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
