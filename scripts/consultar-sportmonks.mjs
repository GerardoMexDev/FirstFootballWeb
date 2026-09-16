/**
 * Consulta de solo lectura contra SportMonks v3 (api.sportmonks.com) — no escribe nada en
 * Supabase. Confirma que el plan Starter (5 ligas: Arabia, Liga MX, Brasileirão, Chile,
 * Bélgica) trae completos a los 6 representados de Match Day (roster real en prod, ver
 * avances.md): Nández/Al-Qadisiyah, Pereira/Toluca, Fernández/Atlante, Sosa/RB Bragantino,
 * Méndez/Colo-Colo, Amaro/Genk. Antes de tocar `sync-partidos`/`sync-roster`/`_shared/sportmonks.ts`.
 *
 * Uso: node scripts/consultar-sportmonks.mjs   (o: npm run consultar:sportmonks)
 */
process.loadEnvFile('.secretos/.env');
const TOKEN = process.env.SPORTMONKS_APIKEY;
const BASE = 'https://api.sportmonks.com/v3/football';

if (!TOKEN) {
  console.error('Falta SPORTMONKS_APIKEY en .secretos/.env');
  process.exit(1);
}

async function get(path, params = {}) {
  const qs = new URLSearchParams({ ...params, api_token: TOKEN }).toString();
  const url = `${BASE}${path}?${qs}`;
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error(`  ⚠️ HTTP ${r.status} en ${path}:`, j.message ?? j);
    return null;
  }
  return j;
}

const equipos = [
  // Búsqueda de equipo con el nombre real en SportMonks (verificado con /teams/search) —
  // "Al-Qadisiyah" y "RB Bragantino" (nombres de API-Football/ESPN) no matchean acá.
  { jugador: 'Nahitan Nández', club: 'Al-Qadsiah', pais: 'Arabia Saudita' },
  { jugador: 'Fede Pereira', club: 'Toluca', pais: 'México' },
  { jugador: 'Martín Fernández', club: 'Atlante', pais: 'México' },
  { jugador: 'Nacho Sosa', club: 'Bragantino', pais: 'Brasil' },
  { jugador: 'Javi Méndez', club: 'Colo-Colo', pais: 'Chile' },
  { jugador: 'Kevin Amaro', club: 'Genk', pais: 'Bélgica' },
];

console.log('=== 1) Ligas suscritas en el plan ===');
const ligas = await get('/leagues', { per_page: 50 });
if (ligas?.data) {
  console.log(`Total ligas visibles: ${ligas.data.length}`);
  ligas.data.forEach((l) => console.log(`  - [${l.id}] ${l.name}`));
} else {
  console.log('Sin data (revisar error arriba).');
}

for (const { jugador, club, pais } of equipos) {
  console.log(`\n=== ${club} (${pais}) — buscando para confirmar a ${jugador} ===`);

  const busquedaEquipo = await get(`/teams/search/${encodeURIComponent(club)}`);
  const equipo = busquedaEquipo?.data?.[0];
  if (!equipo) {
    console.log(`  ⚠️ No se encontró el equipo "${club}" por nombre.`);
    continue;
  }
  console.log(`  Equipo encontrado: [${equipo.id}] ${equipo.name} (país id ${equipo.country_id})`);

  const plantilla = await get(`/squads/teams/${equipo.id}`, { include: 'player' });
  const jugadores = plantilla?.data ?? [];
  console.log(`  Tamaño de plantilla devuelta: ${jugadores.length}`);

  // Match por apellido como palabra completa — un `includes` simple confunde apellidos que
  // se contienen entre sí (p. ej. "nández" matchea tanto a "Nández" como a "Fernández").
  const apellidoBuscado = jugador.split(' ').slice(-1)[0].toLowerCase();
  const match = jugadores.find((j) => {
    const nombre = (j.player?.display_name ?? j.player?.name ?? '').toLowerCase();
    return nombre.split(/\s+/).includes(apellidoBuscado);
  });

  if (match) {
    console.log(`  ✅ Encontrado: ${match.player?.display_name ?? match.player?.name}`, {
      id_player: match.player_id,
      posicion_id: match.position_id,
      dorsal: match.jersey_number,
      fecha_nacimiento: match.player?.date_of_birth,
      nacionalidad_id: match.player?.nationality_id,
    });
  } else {
    console.log(`  ❌ NO aparece "${jugador}" en la plantilla devuelta.`);
    console.log(
      '  Nombres devueltos:',
      jugadores.map((j) => j.player?.display_name ?? j.player?.name ?? `id:${j.player_id}`)
    );
  }

  await new Promise((r) => setTimeout(r, 800));
}
