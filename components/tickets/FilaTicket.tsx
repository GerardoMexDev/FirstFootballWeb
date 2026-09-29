/**
 * Una fila de la pantalla Tickets: pastilla de estado + título, vencimiento (rojo si venció),
 * quién lo creó y cuándo, y la lucecita si el ticket espera algo de quien mira. Toda la fila
 * es un botón que abre el panel del ticket. Estilos `.tkf` en app.css.
 *
 * Football First. Creado 2026-09-29.
 */
import { PastillaEstado } from '@/components/tickets/PastillaEstado';
import { AlertaTicket } from '@/components/tickets/AlertaTicket';
import { META_ESTADO } from '@/lib/tickets/estados';
import { textoCreado } from '@/lib/tickets/pantalla';
import { textoVencimiento } from '@/lib/tickets/vencimiento';
import type { ResumenTicket } from '@/lib/tickets/tipos';

export function FilaTicket({
  ticket: t,
  hoyUy,
  ahoraIso,
  alerta,
  onAbrir,
}: {
  ticket: ResumenTicket;
  hoyUy: string;
  ahoraIso: string;
  /** "Ticket pendiente" / "Para revisar" / "Para publicar" si le toca a quien mira. */
  alerta?: string;
  onAbrir: () => void;
}) {
  const venc = textoVencimiento(t.fechaLimite, t.estado, hoyUy);
  const creado = textoCreado(t, ahoraIso);
  // Nombre accesible completo: el lector no tiene que recorrer los hijos.
  const etiqueta = [t.titulo, META_ESTADO[t.estado].etiqueta, venc?.texto, creado, alerta].filter(Boolean).join('. ');
  return (
    <button type="button" className="tkf" aria-label={etiqueta} onClick={onAbrir}>
      <span className="tkf__1">
        <PastillaEstado estado={t.estado} />
        <b>{t.titulo}</b>
      </span>
      <span className="tkf__2">
        {venc && <span className={venc.vencido ? 'tk__vence--mal' : undefined}>{venc.texto}</span>}
        <span>{creado}</span>
        {alerta && <AlertaTicket texto={alerta} />}
      </span>
    </button>
  );
}
