/**
 * Pastilla de estado de un ticket: color + símbolo + palabra (el estado se lee aunque no
 * se distingan los colores). Clases `.tk .tk--<estado>` en app.css.
 *
 * Football First. Creado 2026-09-28.
 */
import { META_ESTADO } from '@/lib/tickets/estados';
import type { EstadoTicket } from '@/lib/tickets/tipos';

export function PastillaEstado({ estado }: { estado: EstadoTicket }) {
  const m = META_ESTADO[estado];
  return (
    <span className={`tk tk--${estado}`}>
      <span aria-hidden="true">{m.simbolo}</span> {m.etiqueta}
    </span>
  );
}
