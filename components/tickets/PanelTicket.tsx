/**
 * Tarjeta del ticket de diseño (panel lateral, `?panel=ticket&id=…`). De arriba a abajo:
 * estado + título + partido + fecha límite, nota, "Abrir diseño", botones según quién mira
 * (`accionesPermitidas`, espejo de la base), conversación imborrable y caja de comentario.
 *
 * Toda escritura va por `ejecutarAccion` (funciones de la base). Después de cada acción:
 * `onActualizar()` (recarga el panel) + `router.refresh()` (chip del calendario y contador).
 *
 * Football First. Creado 2026-09-28.
 */
'use client';

import { useRef, useState } from 'react';
import { usePanel } from '@/lib/paneles/use-panel';
import { useRouter } from 'next/navigation';
import { Ico } from '@/components/comunes/Ico';
import { PastillaEstado } from '@/components/tickets/PastillaEstado';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import { ejecutarAccion } from '@/lib/tickets/acciones';
import { accionesPermitidas } from '@/lib/tickets/permisos';
import { fechaHoraCortaUy, textoVencimiento } from '@/lib/tickets/vencimiento';
import type { DetalleTicketBundle } from '@/lib/tickets/cargar-detalle-ticket';
import type { Accion, EventoHistorial } from '@/lib/tickets/tipos';

/** Acciones que abren un campo obligatorio antes de confirmar. */
const CON_CAMPO: Partial<Record<Accion, { etiqueta: string; placeholder: string; boton: string; esLink?: boolean }>> = {
  entregar: { etiqueta: 'Link de Dropbox del diseño', placeholder: 'https://www.dropbox.com/…', boton: 'Entregar para revisión', esLink: true },
  devolver: { etiqueta: 'Qué hay que corregir', placeholder: 'Ej.: cambiá el fondo por el de local', boton: 'Devolver al Diseñador' },
  cancelar: { etiqueta: 'Por qué se cancela', placeholder: 'Ej.: el partido no se cubre', boton: 'Cancelar ticket' },
};

const BOTON: Record<Exclude<Accion, 'comentar'>, { texto: string; clase: string }> = {
  entregar: { texto: 'Entregar', clase: 'btn btn--a' },
  aprobar: { texto: 'Aprobar', clase: 'btn btn--a' },
  devolver: { texto: 'Devolver', clase: 'btn btn--g' },
  publicar: { texto: 'Marcar publicado', clase: 'btn btn--a' },
  cancelar: { texto: 'Cancelar ticket', clase: 'btn btn--g' },
};

/** Aviso para lector de pantalla después de cada acción exitosa. */
const AVISO_OK: Record<Accion, string> = {
  entregar: 'Listo: diseño entregado para revisión.',
  aprobar: 'Listo: ticket aprobado.',
  devolver: 'Listo: ticket devuelto al Diseñador.',
  publicar: 'Listo: ticket marcado como publicado.',
  cancelar: 'Listo: ticket cancelado.',
  comentar: 'Comentario agregado.',
};

const TITULO_EVENTO: Record<EventoHistorial['tipo'], string> = {
  creado: 'creó el ticket',
  comentario: 'comentó',
  entrega: 'entregó el diseño',
  aprobado: 'aprobó',
  devuelto: 'lo devolvió con correcciones',
  publicado: 'lo marcó como publicado',
  cancelado: 'lo canceló',
  sistema: 'Aviso del sistema',
};

