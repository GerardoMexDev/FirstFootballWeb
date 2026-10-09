/**
 * Períodos del conteo mensual de diseños (pedido de la agencia 2026-10-08, para el pago del
 * Diseñador): del día 6 de un mes al día 5 del mes siguiente, en fechas de Uruguay. La clave de
 * un período es el mes en que empieza ("2026-10" = 6 oct – 5 nov 2026). Puro.
 *
 * Football First. Creado 2026-10-08.
 */
import { DateTime } from 'luxon';

/** Día del mes en que arranca cada período. */
export const DIA_INICIO = 6;
/** Primer período con datos: los tickets arrancaron el 29/09 (6 sep – 5 oct). */
export const PRIMER_PERIODO = '2026-09';

export interface Periodo {
  /** "YYYY-MM" del mes en que empieza. */
  clave: string;
  /** YYYY-MM-DD, inclusive. */
  desde: string;
  /** YYYY-MM-DD, inclusive. */
  hasta: string;
  /** "6 oct – 5 nov 2026" (o "6 dic 2026 – 5 ene 2027" si cruza el año). */
  etiqueta: string;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** El período de una clave "YYYY-MM"; `null` si la clave no es válida. */
export function periodoDeClave(clave: string): Periodo | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(clave)) return null;
  const inicio = DateTime.fromISO(`${clave}-0${DIA_INICIO}`);
  if (!inicio.isValid) return null;
  const fin = inicio.plus({ months: 1 }).minus({ days: 1 });
  const mismoAnio = inicio.year === fin.year;
  const etiqueta = mismoAnio
    ? `${inicio.day} ${MESES[inicio.month - 1]} – ${fin.day} ${MESES[fin.month - 1]} ${fin.year}`
    : `${inicio.day} ${MESES[inicio.month - 1]} ${inicio.year} – ${fin.day} ${MESES[fin.month - 1]} ${fin.year}`;
  return { clave, desde: inicio.toISODate()!, hasta: fin.toISODate()!, etiqueta };
}

/** El período que contiene un día (YYYY-MM-DD de Uruguay). */
export function periodoDeDia(diaUy: string): Periodo {
  const d = DateTime.fromISO(diaUy);
  const inicio = d.day >= DIA_INICIO ? d : d.minus({ months: 1 });
  return periodoDeClave(inicio.toFormat('yyyy-MM'))!;
}

/** Todos los períodos desde `PRIMER_PERIODO` hasta el que contiene `hoyUy`, del más nuevo al más viejo. */
export function periodosHasta(hoyUy: string): Periodo[] {
  const actual = periodoDeDia(hoyUy);
  const lista: Periodo[] = [];
  let cursor = DateTime.fromISO(`${actual.clave}-01`);
  const primero = DateTime.fromISO(`${PRIMER_PERIODO}-01`);
  while (cursor >= primero) {
    lista.push(periodoDeClave(cursor.toFormat('yyyy-MM'))!);
    cursor = cursor.minus({ months: 1 });
  }
  return lista;
}
