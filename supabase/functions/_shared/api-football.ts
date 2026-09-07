/**
 * Cliente mínimo de API-Football (api-sports.io) para las Edge Functions de sync.
 * Solo `fetch` — nada de Node. Se comparte entre `sync-partidos` y (más adelante)
 * `sync-estadisticas`, por eso vive en `_shared` y no adentro de una sola función.
 *
 * Nota de plan (confirmado Sesión 2, ver avances.md §10): el plan FREE no da acceso a
 * `season` reciente ni a los parámetros `next`/`last` por equipo. La única vía que sí
 * funciona es `GET /fixtures?date=YYYY-MM-DD` — trae TODOS los fixtures del mundo para
 * ese día, así que el filtro por los clubes de la cartera se hace del lado nuestro
 * (ver `sync-partidos/index.ts`). También hay un límite de 10 peticiones/minuto: por
 * eso `obtenerFixturesDeVariosDias` espacia las llamadas.
 *
 * El plan FREE además solo deja consultar una ventana corta de días alrededor de "hoy"
 * (~3 días; el mensaje de error del plan la indica exacta). El reloj real de la Edge
 * Function (infraestructura de Supabase) puede ir uno o más días desviado del reloj de
 * quien la prueba desde otra máquina — por eso, en vez de adivinar cuántos días hay
 * disponibles, `obtenerFixturesDeVariosDias` sigue pidiendo día por día y, si un día puntual
 * viene rechazado por el plan, lo salta (no aborta el resto) y lo reporta en `diasOmitidos`.
 */
const BASE = 'https://v3.football.api-sports.io';
const ESPERA_ENTRE_LLAMADAS_MS = 6500; // 10 req/min del plan free -> 1 cada ~6s, con margen

export interface FixtureApiFootball {
  fixture: {
    id: number;
    date: string; // ISO con offset — instante ya resuelto, sin que haga falta convertir zona
    status: { short: string };
    venue: { id: number | null; name: string | null; city: string | null };
  };
  league: { id: number; round: string | null };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
}

/** Devuelve null (no lanza) cuando el rechazo es específicamente una restricción del plan
 *  ("Free plans do not have access to..."): ese día se salta, no aborta el resto de la
 *  ventana. Cualquier otro error (red, HTTP, rate limit) sí se propaga. */
async function obtenerFixturesDelDia(apiKey: string, fechaISO: string): Promise<FixtureApiFootball[] | null> {
  const r = await fetch(`${BASE}/fixtures?date=${fechaISO}`, {
    headers: { 'x-apisports-key': apiKey },
  });
  if (!r.ok) throw new Error(`API-Football respondió HTTP ${r.status} para ${fechaISO}`);
  const j = await r.json();
  if (j.errors && Object.keys(j.errors).length) {
    const mensaje = JSON.stringify(j.errors);
    if (mensaje.toLowerCase().includes('free plans do not have access')) return null;
    throw new Error(`API-Football (${fechaISO}): ${mensaje}`);
  }
  return j.response ?? [];
}

export interface ResultadoFixturesVariosDias {
  fixtures: FixtureApiFootball[];
  diasOmitidos: string[]; // fechas que el plan rechazó — informativo, no es un error
}

/** Trae los fixtures de hoy + `diasAdelante` días siguientes, uno por uno (ver nota de plan). */
export async function obtenerFixturesDeVariosDias(
  apiKey: string,
  diasAdelante: number,
): Promise<ResultadoFixturesVariosDias> {
  const fixtures: FixtureApiFootball[] = [];
  const diasOmitidos: string[] = [];
  for (let i = 0; i <= diasAdelante; i++) {
    const fecha = new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10);
    const delDia = await obtenerFixturesDelDia(apiKey, fecha);
    if (delDia === null) diasOmitidos.push(fecha);
    else fixtures.push(...delDia);
    if (i < diasAdelante) {
      await new Promise((resolve) => setTimeout(resolve, ESPERA_ENTRE_LLAMADAS_MS));
    }
  }
  return { fixtures, diasOmitidos };
}

/** Espaciador para respetar el límite de 10 req/min del plan free. Lo usan los sync que iteran. */
export function esperarEntreLlamadas(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ESPERA_ENTRE_LLAMADAS_MS));
}

