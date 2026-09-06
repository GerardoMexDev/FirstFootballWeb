/**
 * Validación de la nueva contraseña en la pestaña "Contraseña" de "Mi cuenta".
 * Mismas reglas que `#guardar-clave` de la demo: mínimo 8 caracteres y que las dos
 * coincidan. Puro — la escritura contra Supabase (`auth.updateUser`) la hace el componente.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */

export const MINIMO_CARACTERES = 8;

export interface ResultadoValidacion {
  ok: boolean;
  /** Mensaje humano para mostrar cuando `ok` es false. */
  mensaje?: string;
}

export function validarContrasena(nueva: string, repetir: string): ResultadoValidacion {
  if (nueva.length < MINIMO_CARACTERES) {
    return { ok: false, mensaje: `La contraseña necesita al menos ${MINIMO_CARACTERES} caracteres.` };
  }
  if (nueva !== repetir) {
    return { ok: false, mensaje: 'Las dos contraseñas no coinciden.' };
  }
  return { ok: true };
}
