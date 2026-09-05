/**
 * Lógica pura de detección de cambio de club de un representado. No hace fetch ni conoce
 * Supabase: recibe el último traspaso que trajo `api-football.ts` y decide. Se testea con
 * `node --test` (supabase/functions/_shared/roster.test.ts) sin levantar Deno.
 *
 * Fuente: SOLO `GET /transfers`. Se probó también `GET /players/squads` pero en ventanas de
 * partidos de estrellas devuelve equipos representativos ("Liga MX All-Stars") como si fueran
 * el club del jugador — falso positivo. Un partido de estrellas no genera un "transfer", así
 * que `/transfers` no tiene ese ruido.
 *
 * Reglas de seguridad:
 *   - NUNCA se deja `club_actual_id` en NULL.
 *   - Solo se auto-aplica si el traspaso más reciente es RECIENTE (dentro de `recienciaDias`)
 *     y su destino no parece un equipo representativo. Cualquier otra discrepancia se
 *     reporta como "revisar" (no toca datos) para que una persona la mire.
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */

/** Un club identificado por su id de API-Football + nombre. */
export interface ClubRef {
  idExterno: string;
  nombre: string;
}

/** Un movimiento de `GET /transfers` ya normalizado. */
export interface Traspaso {
  fecha: string; // YYYY-MM-DD (como lo da API-Football); puede venir vacío
  tipo: string; // 'Free' | 'Loan' | '€ 18M' | 'Transfer' | 'N/A' ...
  desde: ClubRef | null;
  hasta: ClubRef | null;
}

export interface CambioDeClub {
  nuevoClub: ClubRef;
  traspaso: Traspaso;
}

export interface ResultadoDeteccion {
  /** Cambio confirmado: aplicar (mover jugador + hito). */
  aplicar?: CambioDeClub;
  /** Discrepancia que NO se auto-aplica: se registra para que una persona la revise. */
  revisar?: { motivo: string; club: ClubRef };
}

const RECIENCIA_DIAS_DEFAULT = 200; // ~media temporada: cubre un fichaje de pretemporada
const PATRON_REPRESENTATIVO = /all[- ]?stars?|selecci|combinado|\bxi\b/i;

/** Días entre dos fechas civiles YYYY-MM-DD. NaN si alguna no parsea. */
function diasEntre(desdeIso: string, hastaIso: string): number {
  const desde = Date.parse(`${desdeIso}T00:00:00Z`);
  const hasta = Date.parse(`${hastaIso}T00:00:00Z`);
  if (Number.isNaN(desde) || Number.isNaN(hasta)) return NaN;
  return Math.round((hasta - desde) / 86_400_000);
}

/**
 * @param clubActualIdExterno id_externo del club que tenemos guardado (o null si el jugador no tiene)
 * @param ultimoTraspaso       movimiento más reciente de `/transfers` (o null si no hay historial)
 * @param hoyIso               fecha de hoy YYYY-MM-DD (se inyecta para poder testear)
 * @param opciones.recienciaDias  antigüedad máxima del traspaso para auto-aplicarlo
 */
export function detectarCambioDeClub(
  clubActualIdExterno: string | null,
  ultimoTraspaso: Traspaso | null,
  hoyIso: string,
  opciones: { recienciaDias?: number } = {},
): ResultadoDeteccion {
  const reciencia = opciones.recienciaDias ?? RECIENCIA_DIAS_DEFAULT;

  const destino = ultimoTraspaso?.hasta;
  if (!ultimoTraspaso || !destino || !destino.idExterno) return {}; // sin dato para decidir

  if (destino.idExterno === clubActualIdExterno) return {}; // ya estamos al día

  if (PATRON_REPRESENTATIVO.test(destino.nombre)) {
    return { revisar: { motivo: `destino parece un equipo representativo: "${destino.nombre}"`, club: destino } };
  }

  const dias = diasEntre(ultimoTraspaso.fecha, hoyIso);
  if (Number.isNaN(dias) || dias < 0 || dias > reciencia) {
    return {
      revisar: {
        motivo: `traspaso a "${destino.nombre}" fechado ${ultimoTraspaso.fecha || '(sin fecha)'} — fuera de la ventana de ${reciencia} días`,
        club: destino,
      },
    };
  }

  return { aplicar: { nuevoClub: destino, traspaso: ultimoTraspaso } };
}

/**
 * Arma el título del hito de traspaso, en el mismo tono que el resto de la app.
 * @example "Fichaje a Genk (desde Cagliari)" · "Cesión a Genk"
 */
export function tituloTraspaso(nuevoClub: ClubRef, traspaso: Traspaso): string {
  const esCesion = traspaso.tipo?.toLowerCase().includes('loan');
  const verbo = esCesion ? 'Cesión a' : 'Fichaje a';
  const desde = traspaso.desde?.nombre ? ` (desde ${traspaso.desde.nombre})` : '';
  return `${verbo} ${nuevoClub.nombre}${desde}`;
}