/** GET genérico que devuelve `response` o lanza si la API reporta `errors`. */
async function getResponse(apiKey: string, ruta: string): Promise<unknown[]> {
  const r = await fetch(`${BASE}${ruta}`, { headers: { 'x-apisports-key': apiKey } });
  if (!r.ok) throw new Error(`API-Football HTTP ${r.status} en ${ruta}`);
  const j = await r.json();
  if (j.errors && Object.keys(j.errors).length) {
    throw new Error(`API-Football (${ruta}): ${JSON.stringify(j.errors)}`);
  }
  return j.response ?? [];
}

/** Club identificado por su id de API-Football (string, como se guarda en `clubes.id_externo`). */
export interface ClubExterno {
  idExterno: string;
  nombre: string;
}

/** Un movimiento de `GET /transfers`, normalizado para `_shared/roster.ts`. */
export interface TraspasoExterno {
  fecha: string;
  tipo: string;
  desde: ClubExterno | null;
  hasta: ClubExterno | null;
}

// deno-lint-ignore no-explicit-any
function aClubExterno(equipo: any): ClubExterno | null {
  return equipo?.id ? { idExterno: String(equipo.id), nombre: String(equipo.name ?? '') } : null;
}

/**
 * Traspaso más reciente del jugador según `GET /transfers?player=` — funciona en el plan
 * free (verificado). El array `transfers` viene del más nuevo al más viejo.
 * @returns el último movimiento, o null si no hay historial.
 */
export async function obtenerUltimoTraspaso(apiKey: string, jugadorIdExterno: string): Promise<TraspasoExterno | null> {
  const response = await getResponse(apiKey, `/transfers?player=${jugadorIdExterno}`);
  // deno-lint-ignore no-explicit-any
  const movimientos = (response[0] as any)?.transfers ?? [];
  const ultimo = movimientos[0];
  if (!ultimo) return null;
  return {
    fecha: String(ultimo.date ?? ''),
    tipo: String(ultimo.type ?? ''),
    desde: aClubExterno(ultimo.teams?.out),
    hasta: aClubExterno(ultimo.teams?.in),
  };
}

/** Estado + marcador de un fixture concreto por su id — `GET /fixtures?id=` (anda en free). */
export interface EstadoFixture {
  estadoCorto: string; // FT, NS, PST, CANC, 1H, ...
  marcadorLocal: number | null;
  marcadorVisitante: number | null;
}

/** Re-consulta un fixture puntual. `null` si la API no lo devuelve. */
export async function obtenerFixturePorId(apiKey: string, fixtureId: string): Promise<EstadoFixture | null> {
  const response = await getResponse(apiKey, `/fixtures?id=${fixtureId}`);
  // deno-lint-ignore no-explicit-any
  const fx = response[0] as any;
  if (!fx?.fixture) return null;
  return {
    estadoCorto: String(fx.fixture.status?.short ?? ''),
    marcadorLocal: fx.goals?.home ?? null,
    marcadorVisitante: fx.goals?.away ?? null,
  };
}

/** Datos de una sede — `GET /venues?id=` (endpoint de referencia, anda en free). */
export interface SedeExterna {
  nombre: string | null;
  ciudad: string | null;
  /** País en INGLÉS, como lo devuelve API-Football ("Brazil", "Saudi Arabia", "USA", …). */
  pais: string | null;
}

/**
 * Consulta una sede puntual por su id de API-Football. Se usa como último recurso para
 * deducir la zona horaria de la sede en copas continentales (donde el país de la
 * competencia es un continente) y, de paso, para rellenar estadio/ciudad cuando el fixture
 * no los trae. `null` si la API no devuelve nada.
 */
export async function obtenerSede(apiKey: string, venueId: number): Promise<SedeExterna | null> {
  const response = await getResponse(apiKey, `/venues?id=${venueId}`);
  // deno-lint-ignore no-explicit-any
  const v = response[0] as any;
  if (!v) return null;
  return {
    nombre: v.name ?? null,
    ciudad: v.city ?? null,
    pais: v.country ?? null,
  };
}

/**
 * Planilla de estadísticas por jugador de un fixture — `GET /fixtures/players?fixture=`
 * (anda en free, verificado). Devuelve el array `response` crudo (una entrada por equipo);
 * `extraerLineaJugador` de `_shared/estadisticas.ts` saca de ahí la línea de un jugador.
 */
export async function obtenerJugadoresDeFixture(apiKey: string, fixtureId: string): Promise<unknown[]> {
  return await getResponse(apiKey, `/fixtures/players?fixture=${fixtureId}`);
}
