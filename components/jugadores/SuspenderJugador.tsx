/**
 * "Suspender jugador" al pie de la ficha (panel lateral), solo para Administrador y Community
 * Manager (0049). Pide el motivo (obligatorio) y confirma; la base valida cargo y motivo y el
 * mensaje se muestra tal cual. Al suspender se cierra el panel y la página se recarga: el
 * jugador pasa a la sección "Suspendidos" de Jugadores, desde donde se reactiva.
 *
 * Football First. Creado 2026-11-06.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ico } from '@/components/comunes/Ico';
import { usePanel } from '@/lib/paneles/use-panel';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import { puedeSuspender, suspenderJugador } from '@/lib/jugadores/estado-jugador';

export function SuspenderJugador({
  jugadorId,
  jugadorNombre,
  cargo,
}: {
  jugadorId: string;
  jugadorNombre: string;
  cargo: string | null | undefined;
}) {
  const router = useRouter();
  const { cerrar } = usePanel();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const yaAbierto = useRef(false);

  // Foco: al abrir va al motivo; al cancelar vuelve al botón que lo abrió.
  useEffect(() => {
    if (abierto) {
      yaAbierto.current = true;
      campoRef.current?.focus();
    } else if (yaAbierto.current) {
      disparadorRef.current?.focus();
    }
  }, [abierto]);

  if (!puedeSuspender(cargo)) return null;

  async function suspender() {
    setEnviando(true);
    setError(null);
    const r = await suspenderJugador(crearClienteNavegador(), jugadorId, motivo);
    if (!r.ok) {
      setEnviando(false);
      setError(r.mensaje);
      return;
    }
    cerrar();
    router.refresh();
  }

  return (
    <div className="bloque">
      <span className="label">Estado del jugador</span>
      {!abierto ? (
        <button ref={disparadorRef} type="button" className="btn btn--g btn--sm" onClick={() => setAbierto(true)}>
          Suspender jugador
        </button>
      ) : (
        <div className="tkn tke">
          <p className="meta" style={{ marginBottom: 12 }}>
            {jugadorNombre} deja de aparecer en el plantel, los partidos, el calendario y las fechas importantes. Sus
            datos y su historial se guardan, y lo podés reactivar desde la sección &quot;Suspendidos&quot; de Jugadores.
          </p>
          <div className="campo">
            <label htmlFor={`motivo-susp-${jugadorId}`}>Motivo</label>
            <textarea
              ref={campoRef}
              id={`motivo-susp-${jugadorId}`}
              rows={2}
              maxLength={200}
              placeholder="Ej.: la agencia ya no le ofrece el servicio"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          {error && (
            <div className="aviso" role="alert" style={{ marginBottom: 12 }}>
              <Ico nombre="alerta" clase="ico ico--sm" />
              <span>{error}</span>
            </div>
          )}
          <div className="linea" style={{ gap: 10 }}>
            <button type="button" className="btn btn--a btn--sm" disabled={enviando || !motivo.trim()} onClick={suspender}>
              {enviando ? 'Suspendiendo…' : `Suspender a ${jugadorNombre}`}
            </button>
            <button type="button" className="btn btn--g btn--sm" disabled={enviando} onClick={() => setAbierto(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
