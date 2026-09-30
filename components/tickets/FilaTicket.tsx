/**
 * Una fila de la pantalla Tickets: semáforo + título, vencimiento (rojo si venció), quién lo
 * creó y cuándo, y la lucecita si vence pronto o venció. La zona del título es un botón que abre
 * el ticket (manual) o el partido (automático de Match Day, 0030). En los automáticos, al lado,
 * las casillas Pendiente/Completado (fuera del botón: un checkbox no puede ir dentro de otro
 * control). Estilos `.tkf` en app.css.
 *
 * Football First. Creado 2026-09-29.
 */
'use client';

import { AlertaTicket } from '@/components/tickets/AlertaTicket';
import { CasillasDiseno } from '@/components/tickets/CasillasDiseno';
import { PastillaEstado } from '@/components/tickets/PastillaEstado';
import { PastillaSemaforo } from '@/components/tickets/PastillaSemaforo';
import { META_VISUAL, estadoVisual } from '@/lib/tickets/semaforo';
import { textoCreado } from '@/lib/tickets/pantalla';
import { textoVencimiento } from '@/lib/tickets/vencimiento';
import type { ResumenTicket } from '@/lib/tickets/tipos';

export function FilaTicket({
  ticket: t,
  hoyUy,
  ahoraIso,
  alerta,
  puedeMarcar = false,
  onAbrir,
}: {
  ticket: ResumenTicket;
  hoyUy: string;
  ahoraIso: string;
  /** "Vencido" / "Vence pronto" si le toca a quien mira. */
  alerta?: string;
  /** Solo el Diseñador tilda Completado en los automáticos. */
  puedeMarcar?: boolean;
  onAbrir: () => void;
}) {
  const venc = textoVencimiento(t.fechaLimite, t.estado, hoyUy);
  const visual = estadoVisual(t, hoyUy);
  const creado = t.automatico ? 'Match Day automático' : textoCreado(t, ahoraIso);
  // Nombre accesible completo: el lector no tiene que recorrer los hijos.
  const etiqueta = [t.titulo, visual ? META_VISUAL[visual].etiqueta : 'Cancelado', venc?.texto, creado, alerta].filter(Boolean).join('. ');
  return (
    <div className="tkf">
      <button type="button" className="tkf__abrir" aria-label={etiqueta} onClick={onAbrir}>
        <span className="tkf__1">
          {visual ? <PastillaSemaforo estado={visual} /> : <PastillaEstado estado={t.estado} />}
          <b>{t.titulo}</b>
        </span>
        <span className="tkf__2">
          {venc && <span className={venc.vencido ? 'tk__vence--mal' : undefined}>{venc.texto}</span>}
          <span>{creado}</span>
          {alerta && <AlertaTicket texto={alerta} />}
        </span>
      </button>
      {t.automatico && t.partidoId && (
        <CasillasDiseno
          partidoId={t.partidoId}
          jugadorId={t.jugadorId}
          jugadorNombre={t.jugadorNombre}
          completado={t.estado === 'publicado'}
          puedeMarcar={puedeMarcar}
        />
      )}
    </div>
  );
}
