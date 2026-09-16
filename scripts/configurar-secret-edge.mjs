/**
 * Sube (o rota) un secret de Edge Functions en Supabase (`supabase secrets set`), leyendo el
 * VALOR de `.secretos/.env` por nombre — nunca se tipea en la terminal ni queda en este script.
 * Mismo patrón que `desplegar-funcion.mjs` (CLI sin Docker, `SUPABASE_ACCESS_TOKEN` de
 * `.secretos/.env`). Esto es lo que faltó al sumar `SPORTMONKS_APIKEY`: los Edge Functions no
 * leen `.secretos/.env` (eso es solo para scripts locales) — necesitan el secret en Supabase.
 *
 * Uso:  node scripts/configurar-secret-edge.mjs SPORTMONKS_APIKEY
 *       (o: npm run secrets:edge -- SPORTMONKS_APIKEY)
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.loadEnvFile('.secretos/.env');

const nombre = process.argv[2];
if (!nombre) {
  console.error('Falta el nombre del secret. Ej: node scripts/configurar-secret-edge.mjs SPORTMONKS_APIKEY');
  process.exit(1);
}

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ACCESS_TOKEN } = process.env;
if (!SUPABASE_ACCESS_TOKEN) {
  console.error('Falta SUPABASE_ACCESS_TOKEN en .secretos/.env');
  process.exit(1);
}
const valor = process.env[nombre];
if (!valor) {
  console.error(`Falta ${nombre} en .secretos/.env`);
  process.exit(1);
}

const ref = new URL(NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

const bin = fileURLToPath(
  new URL(`../node_modules/.bin/supabase${process.platform === 'win32' ? '.cmd' : ''}`, import.meta.url),
);

const r = spawnSync(
  bin,
  ['secrets', 'set', `${nombre}=${valor}`, '--project-ref', ref],
  { env: { ...process.env, SUPABASE_ACCESS_TOKEN }, encoding: 'utf8', stdio: 'inherit', shell: process.platform === 'win32' },
);

process.exit(r.status ?? 1);
