/**
 * Cliente mínimo de SportMonks v3 (api.sportmonks.com/v3/football) para `sync-partidos-sportmonks`.
 * Solo `fetch` — nada de Node. Fino a propósito: la lógica testeable vive en
 * `_shared/sportmonks-partido.ts` (mismo criterio que `_shared/api-football.ts` / `espn-api.ts`).
 *
 * Cubre SOLO las 5 ligas domésticas del plan Starter (avances.md, sección "Evaluación
 * SportMonks"): Arabia, Liga MX, Brasileirão, Chile, Bélgica. Copas/continentales siguen con
 * API-Football/ESPN — no se piden acá.
 *
 * Un solo endpoint (`/fixtures/between/{desde}/{hasta}/{teamId}`) con `include=lineups.player;
 * participants;state;venue` trae en una sola llamada todo lo que antes salía de varias
 * (verificado en vivo 2026-09-16, ver planeacion/avances.md): equipos, estado, sede Y la
 * convocatoria (alineación titular + suplentes) — el gap que ESPN/API-Football free nunca
 * cerraron. Paginado a 25 filas fijas (el plan ignora `per_page` más alto); se sigue
 * `pagination.next_page` hasta agotar o topar el límite de seguridad.
 */
const BASE = 'https://api.sportmonks.com/v3/football';
const ESPERA_ENTRE_LLAMADAS_MS = 300; // cortesía entre clubes; el plan da ~2000 req/hora, no hace falta más

export function esperarEntreLlamadasSportmonks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ESPERA_ENTRE_LLAMADAS_MS));
}

export interface ParticipanteSportmonks {
  id: number;
  name: string;
  meta?: { location?: 'home' | 'away' } | null;
}

export interface LineupSportmonks {
  player_id: number;
  team_id: number;
  type_id: number; // 11 = titular, 12 = suplente (verificado en vivo, sin doc pública clara)
  player?: { display_name?: string | null } | null;
}

export interface FixtureSportmonks {
  id: number;
  league_id: number;
  starting_at_timestamp: number; // unix seconds UTC — más confiable que `starting_at` (sin 'Z')
  state?: { state?: string | null } | null;
  participants?: ParticipanteSportmonks[] | null;
  venue?: { name?: string | null; city_name?: string | null } | null;
  lineups?: LineupSportmonks[] | null;
}

interface RespuestaFixtures {
  data: FixtureSportmonks[];
  pagination?: { has_more?: boolean; next_page?: string | null };
}

async function pedir(url: URL): Promise<RespuestaFixtures> {
  const r = await fetch(url);
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) {
    const detalle = (j as { message?: string } | null)?.message ?? `HTTP ${r.status}`;
    throw new Error(`SportMonks: ${detalle} — ${url.pathname}`);
  }
  return j as RespuestaFixtures;
}

/**
 * Todos los fixtures de un equipo entre dos fechas (`YYYY-MM-DD`), siguiendo la paginación
 * hasta agotarla. Tope de seguridad de 20 páginas (~500 fixtures) — mucho más que cualquier
 * temporada real, mismo criterio que `listarEventosDeTemporada` de ESPN.
 */
export async function obtenerFixturesDeEquipo(
  apiKey: string,
  teamId: string,
  desdeIso: string,
  hastaIso: string,
): Promise<FixtureSportmonks[]> {
  const fixtures: FixtureSportmonks[] = [];
  let url: URL | null = new URL(`${BASE}/fixtures/between/${desdeIso}/${hastaIso}/${teamId}`);
  url.searchParams.set('include', 'lineups.player;participants;state;venue');

  for (let i = 0; i < 20 && url; i++) {
    url.searchParams.set('api_token', apiKey);
    const j = await pedir(url);
    fixtures.push(...(j.data ?? []));
    const siguiente = j.pagination?.next_page;
    url = j.pagination?.has_more && siguiente ? new URL(siguiente) : null;
  }
  return fixtures;
}
