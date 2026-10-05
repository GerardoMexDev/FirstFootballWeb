/**
 * Cierre de sesión por inactividad (pedido de Gerardo 2026-10-05: en el celular la sesión seguía
 * abierta a los 3 días). Supabase no vence la sesión sola (el refresh token se renueva siempre),
 * así que el middleware guarda en una cookie la hora del último pedido y, si pasaron más de
 * `HORAS_INACTIVIDAD`, cierra la sesión de ESE dispositivo. Puro: lo usa `middleware.ts`.
 *
 * Football First. Creado 2026-10-05.
 */

export const HORAS_INACTIVIDAD = 12;
export const COOKIE_ACTIVIDAD = 'ff_actividad';
const LIMITE_MS = HORAS_INACTIVIDAD * 3_600_000;

/**
 * ¿Hay que cerrar la sesión? Solo si la cookie existe, es un número y es más vieja que el
 * límite. Sin cookie (primer pedido tras el login, o sesiones anteriores a este cambio) no se
 * cierra: el middleware la crea en ese mismo pedido.
 */
export function sesionVencidaPorInactividad(valorCookie: string | undefined, ahoraMs: number): boolean {
  if (!valorCookie) return false;
  const ultima = Number(valorCookie);
  if (!Number.isFinite(ultima) || ultima <= 0) return false;
  return ahoraMs - ultima > LIMITE_MS;
}
