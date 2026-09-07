/**
 * Lógica pura para normalizar un evento del *core* API de ESPN
 * (`sports.core.api.espn.com/v2/sports/soccer/leagues/<slug>/events/<id>`) a la forma que
 * necesita `sync-fixtures-espn` para hacer upsert en `partidos`. No hace fetch ni conoce
 * Supabase — se testea con `node --test` (espn-partido.test.ts) sin levantar Deno.
 *
 * ESPN nombra cada evento como "{visitante} at {local}" (verificado en bel.1 / mex.1 /
 * bra.1 / chi.1 / ksa.1). Nuestro club se identifica por su id de equipo de ESPN dentro de
 * `competitions[0].competitors[]` (NUNCA por el nombre — ESPN lo llama "Racing Genk" y
 * "Red Bull Bragantino", distinto de nuestro seed). El rival sí sale del nombre del evento.
 *
 * Football First (Fase 1). Creado 2026-09-07 (spike ESPN — avances.md §4).
 */
import type { EstadoPartido } from './estado-partido.ts';

/** Subconjunto del JSON de un evento de ESPN que consume `normalizarEvento`. */
export interface EventoEspnCrudo {
  id: string;
  date: string | null;
  name: string;
  competitions: Array<{
    venue?: { fullName?: string | null; address?: { city?: string | null; country?: string | null } | null } | null;
    status?: { $ref?: string | null } | null;
    competitors: Array<{ id: string | number; homeAway: string; team?: unknown }>;
  }>;
}

/** Estado crudo de ESPN — `competitions[0].status.type` tras resolver el `$ref`. */
export interface EstadoEspnCrudo {
  state: string; // 'pre' | 'in' | 'post'
  completed: boolean;
  name: string; // 'STATUS_SCHEDULED' | 'STATUS_FULL_TIME' | 'STATUS_POSTPONED' | ...
}

/** Un partido de ESPN ya normalizado, listo para cruzar con nuestros datos. */
export interface PartidoEspn {
  eventoId: string;
  inicioUtc: string | null;
  /** Lado de NUESTRO club en el partido. El rival va del otro lado. */
  nuestroLado: 'local' | 'visitante';
  rivalEspnId: string;
  /** Nombre del rival parseado del nombre del evento; `null` si no se pudo (el orquestador lo resuelve por otra vía). */
  rivalNombre: string | null;
  sedeNombre: string | null;
  sedeCiudad: string | null;
  /** País de la sede en INGLÉS, como lo da ESPN ("Belgium", "Saudi Arabia", ...). `zonaDePais` lo entiende. */
  sedePais: string | null;
  /** `$ref` al estado del partido — se resuelve con otra llamada solo si el partido ya empezó. */
  statusRef: string | null;
}

/**
 * Corta el nombre de un evento de ESPN ("{visitante} at {local}") y devuelve el nombre del
 * rival según de qué lado juega nuestro club. Corta en el ÚLTIMO " at " para tolerar un
 * nombre de club que contenga " at ". `null` si no hay un " at " reconocible.
 */
export function nombreRivalDesdeName(nombreEvento: string, nuestroLado: 'local' | 'visitante'): string | null {
  const corte = nombreEvento.lastIndexOf(' at ');
  if (corte === -1) return null;
  const visitante = nombreEvento.slice(0, corte).trim();
  const local = nombreEvento.slice(corte + 4).trim();
  if (!visitante || !local) return null;
  // Si nuestro club es el local, el rival es el visitante; y viceversa.
  return nuestroLado === 'local' ? visitante : local;
}

/**
 * Normaliza un evento de ESPN. `nuestroEspnTeamId` es el id de equipo de ESPN de nuestro
 * club de la cartera (ver el mapa en `sync-fixtures-espn`). Lanza si nuestro club no está
 * entre los dos competidores (no debería pasar: el evento vino de su propio calendario).
 */
export function normalizarEvento(evento: EventoEspnCrudo, nuestroEspnTeamId: string): PartidoEspn {
  const comp = evento.competitions?.[0];
  if (!comp) throw new Error(`Evento ${evento.id} sin bloque competitions`);

  const nuestroId = String(nuestroEspnTeamId);
  const nuestro = comp.competitors.find((c) => String(c.id) === nuestroId);
  if (!nuestro) {
    throw new Error(`Nuestro equipo ${nuestroId} no aparece en el evento ${evento.id}`);
  }
  const rival = comp.competitors.find((c) => String(c.id) !== nuestroId);
  if (!rival) throw new Error(`Evento ${evento.id} sin rival (¿un solo competidor?)`);

  const nuestroLado: 'local' | 'visitante' = nuestro.homeAway === 'home' ? 'local' : 'visitante';
  const direccion = comp.venue?.address ?? null;

  return {
    eventoId: String(evento.id),
    inicioUtc: evento.date ?? null,
    nuestroLado,
    rivalEspnId: String(rival.id),
    rivalNombre: nombreRivalDesdeName(evento.name ?? '', nuestroLado),
    sedeNombre: comp.venue?.fullName ?? null,
    sedeCiudad: direccion?.city ?? null,
    sedePais: direccion?.country ?? null,
    statusRef: comp.status?.$ref ?? null,
  };
}

/**
 * Traduce el estado de un evento de ESPN al enum `estado_partido` de la base.
 * `type.state` es 'pre' | 'in' | 'post'. En 'post', `completed` distingue un partido jugado
 * de uno aplazado/abandonado/cancelado. Nunca se inventa: lo desconocido cae en 'sin_datos'
 * (mismo criterio que `_shared/estado-partido.ts`).
 */
export function mapearEstadoEspn(estado: EstadoEspnCrudo | null | undefined): EstadoPartido {
  if (!estado) return 'sin_datos';
  if (estado.state === 'pre') return 'programado';
  if (estado.state === 'in') return 'en_juego';
  if (estado.state === 'post') {
    if (estado.completed) return 'finalizado';
    if (/postpon|abandon|suspend|interrupt|delay/i.test(estado.name)) return 'suspendido';
    return 'sin_datos'; // cancelado / walkover / desconocido
  }
  return 'sin_datos';
}
