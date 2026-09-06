/**
 * "Datos para contenido" de la ficha de jugador: edad, años en el club, años de carrera y
 * el cumpleaños en texto. Mismos cálculos que `abrirPanelJugador()` de la demo, pero puros
 * y deterministas — reciben el día de hoy en Uruguay (YYYY-MM-DD), no llaman a `now()`.
 *
 * Fechas civiles (YYYY-MM-DD): se anclan a UTC y se restan con Luxon. No es la "aritmética
 * sobre new Date()" que prohíbe contexto.md §6 (eso es para convertir instantes entre zonas);
 * acá son fechas de calendario y el gap en años/días es exacto.
 *
 * Cualquier fecha ausente, inválida o en el futuro → `null`. Nunca 0 ni NaN
 * (contexto.md §10, cero invenciones).
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
import { DateTime } from 'luxon';

export interface FechasJugador {
  fechaNacimiento?: string | null;
  fichaje?: string | null;
  debut?: string | null;
}

export interface DatosContenido {
  /** Años cumplidos. */
  edad: number | null;
  /** Años en el club actual, con un decimal (p.ej. 1.3). */
  aniosEnClub: number | null;
  /** Años desde el debut profesional, entero. */
  aniosDeCarrera: number | null;
  /** Cumpleaños en texto, día y mes en español sin año (p.ej. "28 de diciembre"). */
  cumpleLegible: string | null;
}

/** Fecha civil válida y no futura respecto de `hoyIso`, como DateTime en UTC; si no, null. */
function fechaValida(iso: string | null | undefined, hoy: DateTime): DateTime | null {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).startOf('day');
  if (!dt.isValid || dt > hoy) return null;
  return dt;
}

export function datosParaContenido(fechas: FechasJugador, hoyUy: string): DatosContenido {
  const hoy = DateTime.fromISO(hoyUy, { zone: 'utc' }).startOf('day');

  const nacimiento = fechaValida(fechas.fechaNacimiento, hoy);
  const fichaje = fechaValida(fechas.fichaje, hoy);
  const debut = fechaValida(fechas.debut, hoy);

  return {
    edad: nacimiento ? Math.floor(hoy.diff(nacimiento, 'years').years) : null,
    aniosEnClub: fichaje ? Math.round(hoy.diff(fichaje, 'years').years * 10) / 10 : null,
    aniosDeCarrera: debut ? Math.round(hoy.diff(debut, 'years').years) : null,
    cumpleLegible: nacimiento ? nacimiento.setLocale('es').toFormat("d 'de' LLLL") : null,
  };
}
