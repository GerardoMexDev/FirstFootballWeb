/**
 * Formato de valores para la UI.
 * Regla dura (contexto.md §10): la ausencia de un dato JAMÁS se convierte en 0
 * ni en un valor asumido. Si la fuente no lo trae, se muestra "Sin datos".
 */

export const SIN_DATOS = 'Sin datos';

/**
 * Devuelve el valor si existe, o "Sin datos" si es null/undefined.
 * OJO: 0 es un valor válido (0 goles ≠ sin datos), por eso solo se filtran null/undefined.
 * @example mostrar(jugador.goles)  // 3  |  "Sin datos"
 */
export function mostrar<T>(v: T | null | undefined): T | string {
  return v ?? SIN_DATOS;
}

/** ¿Hay que renderizar el componente EstadoSinDatos para este valor? */
export function esVacio(v: unknown): boolean {
  return v === null || v === undefined;
}

/**
 * Iniciales de un nombre (hasta 2), para el avatar/escudo de respaldo cuando no hay foto/
 * escudo subido. Mismo criterio que `ini()` en la demo.
 * @example iniciales('Nahitan Nández')  // 'NN'
 */
export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .map((parte) => parte[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
