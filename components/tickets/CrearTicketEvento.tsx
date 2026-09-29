/**
 * "Crear ticket de diseño" desde la ficha del jugador (0028): se elige una de sus próximas
 * fechas de Contenido o "Otra fecha" (fecha + motivo a mano, p. ej. una convocatoria), y la
 * nota. La base valida todo (cargo, fecha no pasada, motivo, Contenido) y el mensaje se
 * muestra tal cual. Botón deshabilitado mientras envía (un doble clic crearía dos).
 *
 * Football First. Creado 2026-09-29.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ico } from '@/components/comunes/Ico';
import { usePanel } from '@/lib/paneles/use-panel';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import { crearTicketEvento } from '@/lib/tickets/acciones';
import { textoEvento } from '@/lib/tickets/vencimiento';
import type { ProximaFecha } from '@/lib/jugadores/datos-contenido';

const OTRA = 'otra';

export function CrearTicketEvento({
  jugadorId,
  jugadorNombre,
  proximas,
  hoyUy,
}: {
  jugadorId: string;
  jugadorNombre: string;
  proximas: ProximaFecha[];
  hoyUy: string;
}) {
  const router = useRouter();
  const { abrir } = usePanel();
  const [abierto, setAbierto] = useState(false);
  const [eleccion, setEleccion] = useState<string>(proximas.length ? '0' : OTRA);
  const [fecha, setFecha] = useState('');
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primerCampoRef = useRef<HTMLInputElement>(null);
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const yaAbierto = useRef(false);

  // Foco: al abrir va a la primera opción; al cancelar vuelve al botón que lo abrió.
  useEffect(() => {
    if (abierto) {
      yaAbierto.current = true;
      primerCampoRef.current?.focus();
    } else if (yaAbierto.current) {
      disparadorRef.current?.focus();
    }
  }, [abierto]);

  const esOtra = eleccion === OTRA;
  const elegida = esOtra ? null : proximas[Number(eleccion)];
  const fechaFinal = esOtra ? fecha : (elegida?.proximaIso ?? '');
  const motivoFinal = esOtra ? motivo : (elegida?.etiqueta ?? '');
  const listo = !!fechaFinal && !!motivoFinal.trim() && !!nota.trim();

  async function crear() {
    setEnviando(true);
    setError(null);
    const r = await crearTicketEvento(crearClienteNavegador(), { jugadorId, fecha: fechaFinal, motivo: motivoFinal, nota });
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
    <div className="tkn tke">
      <fieldset className="tke__f">
        <legend>¿Para qué fecha?</legend>
        {proximas.map((p, i) => (
          <label key={p.etiqueta} className="tke__o">
            <input
              ref={i === 0 ? primerCampoRef : undefined}
              type="radio"
              name={`fecha-${jugadorId}`}
              value={String(i)}
              checked={eleccion === String(i)}
              onChange={() => setEleccion(String(i))}
            />
            {textoEvento(p.etiqueta, p.proximaIso)}
          </label>
        ))}
        <label className="tke__o">
          <input
            ref={proximas.length ? undefined : primerCampoRef}
            type="radio"
            name={`fecha-${jugadorId}`}
            value={OTRA}
            checked={esOtra}
            onChange={() => setEleccion(OTRA)}
          />
          Otra fecha
        </label>
      </fieldset>

      {esOtra && (
        <div className="tke__otra">
          <div className="campo">
            <label htmlFor={`fecha-otra-${jugadorId}`}>Fecha</label>
            <input id={`fecha-otra-${jugadorId}`} type="date" min={hoyUy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor={`motivo-${jugadorId}`}>Motivo</label>
            <input
              id={`motivo-${jugadorId}`}
              type="text"
              maxLength={120}
              placeholder="Convocado a la selección: Uruguay vs Brasil"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="campo">
        <label htmlFor={`nota-evento-${jugadorId}`}>¿Qué hay que hacer?</label>
        <textarea
          id={`nota-evento-${jugadorId}`}
          rows={3}
          maxLength={2000}
          placeholder={`Ej.: pieza para redes por el cumpleaños de ${jugadorNombre}`}
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
        <button type="button" className="btn btn--g btn--sm" disabled={enviando} onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
