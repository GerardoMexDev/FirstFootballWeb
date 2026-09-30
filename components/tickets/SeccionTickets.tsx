/**
 * Parte cliente de la pantalla Tickets: tres contadores que filtran por urgencia (Vencidos /
 * Por vencer / Al día), chips de estado (Abiertos / Cerrados / Todos) y la lista. Filtra en el
 * navegador: la página ya trajo todo (spec §3). Tocar un chip de estado limpia la urgencia;
 * tocar un contador pasa a "Abiertos" (la urgencia solo existe en abiertos).
 * Después de una acción en el panel, `router.refresh()` (PanelTicket) vuelve a leer la página.
 *
 * Football First. Creado 2026-09-29.
 */
'use client';

import { useMemo, useState } from 'react';
import { FilaTicket } from '@/components/tickets/FilaTicket';
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';
import { usePanel } from '@/lib/paneles/use-panel';
import { debeActuar } from '@/lib/tickets/permisos';
import { alertaDe } from '@/lib/tickets/estados';
import { contarUrgencias, esUrgenteHoy, filtrarPantalla, type FiltroEstado, type Urgencia } from '@/lib/tickets/pantalla';
import type { ResumenTicket } from '@/lib/tickets/tipos';

const CONTADORES: { u: Urgencia; etiqueta: string; vacio: string }[] = [
  { u: 'vencido', etiqueta: 'Vencidos', vacio: 'No hay tickets vencidos.' },
  { u: 'por_vencer', etiqueta: 'Por vencer', vacio: 'No hay tickets por vencer.' },
  { u: 'al_dia', etiqueta: 'Al día', vacio: 'No hay tickets al día.' },
];

const ESTADOS: { e: FiltroEstado; etiqueta: string; vacio: string }[] = [
  { e: 'abiertos', etiqueta: 'Abiertos', vacio: 'No hay tickets abiertos.' },
  { e: 'completados', etiqueta: 'Completados', vacio: 'Todavía no hay tickets completados.' },
  { e: 'todos', etiqueta: 'Todos', vacio: 'Todavía no hay tickets.' },
];

export function SeccionTickets({
  tickets,
  cargo,
  usuarioId,
  hoyUy,
  ahoraIso,
}: {
  /** Ya filtrados por cargo (`visiblesPara`) y del más nuevo al más viejo. */
  tickets: ResumenTicket[];
  cargo: string;
  usuarioId: string;
  hoyUy: string;
  ahoraIso: string;
}) {
  const [estado, setEstado] = useState<FiltroEstado>('abiertos');
  const [urg, setUrg] = useState<Urgencia | null>(null);
  const { abrir } = usePanel();

  const cuentas = useMemo(() => contarUrgencias(tickets, hoyUy), [tickets, hoyUy]);
  const visibles = useMemo(() => filtrarPantalla(tickets, { estado, urgencia: urg }, hoyUy), [tickets, estado, urg, hoyUy]);

  function tocarContador(u: Urgencia) {
    if (urg === u) {
      setUrg(null);
    } else {
      setUrg(u);
      setEstado('abiertos');
    }
  }

  function tocarEstado(e: FiltroEstado) {
    setEstado(e);
    setUrg(null);
  }

  const vacio =
    !tickets.length && cargo === 'Community Manager'
      ? 'Todavía no creaste tickets. Se crean desde el detalle de un partido o desde la ficha de un jugador.'
      : urg
        ? CONTADORES.find((c) => c.u === urg)!.vacio
        : ESTADOS.find((x) => x.e === estado)!.vacio;

  return (
    <>
      <div className="kpis tkk">
        {CONTADORES.map(({ u, etiqueta }) => (
          <button
            key={u}
            type="button"
            className={`kpi tkk__k tkk__k--${u} ${urg === u ? 'on' : ''}`}
            aria-pressed={urg === u}
            onClick={() => tocarContador(u)}
          >
            <b>{cuentas[u]}</b>
            <span>{etiqueta}</span>
          </button>
        ))}
      </div>

      <div className="barra" id="filtros-tickets">
        {ESTADOS.map(({ e, etiqueta }) => (
          <button
            key={e}
            type="button"
            className={estado === e && !urg ? 'chip on' : 'chip'}
            aria-pressed={estado === e && !urg}
            onClick={() => tocarEstado(e)}
          >
            {etiqueta}
          </button>
        ))}
        <span className="cuenta">
          {visibles.length} ticket{visibles.length === 1 ? '' : 's'}
        </span>
      </div>

      {visibles.length ? (
        <div className="tkl">
          {visibles.map((t) => (
            <FilaTicket
              key={t.id}
              ticket={t}
              hoyUy={hoyUy}
              ahoraIso={ahoraIso}
              alerta={debeActuar(cargo, usuarioId, t, esUrgenteHoy(hoyUy)) ? alertaDe(t, hoyUy) : undefined}
              onAbrir={() => abrir('ticket', t.id)}
            />
          ))}
        </div>
      ) : (
        <EstadoSinDatos style={{ justifyContent: 'center', padding: 40 }}>{vacio}</EstadoSinDatos>
      )}
    </>
  );
}
