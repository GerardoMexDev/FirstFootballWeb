/**
 * Pastilla del semáforo de diseño (0030): 🔴 pendiente, 🟢 completado, 🟡 vencido. Siempre lleva
 * texto y símbolo además del color (el estado se lee aunque no se distingan los colores).
 * Estilos `.sem` en app.css.
 *
 * Football First. Creado 2026-09-30.
 */
import { META_VISUAL } from '@/lib/tickets/semaforo';
import type { EstadoVisual } from '@/lib/tickets/tipos';

export function PastillaSemaforo({ estado, detalle }: { estado: EstadoVisual; detalle?: string }) {
  const m = META_VISUAL[estado];
  return (
    <span className={`sem sem--${estado}`}>
      <span aria-hidden="true">{m.simbolo}</span> {m.etiqueta}
      {detalle ? ` · ${detalle}` : ''}
    </span>
  );
}
