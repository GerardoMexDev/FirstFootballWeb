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
import type { FixtureSportmonks, LineupSportmonks } from './sportmonks.ts';

export interface PartidoSportmonks {
  fixtureId: string;
  inicioUtc: string | null;
  /** Lado de NUESTRO club en el partido. El rival va del otro lado. */
  nuestroLado: 'local' | 'visitante';
  rivalId: string;
  rivalNombre: string | null;
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
