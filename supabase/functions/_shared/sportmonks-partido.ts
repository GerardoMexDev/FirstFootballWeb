/**
 * Lógica pura para normalizar un fixture de SportMonks v3 a la forma que necesita
 * `sync-partidos-sportmonks`. No hace fetch ni conoce Supabase — se testea con `node --test`
 * (sportmonks-partido.test.ts), mismo criterio que `_shared/espn-partido.ts`.
 *
 * A diferencia de ESPN (que arma el rival parseando `"{visitante} at {local}"`), SportMonks
 * da nombre y lado (`participants[].meta.location`) de los dos equipos directo — no hace
 * falta parsear texto.
 *
 * Football First (Fase 1). Creado 2026-09-16 (migración a SportMonks).
 */
import type { EstadoPartido } from './estado-partido.ts';
import type { EstadisticaJugador } from './estadisticas.ts';
import type { EventoSportmonks, FixtureSportmonks, LineupSportmonks } from './sportmonks.ts';

export interface PartidoSportmonks {
  fixtureId: string;
  inicioUtc: string | null;
  /** Lado de NUESTRO club en el partido. El rival va del otro lado. */
  nuestroLado: 'local' | 'visitante';
  rivalId: string;
  rivalNombre: string | null;
  rivalEscudoUrl: string | null;
  sedeNombre: string | null;
  sedeCiudad: string | null;
  estado: EstadoPartido;
}

/**
 * Normaliza un fixture. `nuestroTeamId` es el id de equipo de SportMonks de nuestro club de
 * la cartera (ver el mapa `CLUBES_SPORTMONKS` en `sync-partidos-sportmonks`). Lanza si nuestro
 * club no está entre los participantes (no debería pasar: el fixture vino de su propio calendario).
 */
export function normalizarFixture(fixture: FixtureSportmonks, nuestroTeamId: string): PartidoSportmonks {
  const participantes = fixture.participants ?? [];
  const nuestroIdNum = Number(nuestroTeamId);
  const nuestro = participantes.find((p) => p.id === nuestroIdNum);
  if (!nuestro) {
    throw new Error(`Nuestro equipo ${nuestroTeamId} no aparece en el fixture ${fixture.id}`);
  }
  const rival = participantes.find((p) => p.id !== nuestroIdNum);
  if (!rival) throw new Error(`Fixture ${fixture.id} sin rival (¿un solo participante?)`);

  const nuestroLado: 'local' | 'visitante' = nuestro.meta?.location === 'home' ? 'local' : 'visitante';

  return {
    fixtureId: String(fixture.id),
    // `starting_at_timestamp` (unix seconds UTC) en vez de `starting_at` (string sin 'Z',
    // ambiguo si algo lo llegara a parsear como hora local) — verificado en vivo que coinciden.
    inicioUtc: fixture.starting_at_timestamp ? new Date(fixture.starting_at_timestamp * 1000).toISOString() : null,
    nuestroLado,
    rivalId: String(rival.id),
    rivalNombre: rival.name || null,
    rivalEscudoUrl: rival.image_path || null,
    sedeNombre: fixture.venue?.name ?? null,
    sedeCiudad: fixture.venue?.city_name ?? null,
    estado: mapearEstadoSportmonks(fixture.state?.state),
  };
}

/**
 * Traduce el campo `state.state` de un fixture de SportMonks (referencia completa: `GET
 * /states`, consultada en vivo 2026-09-16) al enum `estado_partido` de la base. Mismo criterio
 * que `_shared/estado-partido.ts` y `mapearEstadoEspn`: lo no contemplado (cancelado, walkover,
 * "awaiting updates", etc.) nunca se inventa — cae en 'sin_datos'.
 */
const PROGRAMADO = new Set(['NS', 'TBA', 'DELAYED']);
const EN_JUEGO = new Set([
  'INPLAY_1ST_HALF', 'HT', 'BREAK', 'INPLAY_ET', 'INPLAY_PENALTIES',
  'EXTRA_TIME_BREAK', 'INPLAY_2ND_HALF', 'INPLAY_ET_2ND_HALF', 'PEN_BREAK',
]);
const FINALIZADO = new Set(['FT', 'AET', 'FT_PEN']);
const SUSPENDIDO = new Set(['POSTPONED', 'SUSPENDED', 'INTERRUPTED', 'ABANDONED']);

