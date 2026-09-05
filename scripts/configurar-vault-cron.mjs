/**
 * Guarda (o rota) `SYNC_FUNCTIONS_SECRET` en Supabase Vault, con el nombre
 * 'sync_functions_secret' — es lo que lee el job de `pg_cron` de la migración 0002 para
 * autenticar la llamada a `sync-partidos`. Conexión directa a Postgres (mismo patrón que
 * `aplicar-migracion.mjs`) con consultas PARAMETRIZADAS: el valor nunca queda en un
 * archivo versionado, ni en este script.
 *
 * Uso: node scripts/configurar-vault-cron.mjs   (o: npm run vault:cron)
 */
import { createRequire } from 'node:module';

process.loadEnvFile('.secretos/.env');
const require = createRequire(import.meta.url);
const { Client } = require('pg');

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DB_PASSWORD, SYNC_FUNCTIONS_SECRET } = process.env;
if (!SYNC_FUNCTIONS_SECRET) {
  console.error('Falta SYNC_FUNCTIONS_SECRET en .secretos/.env');
  process.exit(1);
}

const ref = new URL(NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const NOMBRE_SECRETO = 'sync_functions_secret';

const client = new Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(SUPABASE_DB_PASSWORD)}@db.${ref}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  const { rows } = await client.query('select id from vault.secrets where name = $1', [NOMBRE_SECRETO]);

  if (rows.length) {
    await client.query('select vault.update_secret($1, $2)', [rows[0].id, SYNC_FUNCTIONS_SECRET]);
    console.log(`✅ Secreto '${NOMBRE_SECRETO}' actualizado en Vault.`);
  } else {
    await client.query('select vault.create_secret($1, $2)', [SYNC_FUNCTIONS_SECRET, NOMBRE_SECRETO]);
    console.log(`✅ Secreto '${NOMBRE_SECRETO}' creado en Vault.`);
  }
} catch (e) {
  console.error('❌', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
