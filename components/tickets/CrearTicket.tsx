/**
 * "Crear ticket de diseño" para un jugador de un partido (panel del partido). Solo lo
 * renderiza el padre para Admin/CM. Al crear, abre la tarjeta del ticket nuevo.
 * El botón se deshabilita mientras envía: la base admite 2 tickets por partido, así que
 * un doble clic crearía dos.
 *
 * Football First. Creado 2026-09-28.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ico } from '@/components/comunes/Ico';
import { usePanel } from '@/lib/paneles/use-panel';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import { crearTicket } from '@/lib/tickets/acciones';

export function CrearTicket({ partidoId, jugadorId, jugadorNombre }: { partidoId: string; jugadorId: string; jugadorNombre: string }) {
  const router = useRouter();
  const { abrir } = usePanel();
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idCampo = `nota-${jugadorId}`;
  const notaRef = useRef<HTMLTextAreaElement>(null);
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const yaAbierto = useRef(false);

  // Foco: al abrir el formulario va al campo; al cancelarlo vuelve al botón que lo abrió.
  useEffect(() => {
    if (abierto) {
      yaAbierto.current = true;
      notaRef.current?.focus();
    } else if (yaAbierto.current) {
      disparadorRef.current?.focus();
    }
  }, [abierto]);

  async function crear() {
    setEnviando(true);
    setError(null);
    const r = await crearTicket(crearClienteNavegador(), partidoId, jugadorId, nota);
    if (!r.ok) {
      setEnviando(false);
      setError(r.mensaje);
      return;
    }
    router.refresh();
    abrir('ticket', r.valor);
  }

  if (!abierto) {
    return (
      <button ref={disparadorRef} type="button" className="btn btn--g btn--sm" onClick={() => setAbierto(true)}>
        Crear ticket de diseño
      </button>
    );
  }

  return (
    <div className="tkn">
      <div className="campo">
        <label htmlFor={idCampo}>Qué hay que hacer para {jugadorNombre}</label>
        <textarea
          id={idCampo}
          ref={notaRef}
          rows={3}
          maxLength={2000}
          placeholder="Ej.: diseño del Match Day con la foto de local"
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
        <button type="button" className="btn btn--a btn--sm" disabled={enviando || !nota.trim()} onClick={crear}>
          {enviando ? 'Creando…' : 'Crear ticket'}
        </button>
        <button type="button" className="btn btn--g btn--sm" disabled={enviando} onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
