/**
 * Motor de hitos — mismo criterio que `ESCALAS`/`hitosDe()` de la demo, sobre datos reales.
 * Puro: no hace fetch, no conoce Supabase. Recibe lo que ya trajeron los repositorios
 * (`RepositorioHitosSupabase`, `RepositorioPartidosSupabase`) y devuelve `Hito[]`.
 *
 * Si un jugador no tiene la base cargada (`jugadores.*_base` en NULL — ver migración 0003),
 * esa métrica no genera hito para él: no se inventa un punto de partida en 0.
 */
import type { PartidoProximo } from '@/lib/repositorios/tipos';
import type { EscalaHito, Hito, JugadorBasico, TotalesJugador } from './tipos';

function valorDe(totales: TotalesJugador, metrica: EscalaHito['metrica'], base: EscalaHito['base']): number | null {
  if (base === 'carrera') {
    if (metrica === 'pj') return totales.carreraPartidos;
    if (metrica === 'g') return totales.carreraGoles;
    if (metrica === 'a') return totales.carreraAsistencias;
  } else {
    if (metrica === 'pj') return totales.seleccionPartidos;
    if (metrica === 'g') return totales.seleccionGoles;
  }
  return null; // combinación sin dato en el esquema (p.ej. asistencias con selección)
}

/**
 * Calcula los hitos "por venir" de todos los jugadores, para todas las escalas activas.
 * `proximosPorJugador` debe venir ordenado por fecha ascendente (así `[falta - 1]` es una
 * estimación razonable de en qué partido futuro se cumple el número redondo).
 */
export function calcularHitos(
  jugadores: JugadorBasico[],
  totalesPorJugador: Map<string, TotalesJugador>,
  escalas: EscalaHito[],
  proximosPorJugador: Map<string, PartidoProximo[]>,
): Hito[] {
  const hitos: Hito[] = [];

  for (const jugador of jugadores) {
    const totales = totalesPorJugador.get(jugador.id);
    if (!totales) continue;

    for (const escala of escalas) {
      const v = valorDe(totales, escala.metrica, escala.base);
      if (v === null) continue; // sin base cargada -> sin dato, no se fabrica un hito
      if (v === 0 && escala.base === 'seleccion') continue; // sin caps, no tiene sentido "avisar"

      const objetivo = Math.ceil((v + 1) / escala.paso) * escala.paso;
      const falta = objetivo - v;
      if (falta > escala.aviso) continue; // todavía lejos, no se muestra

      const partido =
        escala.metrica === 'pj' && escala.base === 'carrera'
          ? (proximosPorJugador.get(jugador.id)?.[falta - 1] ?? null)
          : null;

      hitos.push({
        jugadorId: jugador.id,
        jugadorNombre: jugador.nombre,
        jugadorApodo: jugador.apodo,
        metrica: escala.metrica,
        base: escala.base,
        objetivo,
        falta,
        frase: escala.plantillaFrase.replace('{n}', String(objetivo)),
        partido,
      });
    }
  }

  return hitos;
}

/** Fecha estimada para ordenar: la del partido si se conoce; si no, "lejos" (al final). */
function instanteEstimado(hito: Hito): number {
  if (hito.partido?.inicioUtc) return new Date(hito.partido.inicioUtc).getTime();
  return Date.now() + 60 * 86_400_000;
}

export function ordenarHitos(hitos: Hito[]): Hito[] {
  return [...hitos].sort((a, b) => instanteEstimado(a) - instanteEstimado(b));
}

/** IDs de partido que tienen algún hito encima — para el tag "Hito" en la tarjeta y el hero. */
export function partidosConHito(hitos: Hito[]): Set<string> {
  return new Set(hitos.filter((h) => h.partido).map((h) => h.partido!.partidoId));
}
