/**
 * Genera lib/supabase/tipos-db.ts a partir del esquema del proyecto Supabase.
 * Usa el CLI de Supabase con SUPABASE_ACCESS_TOKEN (de .secretos/.env), sin Docker.
 *
 * Uso:  npm run tipos:db      (o: node scripts/generar-tipos.mjs)
 * Correr tras cada migración.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.loadEnvFile('.secretos/.env');

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ACCESS_TOKEN } = process.env;
if (!SUPABASE_ACCESS_TOKEN) {
  console.error('Falta SUPABASE_ACCESS_TOKEN en .secretos/.env (dashboard/account/tokens).');
  process.exit(1);
}

const ref = new URL(NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const salida = 'lib/supabase/tipos-db.ts';

// Binario local del CLI de Supabase. En Windows es un .cmd, que Node solo ejecuta con
// shell:true; los argumentos son literales fijos (sin entrada de usuario), así que es seguro.
const bin = fileURLToPath(
  new URL(
    `../node_modules/.bin/supabase${process.platform === 'win32' ? '.cmd' : ''}`,
    import.meta.url,
  ),
);
const r = spawnSync(
  bin,
  ['gen', 'types', 'typescript', '--project-id', ref, '--schema', 'public'],
  {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  },
);

if (r.status !== 0 || !r.stdout || !r.stdout.includes('export type Database')) {
  console.error('❌ supabase gen types falló:');
  console.error(r.stderr || r.stdout || r.error?.message);
  process.exit(1);
}

writeFileSync(salida, r.stdout);
console.log(`✅ ${salida} generado (${r.stdout.length} bytes).`);
