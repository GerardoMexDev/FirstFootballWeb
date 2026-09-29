/**
 * Traduce el error de una llamada RPC de tickets a un mensaje para la UI. Los mensajes de
 * la base (0025) ya vienen en español y se muestran tal cual; lo técnico en inglés se
 * reemplaza por un texto humano (doc 19: content design). Puro.
 *
 * Football First. Creado 2026-09-28.
 */

export function mensajeError(error: { message?: string; code?: string } | null): string {
  if (!error) return 'No se pudo completar. Probá de nuevo.';
  if (error.code === 'PGRST202') return 'Esta función todavía no está disponible. Avisale a Gerardo.';
  const m = error.message ?? '';
  // Los mensajes propios empiezan con mayúscula (con o sin tilde) y no son de red.
  if (/^[A-ZÁÉÍÓÚÑ¿¡]/.test(m) && !/fetch|network/i.test(m)) return m;
  if (error.code === '42501' || /permission denied/i.test(m)) return 'No tenés permiso para hacer esto.';
  if (/fetch|network/i.test(m)) return 'No se pudo completar. Revisá la conexión y probá de nuevo.';
  return 'No se pudo completar. Probá de nuevo.';
}
