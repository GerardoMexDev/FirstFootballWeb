/**
 * Bloque "Tickets de diseño" de la ficha del jugador (0028): sus tickets abiertos (pastilla +
 * título + lucecita si le toca a quien mira; clic abre el ticket) y, para Admin/CM, el botón
 * de crear un ticket de fecha. Si no se pudieron leer los tickets, no se ofrece crear.
 *
 * Football First. Creado 2026-09-29.
 */
'use client';

import { PastillaEstado } from '@/components/tickets/PastillaEstado';
import { AlertaTicket } from '@/components/tickets/AlertaTicket';
import { CrearTicketEvento } from '@/components/tickets/CrearTicketEvento';
import { usePanel } from '@/lib/paneles/use-panel';
import { debeActuar, puedeCrear } from '@/lib/tickets/permisos';
import { META_ESTADO, TEXTO_ALERTA } from '@/lib/tickets/estados';
import type { TicketsJugadorBundle } from '@/lib/tickets/cargar-tickets-jugador';

export function TicketsJugador({
  jugadorId,
  jugadorNombre,
  datos,
}: {
  jugadorId: string;
  jugadorNombre: string;
  datos: TicketsJugadorBundle;
}) {
  const { abrir } = usePanel();
  const { tickets, ticketsError, usuario, proximas, hoyUy } = datos;
  const abiertos = tickets.filter((t) => t.estado !== 'publicado');

  return (
    <div className="bloque">
      <span className="label">Tickets de diseño</span>
      {ticketsError && <p className="meta">No pudimos cargar los tickets de este jugador. Recargá para crear uno.</p>}
      {abiertos.length > 0 && (
        <div className="tkj">
          {abiertos.map((t) => {
            const alerta = usuario && debeActuar(usuario.cargo, usuario.id, t) ? TEXTO_ALERTA[t.estado] : undefined;
            return (
              <button
                key={t.id}
                type="button"
                className="tkj__t"
                aria-label={[t.titulo, META_ESTADO[t.estado].etiqueta, alerta].filter(Boolean).join('. ')}
                onClick={() => abrir('ticket', t.id)}
              >
                <PastillaEstado estado={t.estado} />
                <span className="tkj__n">{t.titulo}</span>
                {alerta && <AlertaTicket texto={alerta} />}
              </button>
            );
          })}
        </div>
      )}
      {!ticketsError && !abiertos.length && <p className="meta">Sin tickets abiertos.</p>}
      {usuario && !ticketsError && puedeCrear(usuario.cargo) && (
        <CrearTicketEvento jugadorId={jugadorId} jugadorNombre={jugadorNombre} proximas={proximas} hoyUy={hoyUy} />
      )}
    </div>
  );
}
