/**
 * Aplica un archivo .sql de supabase/migrations/ contra la base del proyecto.
 * Conexión directa (Postgres 17, SSL). Lee las credenciales de .secretos/.env.
 *
 * Uso:  node scripts/aplicar-migracion.mjs supabase/migrations/0001_esquema_inicial.sql
 *
 * El archivo .sql debe traer su propio BEGIN/COMMIT (0001 lo trae): si algo falla,
 * Postgres revierte toda la transacción y la base queda como estaba.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

process.loadEnvFile('.secretos/.env');

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const archivo = process.argv[2];
if (!archivo) {
  console.error('Falta el archivo. Ej: node scripts/aplicar-migracion.mjs supabase/migrations/0001_esquema_inicial.sql');
  process.exit(1);
}

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DB_PASSWORD } = process.env;
if (!SUPABASE_DB_PASSWORD) {
  console.error('Falta SUPABASE_DB_PASSWORD en .secretos/.env');
  process.exit(1);
}

const ref = new URL(NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const sql = readFileSync(new URL(`../${archivo}`, import.meta.url), 'utf8');

const client = new Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(SUPABASE_DB_PASSWORD)}@db.${ref}.supabase.co:5432/postgres`,
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
