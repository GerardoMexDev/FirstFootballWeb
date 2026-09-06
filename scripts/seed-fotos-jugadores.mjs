/**
 * Cablea las fotos procesadas de `public/jugadores/` a la base:
 *   jugadores.foto_url = '/jugadores/<slug>.webp'
 *
 * Los .webp (600x800, uno por representado) los procesa a mano quien arma la sesión
 * (ver public/jugadores/LEEME.md). Este script solo guarda la RUTA pública en la fila
 * del jugador — la grilla de la vista `jugadores` la lee para el fondo de la tarjeta
 * (`.jug__foto`), con fallback a `.jug__fb` si el jugador no tiene foto.
 *
 * `foto_url` es una ruta relativa servida por Next desde /public — no es Storage
 * todavía (Fase 2). Cuando haya Storage, este mismo campo pasa a guardar la URL firmada.
 *
 * Idempotente: matchea por (proveedor_externo, id_externo) y siempre hace UPDATE.
 *
 * Uso: node scripts/seed-fotos-jugadores.mjs   (o: npm run seed:fotos)
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.secretos/.env');
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .secretos/.env');
  process.exit(1);
}

const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PROVEEDOR = 'api-football';

// id_externo = ID de API-Football (el que cargó seed-clubes-jugadores.mjs).
// slug = apellido sin tildes; el archivo vive en public/jugadores/<slug>.webp.
const FOTOS = [
  { ref: 'Nahitan Nández', id_externo: '2614', slug: 'nandez' },
  { ref: 'Federico Pereira', id_externo: '67884', slug: 'pereira' },
  { ref: 'Ignacio Sosa', id_externo: '310307', slug: 'sosa' },
  { ref: 'Javier Méndez', id_externo: '6122', slug: 'mendez' },
  { ref: 'Kevin Amaro', id_externo: '377326', slug: 'amaro' },
  { ref: 'Martín Fernández', id_externo: '51549', slug: 'fernandez' },
];

for (const f of FOTOS) {
  const ruta = `/jugadores/${f.slug}.webp`;
  const { data: fila, error: errBuscar } = await admin
    .from('jugadores')
    .select('id, foto_url')
    .eq('proveedor_externo', PROVEEDOR)
    .eq('id_externo', f.id_externo)
    .maybeSingle();
  if (errBuscar) throw errBuscar;
  if (!fila) {
    console.error(`❌ ${f.ref}: no existe en jugadores con id_externo ${f.id_externo}`);
    process.exitCode = 1;
    continue;
  }
  const { error: errUpdate } = await admin.from('jugadores').update({ foto_url: ruta }).eq('id', fila.id);
  if (errUpdate) throw errUpdate;
  console.log(`${fila.foto_url === ruta ? '·' : '='} ${f.ref.padEnd(18)} foto_url = ${ruta}`);
}

console.log(`\n✅ ${FOTOS.length} rutas de foto cargadas.`);
