/**
 * Validación del cambio de contraseña en la pestaña "Contraseña" de "Mi cuenta".
 * Reglas de `#guardar-clave` de la demo (mínimo 8 caracteres, que las dos coincidan) +
 * desde 2026-09-28: si se pasa la contraseña actual, tiene que venir escrita y la nueva
 * tiene que ser distinta. Puro — la verificación real de la actual y la escritura contra
 * Supabase las hace el componente.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */

export const MINIMO_CARACTERES = 8;

export interface ResultadoValidacion {
  ok: boolean;
  /** Mensaje humano para mostrar cuando `ok` es false. */
  mensaje?: string;
}

export function validarContrasena(nueva: string, repetir: string, actual?: string): ResultadoValidacion {
  if (actual !== undefined && !actual) {
    return { ok: false, mensaje: 'Escribí tu contraseña actual.' };
  }
  if (nueva.length < MINIMO_CARACTERES) {
    return { ok: false, mensaje: `La contraseña necesita al menos ${MINIMO_CARACTERES} caracteres.` };
  }
  if (nueva !== repetir) {
    return { ok: false, mensaje: 'Las dos contraseñas no coinciden.' };
  }
  if (actual !== undefined && nueva === actual) {
    return { ok: false, mensaje: 'La nueva contraseña tiene que ser distinta de la actual.' };
  }
  return { ok: true };
}
