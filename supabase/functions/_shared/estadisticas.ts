/**
 * Extracción pura de la línea de un jugador dentro de la respuesta de
 * `GET /fixtures/players?fixture=` de API-Football. No hace fetch ni conoce Supabase; se
 * testea con `node --test` (supabase/functions/_shared/estadisticas.test.ts).
 *
 * Convención de NULL de API-Football en este endpoint (importante, ver contexto.md §10):
 *   - Si el jugador TIENE línea de estadísticas, un `null` en goles / asistencias / tarjetas
 *     significa CERO (jugó y no marcó / no vio tarjeta) — ahí sí se guarda 0, no es "sin dato".
 *   - `minutos` y `valoracion` en `null` SÍ son "sin dato" (suplente no usado / sin rating):
 *     se guardan como NULL.
 *   - Si el jugador NO aparece en la respuesta -> `null` (no se inventa una fila).
 *   - `minutos` 0 o null => no jugó: se marca `convocado` pero NO se crea fila de estadística
 *     (si no, `totales_jugador` contaría un partido que no jugó).
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */

export interface EstadisticaJugador {
  minutos: number | null;
  goles: number;
  asistencias: number;
  amarillas: number;
  rojas: number;
  titular: boolean | null;
  valoracion: number | null;
}

export interface LineaJugador {
  /** Apareció en la planilla del partido => estuvo al menos en el banco. */
  convocado: true;
  /** minutos > 0. Si es false, fue suplente no usado: `estadistica` va null. */
  jugo: boolean;
  estadistica: EstadisticaJugador | null;
}

/** Redondea a entero >= 0, o null si no es un número. Para minutos. */
function enteroONull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

/** Un conteo que en `null` significa 0 (el jugador tiene línea, solo no sumó). */
function conteo(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/** Rating a número con 1-2 decimales, o null si la API no lo da. */
function ratingONull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param respuesta  el array `response` de `GET /fixtures/players?fixture=`
 * @param jugadorIdExterno  id de API-Football del jugador (== jugadores.id_externo)
 * @returns la línea del jugador, o null si no figura en el partido
 */
export function extraerLineaJugador(
  respuesta: unknown[],
  jugadorIdExterno: string,
): LineaJugador | null {
  const idBuscado = String(jugadorIdExterno);

  for (const bloqueEquipo of respuesta) {
    // deno-lint-ignore no-explicit-any
    const jugadores = (bloqueEquipo as any)?.players ?? [];
    for (const entrada of jugadores) {
      if (String(entrada?.player?.id) !== idBuscado) continue;

      const s = entrada?.statistics?.[0] ?? {};
      const minutos = enteroONull(s?.games?.minutes);
      const jugo = minutos !== null && minutos > 0;

      if (!jugo) {
        return { convocado: true, jugo: false, estadistica: null };
      }

      const substitute = s?.games?.substitute;
      const titular = substitute === false ? true : substitute === true ? false : null;

      return {
        convocado: true,
        jugo: true,
        estadistica: {
          minutos,
          goles: conteo(s?.goals?.total),
          asistencias: conteo(s?.goals?.assists),
          amarillas: conteo(s?.cards?.yellow),
          rojas: conteo(s?.cards?.red),
          titular,
          valoracion: ratingONull(s?.games?.rating),
        },
      };
    }
  }

  return null;
}
