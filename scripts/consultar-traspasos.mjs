/**
 * SPIKE de solo lectura — no escribe nada. Verifica si el plan FREE de API-Football deja
 * consultar los endpoints que necesita la detección de cambio de club:
 *   - GET /transfers?player={id}        (historial de traspasos: origen, destino, tipo, fecha)
 *   - GET /players/profiles?player={id} (perfil con el club actual)
 *   - GET /players/squads?player={id}   (en qué plantel figura hoy — fallback)
 *
 * El plan free ya nos bloqueó `season` reciente y `next`/`last` en /fixtures (ver
 * _shared/api-football.ts). Este script confirma qué responde para transfers/profiles
 * ANTES de diseñar el sync de cambio de club (Regla 7: no construir sobre una API sin
 * confirmar que responde).
 *
 * Uso: node scripts/consultar-traspasos.mjs
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
process.loadEnvFile('.secretos/.env');
const KEY = process.env.API_FOOTBALL_KEY;
const BASE = 'https://v3.football.api-sports.io';

if (!KEY) {
  console.error('Falta API_FOOTBALL_KEY en .secretos/.env');
  process.exit(1);
}

/** GET crudo: devuelve { ok, errors, results, response } sin lanzar, para poder inspeccionar. */
async function get(path, params) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${BASE}${path}?${qs}`, { headers: { 'x-apisports-key': KEY } });
  const j = await r.json().catch(() => ({}));
  return {
    http: r.status,
    errors: j.errors && Object.keys(j.errors).length ? j.errors : null,
    results: j.results ?? 0,
    response: j.response ?? [],
  };
}

// Nahitan Nández (id_externo API-Football = 2614) y Kevin Amaro (377326): uno con selección
// larga y traspasos internacionales, otro joven con menos historial.
const JUGADORES = [
  { nombre: 'Nahitan Nández', id: '2614' },
  { nombre: 'Kevin Amaro', id: '377326' },
];

const ENDPOINTS = [
  { path: '/transfers', clave: 'player' },
  { path: '/players/profiles', clave: 'player' },
  { path: '/players/squads', clave: 'player' },
];

for (const j of JUGADORES) {
  console.log(`\n══════════ ${j.nombre} (player=${j.id}) ══════════`);
  for (const ep of ENDPOINTS) {
    const res = await get(ep.path, { [ep.clave]: j.id });
    const veredicto = res.errors
      ? `❌ BLOQUEADO / error → ${JSON.stringify(res.errors)}`
      : `✅ OK · ${res.results} resultado(s)`;
    console.log(`\n  ${ep.path}?${ep.clave}=${j.id}  [HTTP ${res.http}]  ${veredicto}`);

    if (!res.errors && res.response.length) {
      // Muestra un recorte útil según el endpoint, sin volcar todo el JSON.
      if (ep.path === '/transfers') {
        const bloque = res.response[0];
        const movs = (bloque.transfers ?? []).slice(0, 5).map((t) => ({
          fecha: t.date,
          tipo: t.type,
          de: t.teams?.out?.name,
          a: t.teams?.in?.name,
        }));
        console.log('   últimos movimientos:', JSON.stringify(movs, null, 2));
      } else if (ep.path === '/players/profiles') {
        const p = res.response[0]?.player ?? res.response[0];
        console.log('   perfil:', JSON.stringify({
          nombre: p?.name,
          nacimiento: p?.birth?.date,
          equipo_actual: p?.team?.name ?? p?.team,
        }, null, 2));
      } else {
        const p = res.response[0];
        console.log('   figura en:', JSON.stringify(
          (p?.teams ?? [{ team: p?.team }]).map((x) => x.team?.name ?? x.team),
        ));
      }
    }
    await new Promise((r) => setTimeout(r, 6500)); // 10 req/min del plan free
  }
}

console.log('\n\nListo. Si /transfers y/o /players/profiles salieron ✅, API-Football sirve para el cambio de club.');
console.log('Si salieron ❌, la fuente será Transfermarkt (/players/{id}/profile + /transfers).');