export function mapearEstadoSportmonks(estado: string | null | undefined): EstadoPartido {
  if (!estado) return 'sin_datos';
  if (PROGRAMADO.has(estado)) return 'programado';
  if (EN_JUEGO.has(estado)) return 'en_juego';
  if (FINALIZADO.has(estado)) return 'finalizado';
  if (SUSPENDIDO.has(estado)) return 'suspendido';
  return 'sin_datos'; // CANCELLED/WO/AWARDED/AWAITING_UPDATES/DELETED/PENDING u otro no contemplado
}

/**
 * Convocatoria de un jugador puntual a partir de `lineups` (titulares + suplentes juntos).
 * `null` = todavía no se publicó (SportMonks la publica ~1h antes del partido) — nunca se
 * inventa un `false` prematuro. Una vez publicada, la ausencia del jugador SÍ es un `false`
 * real (no convocado), sea el fixture programado, en juego o finalizado.
 */
export function convocadoEnLineups(lineups: LineupSportmonks[] | null | undefined, jugadorSportmonksId: string): boolean | null {
  const filas = lineups ?? [];
  if (filas.length === 0) return null;
  const idBuscado = Number(jugadorSportmonksId);
  return filas.some((l) => l.player_id === idBuscado);
}

const GOAL = 14;
const YELLOWCARD = 19;
const REDCARD = 20;
const SEGUNDA_AMARILLA = 21; // "Yellow/Red card" — 2ª amarilla que termina en expulsión

function valorDetalle(details: LineupSportmonks['details'], typeId: number): number | null {
  const fila = (details ?? []).find((d) => d.type_id === typeId);
  if (!fila) return null;
  const n = Number(fila.data?.value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Línea de estadísticas de UN jugador en UN fixture, a partir de su fila de `lineups`
 * (minutos/rating vienen de `details`) y de los `events` del partido completo (goles/
 * asistencias/tarjetas son eventos discretos, no aparecen en `details`). Mismo contrato que
 * `extraerLineaJugador` de `_shared/estadisticas.ts` (API-Football): si el jugador no jugó
 * minutos (suplente no usado), devuelve `null` — no se crea fila de estadística, para no
 * contar un partido que no jugó en `totales_jugador`/`temporada_actual`.
 *
 * Asistencia: en un evento de gol (`type_id` 14), `related_player_id` es quien asistió
 * (verificado en vivo 2026-09-16 contra un gol real de Toluca). Roja: cuenta `REDCARD` (roja
 * directa) Y `SEGUNDA_AMARILLA` (expulsado por doble amarilla) — la amarilla que la origina
 * ya se cuenta aparte como evento `YELLOWCARD` normal, así que no se duplica.
 */
export function extraerEstadisticaSportmonks(
  lineup: LineupSportmonks,
  eventos: EventoSportmonks[] | null | undefined,
  jugadorSportmonksId: string,
): EstadisticaJugador | null {
  const minutos = valorDetalle(lineup.details, 119);
  const jugo = minutos !== null && minutos > 0;
  if (!jugo) return null;

  const idBuscado = Number(jugadorSportmonksId);
  const propios = eventos ?? [];
  const deGol = propios.filter((e) => e.type_id === GOAL);

  return {
    minutos,
    goles: deGol.filter((e) => e.player_id === idBuscado).length,
    asistencias: deGol.filter((e) => e.related_player_id === idBuscado).length,
    amarillas: propios.filter((e) => e.type_id === YELLOWCARD && e.player_id === idBuscado).length,
    rojas: propios.filter((e) => (e.type_id === REDCARD || e.type_id === SEGUNDA_AMARILLA) && e.player_id === idBuscado).length,
    titular: lineup.type_id === 11 ? true : lineup.type_id === 12 ? false : null,
    valoracion: valorDetalle(lineup.details, 118),
  };
}
