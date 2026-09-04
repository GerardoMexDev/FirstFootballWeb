/**
 * Consulta de solo lectura contra GET /leagues (api-sports.io) — no escribe nada en Supabase.
 * Junta los IDs candidatos para la cartera de Fase 1 (países + búsquedas de continentales),
 * con la cobertura de la temporada más reciente. Se usó para armar `scripts/seed-competencias.mjs`
 * (Sesión 2) y sirve para volver a revisar más adelante si cambia la cobertura o la temporada.
 *
 * Uso: node scripts/consultar-ligas.mjs   (o: npm run consultar:ligas)
 */
process.loadEnvFile('.secretos/.env');
const KEY = process.env.API_FOOTBALL_KEY;
const BASE = 'https://v3.football.api-sports.io';

async function get(path, params) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${BASE}${path}?${qs}`, { headers: { 'x-apisports-key': KEY } });
  const j = await r.json();
  if (j.errors && Object.keys(j.errors).length) {
    console.error(`  ⚠️ errores en ${path}?${qs}:`, j.errors);
  }
  return j.response ?? [];
}

function resumir(liga) {
  const temporadas = liga.seasons ?? [];
  const actual = temporadas.find((s) => s.current) ?? temporadas[temporadas.length - 1];
  const cov = actual?.coverage;
  return {
    id: liga.league.id,
    nombre: liga.league.name,
    tipo: liga.league.type,
    pais: liga.country?.name,
    temporadaActual: actual?.year,
    cobertura_fixtures: cov?.fixtures?.events ?? cov?.fixtures ?? null,
    cobertura_stats_jugador: cov?.players ?? null,
    cobertura_standings: cov?.standings ?? null,
  };
}

const consultas = [
  { titulo: 'Arabia Saudita', params: { country: 'Saudi-Arabia' } },
  { titulo: 'México', params: { country: 'Mexico' } },
  { titulo: 'Brasil', params: { country: 'Brazil' } },
  { titulo: 'Chile', params: { country: 'Chile' } },
  { titulo: 'Bélgica', params: { country: 'Belgium' } },
  { titulo: 'Búsqueda: Libertadores', params: { search: 'Libertadores' } },
  { titulo: 'Búsqueda: Sudamericana', params: { search: 'Sudamericana' } },
  { titulo: 'Búsqueda: Europa League', params: { search: 'Europa League' } },
  { titulo: 'Búsqueda: AFC Champions', params: { search: 'AFC Champions' } },
  { titulo: 'Búsqueda: World Cup - Qualification South America', params: { search: 'World Cup - Qualification South America' } },
];

for (const { titulo, params } of consultas) {
  const ligas = await get('/leagues', params);
  console.log(`\n=== ${titulo} (${ligas.length} resultado/s) ===`);
  ligas.map(resumir).forEach((l) => console.log(l));
  await new Promise((r) => setTimeout(r, 250)); // no golpear el rate limit del free
}
