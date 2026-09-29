/**
 * Traduce el error de una llamada RPC de tickets a un mensaje para la UI. Los mensajes
 * PROPIOS de las funciones de tickets (0025, `raise exception`) se muestran tal cual: se
 * reconocen porque llegan con code 'P0001' (raise plano) o '42501' (los de permiso),
 * empiezan con mayúscula y no son "permission denied" (ese lo cubre el caso de permiso de
 * abajo). Cualquier otro error — técnico, en inglés, de Postgres/PostgREST/red/JWT que no
 * matchee esa combinación exacta — se reemplaza por un texto humano en español (doc 19:
 * content design), para no filtrar nunca mensajes técnicos al usuario. Puro.
 *
 * Football First. Creado 2026-09-28. Ajustado 2026-09-29 (fix round 1).
 */

export function mensajeError(error: { message?: string; code?: string } | null): string {
  if (!error) return 'No se pudo completar. Probá de nuevo.';
  if (error.code === 'PGRST202') return 'Esta función todavía no está disponible. Avisale a Gerardo.';
  const m = error.message ?? '';
  const esMensajePropio =
    (error.code === 'P0001' || error.code === '42501') &&
    /^[A-ZÁÉÍÓÚÑ¿¡]/.test(m) &&
    !/permission denied/i.test(m);
  if (esMensajePropio) return m;
  if (error.code === '42501' || /permission denied/i.test(m)) return 'No tenés permiso para hacer esto.';
  if (/fetch|network/i.test(m)) return 'No se pudo completar. Revisá la conexión y probá de nuevo.';
  return 'No se pudo completar. Probá de nuevo.';
}
