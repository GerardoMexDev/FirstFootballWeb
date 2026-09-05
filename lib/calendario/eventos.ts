/**
 * Modelo y lógica pura de la vista `calendario`: agrupa los eventos de `agenda_anual` por
 * día, cuenta partidos por mes (franja de densidad) y arma la grilla de 42 celdas del mes
 * (semana de lunes a domingo, mismo criterio que `renderCal()` de la demo).
 *
 * Puro: no hace fetch, no usa `now()`. El día de hoy se pasa como argumento.
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
import { DateTime } from 'luxon';
import type { FuenteAgenda } from '@/lib/agenda/notas-proximas';

export type { FuenteAgenda };

export interface EventoCalendario {
  fuente: FuenteAgenda;
  /** id del partido / jugador / club según la fuente. Se usa para deduplicar partidos. */
  refId: string | null;
  titulo: string;
  /** YYYY-MM-DD en zona de Uruguay (lo calcula la vista). */
  diaUy: string;
  /** instante ISO UTC si el evento tiene hora (partidos); si no, null. */
  cuandoUtc: string | null;
  competenciaCodigo: string | null;
  esInternacional: boolean;
  tentativo: boolean;
}

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Agrupa por día (YYYY-MM-DD). Los partidos vienen con una fila por representado en la vista;
 * acá se deduplican por `refId` para que un partido sea una entrada y no dos (ej. Toluca vs
 * Atlante). Cada día queda ordenado: primero los que tienen hora, después el resto por título.
 */
export function agruparPorDia(eventos: EventoCalendario[]): Map<string, EventoCalendario[]> {
  const porDia = new Map<string, EventoCalendario[]>();
  const vistosPartido = new Set<string>();

  for (const e of eventos) {
    if (e.fuente === 'partido' && e.refId) {
      const clave = `${e.diaUy}:${e.refId}`;
      if (vistosPartido.has(clave)) continue;
      vistosPartido.add(clave);
    }
    const lista = porDia.get(e.diaUy) ?? [];
    lista.push(e);
    porDia.set(e.diaUy, lista);
  }

  for (const lista of porDia.values()) {
    lista.sort((a, b) => {
      // Partidos primero (entre ellos por hora de inicio); el resto por título.
      // Ojo: en la vista los cumpleaños/aniversarios traen `cuando_utc` sintético (mediodía),
      // así que no sirve para distinguir "tiene hora" — se usa `fuente === 'partido'`.
      const pa = a.fuente === 'partido';
      const pb = b.fuente === 'partido';
      if (pa && pb) {
        return (a.cuandoUtc ?? '').localeCompare(b.cuandoUtc ?? '') || a.titulo.localeCompare(b.titulo, 'es');
      }
      if (pa) return -1;
      if (pb) return 1;
      return a.titulo.localeCompare(b.titulo, 'es');
    });
  }
  return porDia;
}

/** Partidos por mes del año dado (deduplicados). Alimenta la franja de densidad. */
export function partidosPorMes(eventos: EventoCalendario[], anio: number): number[] {
  const conteo = Array<number>(12).fill(0);
  const vistos = new Set<string>();

  for (const e of eventos) {
    if (e.fuente !== 'partido') continue;
    const [y, m] = e.diaUy.split('-').map(Number);
    if (y !== anio) continue;
    const clave = e.refId ?? `${e.diaUy}:${e.titulo}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    conteo[m - 1] += 1;
  }
  return conteo;
}

export interface CeldaCalendario {
  /** YYYY-MM-DD */
  fecha: string;
  /** día del mes (1-31) */
  dia: number;
  /** false = celda de relleno del mes anterior o siguiente */
  delMes: boolean;
  esHoy: boolean;
}

/**
 * 42 celdas (6 semanas) del mes, empezando el lunes. Igual que `renderCal()` de la demo.
 * @param mes 0-11
 * @param hoyUy YYYY-MM-DD en zona de Uruguay
 */
export function celdasDelMes(anio: number, mes: number, hoyUy: string): CeldaCalendario[] {
  const primero = DateTime.fromObject({ year: anio, month: mes + 1, day: 1 }, { zone: 'utc' });
  const offset = primero.weekday - 1; // luxon: lunes = 1 … domingo = 7
  const inicio = primero.minus({ days: offset });

  const celdas: CeldaCalendario[] = [];
  for (let i = 0; i < 42; i++) {
    const d = inicio.plus({ days: i });
    const fecha = d.toISODate() ?? '';
    celdas.push({ fecha, dia: d.day, delMes: d.month === mes + 1, esHoy: fecha === hoyUy });
  }
  return celdas;
}
