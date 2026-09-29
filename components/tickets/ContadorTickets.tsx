/**
 * Globito con la cantidad de tickets que "te tocan" (ver `pendientesDe`) + desplegable
 * "Lo que te toca", por fecha límite. Cada ítem abre la tarjeta del ticket. Sin pendientes
 * no se renderiza nada. Reusa `.drop` de la demo para el desplegable.
 *
 * Accesibilidad: Escape cierra el desplegable y devuelve el foco al botón del contador.
 *
 * Football First. Creado 2026-09-28.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { rutaPanel } from '@/lib/paneles/use-panel';
import { META_ESTADO } from '@/lib/tickets/estados';
import { textoVencimiento } from '@/lib/tickets/vencimiento';
import type { ResumenTicket } from '@/lib/tickets/tipos';

export function ContadorTickets({ pendientes, hoyUy }: { pendientes: ResumenTicket[]; hoyUy: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAbierto(false);
        botonRef.current?.focus();
      }
    }
    document.addEventListener('click', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('click', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  if (!pendientes.length) return null;
  const n = pendientes.length;

  return (
    <div className="tkc" ref={ref}>
      <button
        type="button"
        ref={botonRef}
        className="tkc__btn"
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-label={`${n} ticket${n === 1 ? '' : 's'} te espera${n === 1 ? '' : 'n'}`}
        onClick={() => setAbierto((v) => !v)}
      >
        <span aria-hidden="true">🎫</span>
        <b>{n}</b>
      </button>
      <div className={abierto ? 'drop on' : 'drop'}>
        <div className="drop__h">
          <div>
            <b>Lo que te toca</b>
            <span>Ordenado por fecha límite</span>
          </div>
        </div>
        {pendientes.map((t) => {
          const vence = textoVencimiento(t.fechaLimite, t.estado, hoyUy);
          return (
            <button
              key={t.id}
              type="button"
              className="tkc__i"
              onClick={() => {
                setAbierto(false);
                router.push(rutaPanel(pathname, 'ticket', t.id), { scroll: false });
              }}
            >
              <span className={`tk tk--${t.estado}`}>
                <span aria-hidden="true">{META_ESTADO[t.estado].simbolo}</span> {META_ESTADO[t.estado].corta}
              </span>
              <span className="tkc__t">
                <b>{t.titulo}</b>
                {vence && <small className={vence.vencido ? 'tk__vence--mal' : ''}>{vence.texto}</small>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
