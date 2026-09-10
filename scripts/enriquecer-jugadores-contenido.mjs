/**
 * Completa posición / nacionalidad / foto_url de los 7 jugadores nuevos del servicio
 * "Contenido" desde API-Football (plan free). Solo lectura contra la API; UPDATE solo de
 * esos 3 campos y solo si la API los devuelve. Lo que no resuelva queda null → "Sin datos".
 *
 * Uso: npm run enriquecer:jugadores-contenido   (correr después de seed:jugadores-contenido)
 *
 * Football First (Fase 1). Creado 2026-09-10 (Sesión 7).
 */
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.secretos/.env');
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_FOOTBALL_KEY } = process.env;
if (!SUPABASE_SERVICE_ROLE_KEY || !API_FOOTBALL_KEY) {
  console.error('Faltan SUPABASE_SERVICE_ROLE_KEY o API_FOOTBALL_KEY en .secretos/.env');
  process.exit(1);
}
const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Los mismos 7 ids que cargó seed-jugadores-contenido.mjs (proveedor api-football).
const IDS = ['16482', '50077', '844', '197520', '2967', '52058', '51542'];

async function perfil(playerId) {
  const r = await fetch(`https://v3.football.api-sports.io/players/profiles?player=${playerId}`, {
    headers: { 'x-apisports-key': API_FOOTBALL_KEY },
  });
  const j = await r.json();
  if (j?.errors && Object.keys(j.errors).length) console.error(`  ⚠️ errores API:`, j.errors);
  const p = j?.response?.[0]?.player;
  if (!p) return null;
  return {
    posicion: p.position ?? null,
    nacionalidad: p.nationality ?? null,
    foto_url: p.photo ?? null,
  };
}

for (const id_externo of IDS) {
  if (id_externo === 'REEMPLAZAR' || id_externo.startsWith('manual:')) {
    console.log(`· ${id_externo} — se saltea (sin id de API-Football)`);
    continue;
  }
  const datos = await perfil(id_externo);
  if (!datos) {
    console.log(`⚠ ${id_externo} — la API no devolvió perfil; queda "Sin datos"`);
    continue;
  }
  const campos = Object.fromEntries(Object.entries(datos).filter(([, v]) => v != null));
  if (!Object.keys(campos).length) {
    console.log(`· ${id_externo} — sin campos nuevos`);
    continue;
  }
  const { data, error } = await admin
    .from('jugadores')
    .update(campos)
    .eq('proveedor_externo', 'api-football')
    .eq('id_externo', id_externo)
    .select('nombre')
    .maybeSingle();
  if (error) throw error;
  console.log(`= ${data?.nombre ?? id_externo}: ${Object.keys(campos).join(', ')}`);
  await new Promise((r) => setTimeout(r, 2000)); // pace API-Football
}

console.log('\n✅ Enriquecimiento terminado.');
