/**
 * Utilidades de zona horaria para Football First.
 * La agencia opera en hora de Uruguay (America/Montevideo, sin DST).
 * Los partidos se guardan como instante UTC + zona IANA de la sede.
 *
 * Reglas (contexto.md §6): prohibido usar offsets fijos (+3, -4), siglas de zona
 * como dato de cálculo (CEST, BRT), o aritmética sobre new Date(). Siempre IANA + Luxon.
 */
import { DateTime } from 'luxon';

/** Zona de operación de la agencia. Constante única. */
export const ZONA_AGENCIA = 'America/Montevideo';

/**
 * Zonas IANA de la cartera de jugadores (Fase 1).
 * Sirven para elegir `zona_horaria_evento` al importar y para mostrar la hora en la sede.
 */
export const ZONAS_CARTERA = {
  arabia: 'Asia/Riyadh',
  belgica: 'Europe/Brussels',
  mexico: 'America/Mexico_City',
  brasil: 'America/Sao_Paulo',
  chile: 'America/Santiago',
  uruguay: 'America/Montevideo',
} as const;

/**
 * Convierte una hora de pared de la sede a instante UTC absoluto.
 * Resuelve el offset correcto para esa fecha (con o sin horario de verano).
 * @param fechaHoraLocal p.ej. '2026-03-28T20:00:00' (sin offset)
 * @param zonaSede IANA, p.ej. 'Europe/Brussels'
 * @returns Date en UTC, listo para columna timestamptz
 */
export function aInstanteUtc(fechaHoraLocal: string, zonaSede: string): Date {
  const dt = DateTime.fromISO(fechaHoraLocal, { zone: zonaSede });
  if (!dt.isValid) {
    throw new Error(`Fecha/zona inválida: ${dt.invalidReason} (${zonaSede})`);
  }
  return dt.toUTC().toJSDate();
}

/** Hora del partido en horario de operación de la agencia (Uruguay). */
export function horaEnUruguay(inicioUtc: string): string {
  return DateTime.fromISO(inicioUtc, { zone: 'utc' })
    .setZone(ZONA_AGENCIA)
    .toFormat("cccc d 'de' LLLL HH:mm 'h'", { locale: 'es' });
}

/** Hora local en la sede del partido (para la ficha del partido). */
export function horaEnSede(inicioUtc: string, zonaSede: string): string {
  return DateTime.fromISO(inicioUtc, { zone: 'utc' }).setZone(zonaSede).toFormat("HH:mm 'h'");
}

/** Solo la hora (HH:mm) en Uruguay — para la columna izquierda de la tarjeta de partido. */
export function horaCortaEnUruguay(inicioUtc: string): string {
  return DateTime.fromISO(inicioUtc, { zone: 'utc' }).setZone(ZONA_AGENCIA).toFormat('HH:mm');
}

/**
 * Día calendario (YYYY-MM-DD) en zona de Uruguay al que pertenece el instante.
 * Es la clave con la que se agrupan los partidos por día en la vista `partidos`
 * y se calcula la densidad del calendario.
 */
export function diaEnUruguay(inicioUtc: string): string {
  return DateTime.fromISO(inicioUtc, { zone: 'utc' }).setZone(ZONA_AGENCIA).toISODate() ?? '';
}
