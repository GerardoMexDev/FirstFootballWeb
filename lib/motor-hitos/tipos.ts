/**
 * Tipos del motor de hitos. Ver `lib/motor-hitos/index.ts` para la lógica y
 * `supabase/migrations/0003_motor_hitos.sql` para de dónde sale cada número.
 */
import type { PartidoProximo } from '@/lib/repositorios/tipos';

export interface EscalaHito {
  metrica: 'pj' | 'g' | 'a';
  base: 'carrera' | 'seleccion';
  /** Cada cuántas unidades hay un hito (p.ej. 50 -> cada 50 partidos). */
  paso: number;
  /** Cuántas unidades antes de llegar ya se empieza a avisar. */
  aviso: number;
  /** Usa "{n}" como marcador del número objetivo — p.ej. "Partido {n}". */
  plantillaFrase: string;
}

/** Total corriente de un jugador: base manual + lo que ya sumó la sync (vista `totales_jugador`). */
export interface TotalesJugador {
  jugadorId: string;
  carreraPartidos: number | null;
  carreraGoles: number | null;
  carreraAsistencias: number | null;
  seleccionPartidos: number | null;
  seleccionGoles: number | null;
}

export interface JugadorBasico {
  id: string;
  nombre: string;
  apodo: string | null;
}

/**
 * Un hito calculado, listo para mostrar. `partido` solo se completa para métrica `pj` +
 * base `carrera` (es la única combinación donde se puede adivinar en qué partido concreto
 * pasa, asumiendo que el jugador juega todos los que le quedan) — para goles/asistencias o
 * hitos con la selección, `partido` queda `null` y se muestra solo "cuántos faltan".
 */
export interface Hito {
  jugadorId: string;
  jugadorNombre: string;
  jugadorApodo: string | null;
  metrica: EscalaHito['metrica'];
  base: EscalaHito['base'];
  /** Número redondo al que se acerca (p.ej. 250). */
  objetivo: number;
  /** Cuántas unidades faltan (siempre > 0, siempre <= escala.aviso). */
  falta: number;
  /** Frase ya armada, p.ej. "Partido 250". */
  frase: string;
  /** El partido donde se estima que ocurre (solo pj+carrera) — null si no se puede predecir. */
  partido: PartidoProximo | null;
}
