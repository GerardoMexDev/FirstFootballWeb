/**
 * Cliente mínimo del *core* API (no oficial) de ESPN para `sync-fixtures-espn`.
 * Solo `fetch` — nada de Node. Fino a propósito: la lógica que se puede testear vive en
 * `_shared/espn-partido.ts`; esto son solo las llamadas HTTP (mismo criterio que
 * `_shared/api-football.ts`, que tampoco tiene tests).
 *
 * Por qué el *core* API y no `site.api.espn.com/.../schedule`: el `schedule` solo devuelve
 * partidos pasados recientes. El *core* API sí da el calendario completo de la temporada
 * (spike Sesión 4, avances.md §4):
 *   1) `/leagues/<slug>`                                   → temporada vigente (year + fechas)
 *   2) `/leagues/<slug>/seasons/<year>/teams/<id>/events`  → lista de $refs de eventos
 *   3) `/leagues/<slug>/events/<eventId>`                   → detalle (fecha, rival, sede)
 *   4) `<statusRef>`                                        → estado (solo si el partido ya empezó)
 *
 * Sin límite de rate documentado, pero se pacea igual (`esperarEntreLlamadasEspn`) para no
 * abusar de un endpoint no oficial y gratuito.
 */

const BASE = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues';
const PARAMS = 'lang=en&region=us';
const ESPERA_ENTRE_LLAMADAS_MS = 150; // cortesía con un endpoint no oficial; no hay rate limit publicado

/** Pausa entre llamadas. La usa el orquestador cuando itera eventos. */
export function esperarEntreLlamadasEspn(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ESPERA_ENTRE_LLAMADAS_MS));
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  const j = await r.json().catch(() => null);
  // ESPN a veces responde 200 con `{ error: { message, code } }` (p.ej. rango de fechas
  // muy grande). Un cuerpo que no parsea, un HTTP != 2xx o ese `error` tienen que ser
  // ruidosos, nunca un objeto/array vacío que se procese como "sin eventos".
  if (!r.ok || !j || typeof j !== 'object' || 'error' in j) {
    const detalle = (j as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${r.status}`;
    throw new Error(`ESPN: ${detalle} — ${url}`);
  }
  return j as Record<string, unknown>;
}

/**
 * Temporada vigente de una liga: `{ year }` de `/leagues/<slug>`. ESPN ya resuelve solo si
 * la liga es de año calendario (Brasil, Chile) o de temporada partida (Bélgica, Arabia,
 * México ~ago-may) — no hay que adivinar el año.
 */
export async function obtenerTemporadaVigente(slug: string): Promise<number> {
  const j = await getJson(`${BASE}/${slug}?${PARAMS}`);
  const year = (j.season as { year?: number } | undefined)?.year;
  if (!year) throw new Error(`ESPN no devolvió temporada vigente para ${slug}`);
  return year;
}

/**
 * Los `$ref` de eventos de un equipo en una temporada. `rangoFechas` acota a una ventana
 * (`"YYYYMMDD-YYYYMMDD"`, filtro nativo de ESPN) para no traer el calendario entero cada
 * corrida. Pagina de a `limit` (ESPN corta en ~100/página; con la ventana acotada casi
 * siempre viene en una sola página).
 */
export async function listarEventosDeTemporada(
  slug: string,
  year: number,
  espnTeamId: string,
  rangoFechas?: string,
): Promise<string[]> {
  const refs: string[] = [];
  const filtroFechas = rangoFechas ? `&dates=${rangoFechas}` : '';
  let page = 1;
  // Tope de seguridad: 5 páginas (~500 eventos) es mucho más que cualquier temporada real.
  for (let i = 0; i < 5; i++) {
    const j = await getJson(
      `${BASE}/${slug}/seasons/${year}/teams/${espnTeamId}/events?${PARAMS}&limit=100&page=${page}${filtroFechas}`,
    );
    const items = (j.items as Array<{ $ref?: string }> | undefined) ?? [];
    for (const it of items) if (it.$ref) refs.push(it.$ref);
    const pageCount = Number(j.pageCount ?? 1);
    if (page >= pageCount || items.length === 0) break;
    page++;
  }
  return refs;
}

/** Detalle crudo de un evento. Acepta el `$ref` completo o `slug` + `eventId`. */
export async function obtenerEvento(refOSlug: string, eventId?: string): Promise<Record<string, unknown>> {
  const url = eventId
    ? `${BASE}/${refOSlug}/events/${eventId}?${PARAMS}`
    : refOSlug.replace(/^http:/, 'https:');
  return await getJson(url);
}

/** Resuelve el `$ref` de estado de un evento → `{ state, completed, name }` de `type`. */
export async function obtenerEstadoEvento(
  statusRef: string,
): Promise<{ state: string; completed: boolean; name: string } | null> {
  const j = await getJson(statusRef.replace(/^http:/, 'https:'));
  const t = j.type as { state?: string; completed?: boolean; name?: string } | undefined;
  if (!t?.state) return null;
  return { state: t.state, completed: Boolean(t.completed), name: String(t.name ?? '') };
}
