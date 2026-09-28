/**
 * Piezas del saludo de bienvenida de la app ("Buenas tardes, **Felipe**").
 * Puro — la hora la pasa quien llama (en hora de Uruguay, ver `app/(app)/layout.tsx`).
 *
 * Football First. Creado 2026-09-28.
 */

/** Primer nombre de `nombre_completo` ("Felipe Merola" → "Felipe"). Vacío si no hay nombre. */
export function primerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0] ?? '';
}

/** "Buenos días" (5–11 h), "Buenas tardes" (12–19 h) o "Buenas noches" (20–4 h). */
export function saludoPorHora(hora: number): string {
  if (hora >= 5 && hora < 12) return 'Buenos días';
  if (hora >= 12 && hora < 20) return 'Buenas tardes';
  return 'Buenas noches';
}
