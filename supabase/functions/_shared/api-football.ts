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
    venue: { name: string | null; city: string | null };
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