export function PanelTicket({ bundle, onActualizar }: { bundle: DetalleTicketBundle; onActualizar: () => Promise<void> }) {
  const router = useRouter();
  const { abrir } = usePanel();
  const { ticket, historial, usuario, hoyUy } = bundle;
  const acciones = accionesPermitidas({
    cargo: usuario.cargo,
    esCreador: ticket.creadoPor === usuario.id,
    estado: ticket.estado,
  });
  const vence = textoVencimiento(ticket.fechaLimite, ticket.estado, hoyUy);

  const [abierta, setAbierta] = useState<Accion | null>(null);
  const [campo, setCampo] = useState('');
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const tituloRef = useRef<HTMLHeadingElement>(null);

  async function correr(accion: Accion, datos: { texto?: string; link?: string }) {
    setEnviando(true);
    setError(null);
    const r = await ejecutarAccion(crearClienteNavegador(), accion, ticket.id, datos);
    if (!r.ok) {
      setEnviando(false);
      setError(r.mensaje);
      return;
    }
    // Se sigue "enviando" hasta que el panel muestre el estado nuevo: así no reaparecen los botones viejos.
    router.refresh();
    try {
      await onActualizar();
    } catch {
      // Si la recarga falla se sigue igual: la acción ya se guardó.
    }
    setEnviando(false);
    setAbierta(null);
    setCampo('');
    setComentario('');
    setAviso(AVISO_OK[accion]);
    // El botón que se apretó puede desaparecer al cambiar el estado: el foco va a un lugar estable.
    tituloRef.current?.focus();
  }

  function alBoton(accion: Accion) {
    if (CON_CAMPO[accion]) {
      setAbierta(accion);
      setCampo('');
      setError(null);
      return;
    }
    void correr(accion, {});
  }

  const formulario = abierta ? CON_CAMPO[abierta] : undefined;

  return (
    <>
      <div role="status" className="solo-lector">{aviso}</div>
      <div className="linea" style={{ marginBottom: 14 }}>
        <PastillaEstado estado={ticket.estado} />
        {vence && (
          <span className={vence.vencido ? 'tk__vence tk__vence--mal' : 'tk__vence'}>
            {vence.vencido ? '⚠️ ' : ''}
            {vence.texto}
          </span>
        )}
      </div>
      <h2 ref={tituloRef} tabIndex={-1} className="d2" style={{ marginBottom: 10, outline: 'none' }}>{ticket.titulo}</h2>
      <p className="meta" style={{ marginBottom: 24 }}>
        {ticket.partidoEliminado
          ? 'El partido ya no figura en la fuente de datos.'
          : ticket.inicioUtc
            ? `Partido: ${fechaHoraCortaUy(ticket.inicioUtc)} (hora Uruguay)`
            : 'Partido sin hora confirmada'}
        {ticket.creadoPorNombre ? ` · Lo pidió ${ticket.creadoPorNombre}` : ''}
      </p>

      <div className="bloque">
        <span className="label">Qué hay que hacer</span>
        <p className="tk__nota">{ticket.nota}</p>
      </div>

      {(ticket.linkEntrega || (ticket.partidoId && !ticket.partidoEliminado)) && (
        <div className="linea" style={{ gap: 10, marginBottom: 24 }}>
          {ticket.linkEntrega && (
            <a href={ticket.linkEntrega} target="_blank" rel="noopener noreferrer" className="btn btn--g">
              Abrir diseño
            </a>
          )}
          {ticket.partidoId && !ticket.partidoEliminado && (
            <button type="button" className="btn btn--g" onClick={() => abrir('partido', ticket.partidoId!)}>
              Ver partido
            </button>
          )}
        </div>
      )}

      {acciones.some((a) => a !== 'comentar') && !formulario && (
        <div className="linea" style={{ gap: 10, marginBottom: 24 }}>
          {acciones
            .filter((a): a is Exclude<Accion, 'comentar'> => a !== 'comentar')
            .map((a) => (
              <button key={a} type="button" className={BOTON[a].clase} disabled={enviando} onClick={() => alBoton(a)}>
                {BOTON[a].texto}
              </button>
            ))}
        </div>
      )}

      {formulario && abierta && (
        <div className="bloque">
          <div className="campo">
            <label htmlFor="tk-campo">{formulario.etiqueta}</label>
            {formulario.esLink ? (
              <input id="tk-campo" type="url" required aria-required="true" inputMode="url" placeholder={formulario.placeholder} value={campo} onChange={(e) => setCampo(e.target.value)} />
            ) : (
              <textarea id="tk-campo" rows={3} required aria-required="true" maxLength={2000} placeholder={formulario.placeholder} value={campo} onChange={(e) => setCampo(e.target.value)} />
            )}
          </div>
          <div className="linea" style={{ gap: 10 }}>
            <button
              type="button"
              className="btn btn--a"
              disabled={enviando || !campo.trim()}
              onClick={() => correr(abierta, formulario.esLink ? { link: campo } : { texto: campo })}
            >
              {enviando ? 'Guardando…' : formulario.boton}
            </button>
            <button type="button" className="btn btn--g" disabled={enviando} onClick={() => {
                setAbierta(null);
                setError(null);
              }}>
              Volver
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="aviso" role="alert" style={{ marginBottom: 20 }}>
          <Ico nombre="alerta" clase="ico ico--sm" />
          <span>{error}</span>
        </div>
      )}

      <div className="bloque">
        <span className="label">Conversación</span>
        <ol className="tkh">
          {historial.map((h) => (
            <li key={h.id} className={`tkh__i tkh__i--${h.tipo}`}>
              <div className="tkh__c">
                <b>{h.tipo === 'sistema' ? TITULO_EVENTO.sistema : `${h.autorNombre ?? 'Alguien'} ${TITULO_EVENTO[h.tipo]}`}</b>
                <time dateTime={h.creadoEn}>{fechaHoraCortaUy(h.creadoEn)}</time>
              </div>
              {h.texto && <p>{h.texto}</p>}
              {h.link && (
                <a href={h.link} target="_blank" rel="noopener noreferrer">
                  Ver esta entrega
                </a>
              )}
            </li>
          ))}
        </ol>
      </div>

      {acciones.includes('comentar') && (
        <div className="bloque">
          <div className="campo">
            <label htmlFor="tk-comentario">Escribir en la conversación</label>
            <textarea id="tk-comentario" rows={3} maxLength={2000} value={comentario} onChange={(e) => setComentario(e.target.value)} />
          </div>
          <button type="button" className="btn btn--g" disabled={enviando || !comentario.trim()} onClick={() => correr('comentar', { texto: comentario })}>
            {enviando ? 'Enviando…' : 'Comentar'}
          </button>
        </div>
      )}
    </>
  );
}
