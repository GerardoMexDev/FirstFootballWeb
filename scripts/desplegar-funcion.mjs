/**
 * Despliega una Edge Function a Supabase con el CLI (sin Docker), usando SUPABASE_ACCESS_TOKEN
 * de .secretos/.env. Todas las funciones de sync se deployan con --no-verify-jwt porque quien
 * las llama es pg_cron (o un curl con el header x-sync-secret), no un usuario con sesión.
 *
 * Uso:  node scripts/desplegar-funcion.mjs sync-roster
 *       (o: npm run deploy:funcion -- sync-roster)
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.loadEnvFile('.secretos/.env');

const nombre = process.argv[2];
if (!nombre) {
  console.error('Falta el nombre de la función. Ej: node scripts/desplegar-funcion.mjs sync-roster');
  process.exit(1);
}

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ACCESS_TOKEN } = process.env;
if (!SUPABASE_ACCESS_TOKEN) {
  console.error('Falta SUPABASE_ACCESS_TOKEN en .secretos/.env');
  process.exit(1);
}
const ref = new URL(NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

const bin = fileURLToPath(
  new URL(`../node_modules/.bin/supabase${process.platform === 'win32' ? '.cmd' : ''}`, import.meta.url),
);

const r = spawnSync(
  bin,
  ['functions', 'deploy', nombre, '--project-ref', ref, '--no-verify-jwt'],
  { env: { ...process.env, SUPABASE_ACCESS_TOKEN }, encoding: 'utf8', stdio: 'inherit', shell: process.platform === 'win32' },
);

process.exit(r.status ?? 1);
