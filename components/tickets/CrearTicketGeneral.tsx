/**
 * "Nuevo ticket general" en la pantalla Tickets (0047): encargos que no son de un jugador
 * (piezas de la agencia, eventos, sponsors…). Asunto + día de entrega + qué hay que hacer.
 * La base valida todo (cargo, fecha no pasada, largos) y el mensaje se muestra tal cual.
 * Botón deshabilitado mientras envía (un doble clic crearía dos). Mismos estilos que
 * `CrearTicketEvento`.
 *
 * Football First. Creado 2026-10-28.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ico } from '@/components/comunes/Ico';
import { usePanel } from '@/lib/paneles/use-panel';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import { crearTicketGeneral } from '@/lib/tickets/acciones';

export function CrearTicketGeneral({ hoyUy }: { hoyUy: string }) {
  const router = useRouter();
  const { abrir } = usePanel();
  const [abierto, setAbierto] = useState(false);
  const [asunto, setAsunto] = useState('');
  const [fecha, setFecha] = useState('');
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primerCampoRef = useRef<HTMLInputElement>(null);
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const yaAbierto = useRef(false);

  // Foco: al abrir va al asunto; al cancelar vuelve al botón que lo abrió.
  useEffect(() => {
    if (abierto) {
      yaAbierto.current = true;
      primerCampoRef.current?.focus();
    } else if (yaAbierto.current) {
      disparadorRef.current?.focus();
    }
  }, [abierto]);

  const listo = !!asunto.trim() && !!fecha && !!nota.trim();

  function cerrar() {
    setAbierto(false);
    setAsunto('');
    setFecha('');
    setNota('');
    setError(null);
  }

  async function crear() {
    setEnviando(true);
    setError(null);
    const r = await crearTicketGeneral(crearClienteNavegador(), { fecha, asunto, nota });
    setEnviando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    cerrar();
    router.refresh();
    abrir('ticket', r.valor);
  }

  if (!abierto) {
    return (
      <button ref={disparadorRef} type="button" className="btn btn--a btn--sm" onClick={() => setAbierto(true)}>
        Nuevo ticket general
      </button>
    );
  }

  return (
    <div className="tkn tke" style={{ marginBottom: 24 }}>
      <p className="meta" style={{ marginBottom: 12 }}>
        Para trabajos que no son de un jugador: piezas de la agencia, eventos, sponsors…
      </p>
      <div className="tke__otra">
        <div className="campo">
          <label htmlFor="tkg-asunto">Asunto</label>
          <input
            ref={primerCampoRef}
            id="tkg-asunto"
            type="text"
            maxLength={120}
            placeholder="Ej.: Flyer para el evento de sponsors"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="tkg-fecha">Fecha de entrega</label>
          <input id="tkg-fecha" type="date" min={hoyUy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="tkg-nota">¿Qué hay que hacer?</label>
        <textarea
          id="tkg-nota"
          rows={3}
          maxLength={2000}
          placeholder="Ej.: pieza cuadrada y vertical para Instagram, con el logo de la agencia"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
      </div>
      {error && (
        <div className="aviso" role="alert" style={{ marginBottom: 12 }}>
          <Ico nombre="alerta" clase="ico ico--sm" />
          <span>{error}</span>
        </div>
      )}
      <div className="linea" style={{ gap: 10 }}>
        <button type="button" className="btn btn--a btn--sm" disabled={enviando || !listo} onClick={crear}>
          {enviando ? 'Creando…' : 'Crear ticket'}
        </button>
        <button type="button" className="btn btn--g btn--sm" disabled={enviando} onClick={cerrar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
