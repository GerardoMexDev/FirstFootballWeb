/**
 * Consulta de solo lectura contra GET /teams y GET /players/squads (api-sports.io) — no
 * escribe nada en Supabase. Busca los IDs reales de los 6 clubes y sus planteles actuales,
 * para ubicar a cada representado y confirmar antes de cargar `clubes`/`jugadores`.
 *
 * Uso: node scripts/consultar-clubes-jugadores.mjs   (o: npm run consultar:clubes)
 */
process.loadEnvFile('.secretos/.env');
const KEY = process.env.API_FOOTBALL_KEY;
const BASE = 'https://v3.football.api-sports.io';

async function get(path, params) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${BASE}${path}?${qs}`, { headers: { 'x-apisports-key': KEY } });
  const j = await r.json();
  if (j.errors && Object.keys(j.errors).length) console.error(`  ⚠️ errores en ${path}?${qs}:`, j.errors);
  return j.response ?? [];
}

// "Al-Qadsiah" no matchea nada — la API lo tiene transliterado "Qadisiyah". El buscador de
// /teams además rechaza guiones y caracteres no alfanuméricos.
const CLUBES = [
  { buscar: 'Qadisiyah', jugadorApellido: 'Nández' },
  { buscar: 'Toluca', jugadorApellido: 'Pereira' },
  { buscar: 'Atlante', jugadorApellido: 'Fernández' },
  { buscar: 'Bragantino', jugadorApellido: 'Sosa' },
  { buscar: 'Colo Colo', jugadorApellido: 'Méndez' },
  { buscar: 'Genk', jugadorApellido: 'Amaro' },
];

for (const { buscar, jugadorApellido } of CLUBES) {
  const equipos = await get('/teams', { search: buscar });
  console.log(`\n=== "${buscar}" (${equipos.length} equipo/s) ===`);
  equipos.forEach((e) =>
    console.log({
      id: e.team.id,
      nombre: e.team.name,
      pais: e.team.country,
      fundado: e.team.founded,
      venue: e.venue?.name,
    }),
  );
  await new Promise((r) => setTimeout(r, 6500));

  const elegido = equipos[0];
  if (!elegido) continue;
  const plantel = await get('/players/squads', { team: elegido.team.id });
  const jugadores = plantel[0]?.players ?? [];
  const candidatos = jugadores.filter((j) => j.name.toLowerCase().includes(jugadorApellido.toLowerCase()));
  console.log(
    `  Plantel de "${elegido.team.name}" (${jugadores.length} jugadores) — coincidencias con "${jugadorApellido}":`,
  );
  (candidatos.length ? candidatos : jugadores).forEach((j) =>
    console.log(`   - id ${j.id} · ${j.name} · #${j.number ?? '?'} · ${j.position}`),
  );
  await new Promise((r) => setTimeout(r, 6500));
}
