/**
 * Las casillas del ticket automático de Match Day: "Pendiente" (tildada desde el inicio,
 * informativa), "Completado" (solo el Diseñador, cuando subió el diseño a Dropbox; 0030) y
 * "Cancelado" (Administrador, CM o Diseñador, con motivo obligatorio; 0040 — p. ej. el jugador
 * pidió no hacerlo). Completado y Cancelado se excluyen: la base guarda una sola marca.
 * La base valida el cargo (`diseno_partido_marcar` / `diseno_partido_cancelar`); acá solo se
 * deshabilita para el resto. Después de cambiar: `router.refresh()` para que calendario, globito
 * y tarjetas se actualicen.
 *
 * Football First. Creado 2026-09-30. Cancelado: 2026-10-05.
 */
'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import { cancelarDiseno, marcarDiseno, type Resultado } from '@/lib/tickets/acciones';

type Marca = 'pendiente' | 'completado' | 'cancelado';

export function CasillasDiseno({
  partidoId,
  jugadorId,
  jugadorNombre,
  marca: marcaInicial,
  motivoCancelacion = null,
  puedeMarcar,
  puedeCancelar,
  sinPendiente = false,
  onCambio,
}: {
  partidoId: string;
  jugadorId: string;
  jugadorNombre: string;
  /** Estado guardado: sin marca (pendiente/vencido), completado o cancelado. */
  marca: Marca;
  motivoCancelacion?: string | null;
  /** Completado: solo el Diseñador. */
  puedeMarcar: boolean;
  /** Cancelado: Administrador, Community Manager y Diseñador. */
  puedeCancelar: boolean;
  /** Para recargar el panel que las contiene (el partido). */
  /** Tarjeta de /partidos: sin la casilla fija "Pendiente" (el semáforo ya lo dice). */
  sinPendiente?: boolean;
  onCambio?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const idMotivo = useId();
  const [marca, setMarca] = useState<Marca>(marcaInicial);
  const [motivo, setMotivo] = useState(motivoCancelacion ?? '');
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Optimista: la marca cambia al instante y vuelve atrás si el servidor la rechaza. */
  async function guardar(nueva: Marca, llamada: () => Promise<Resultado<null>>) {
    const anterior = marca;
    setMarca(nueva);
    setEnviando(true);
    setError(null);
    const r = await llamada();
    if (!r.ok) {
      setMarca(anterior);
      setEnviando(false);
      setError(r.mensaje);
      return false;
    }
    router.refresh();
    try {
      await onCambio?.();
    } catch {
      // Si la recarga falla, la marca ya se guardó.
    }
    setEnviando(false);
    return true;
  }

  function cambiarCompletado(nuevo: boolean) {
    void guardar(nuevo ? 'completado' : 'pendiente', () =>
      marcarDiseno(crearClienteNavegador(), partidoId, jugadorId, nuevo),
    );
  }

  function cambiarCancelado(nuevo: boolean) {
    setError(null);
    if (nuevo) {
      // Primero el motivo; se guarda al confirmar.
      setPidiendoMotivo(true);
      return;
    }
    void guardar('pendiente', () => cancelarDiseno(crearClienteNavegador(), partidoId, jugadorId, null)).then((ok) => {
      if (ok) setMotivo('');
    });
  }

  async function confirmarCancelacion() {
    const texto = motivo.trim();
    if (!texto) {
      setError('Escribí el motivo de la cancelación.');
      return;
    }
    const ok = await guardar('cancelado', () => cancelarDiseno(crearClienteNavegador(), partidoId, jugadorId, texto));
    if (ok) setPidiendoMotivo(false);
  }

  return (
    // Frena la propagación: dentro de la tarjeta de /partidos (clickeable) no debe abrir el panel.
    <span className="csds" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {!sinPendiente && (
        <label className="csd">
          <input type="checkbox" checked disabled readOnly />
          Pendiente
        </label>
      )}
      <label className="csd">
        <input
          type="checkbox"
          checked={marca === 'completado'}
          disabled={!puedeMarcar || enviando}
          aria-label={`Completado — ${jugadorNombre}`}
          onChange={(e) => cambiarCompletado(e.target.checked)}
        />
        Completado
      </label>
      <label className="csd csd--cancelado">
        <input
          type="checkbox"
          checked={marca === 'cancelado' || pidiendoMotivo}
          disabled={!puedeCancelar || enviando}
          aria-label={`Cancelado — ${jugadorNombre}`}
          onChange={(e) => (pidiendoMotivo && !e.target.checked ? setPidiendoMotivo(false) : cambiarCancelado(e.target.checked))}
        />
        Cancelado
      </label>

      {pidiendoMotivo && (
        <span className="campo csd__motivo">
          <label htmlFor={idMotivo}>¿Por qué no se hace este Match Day?</label>
          <input
            id={idMotivo}
            type="text"
            value={motivo}
            maxLength={300}
            placeholder="Ej.: el jugador pidió no hacerlo (amistoso)"
            autoFocus
            onChange={(e) => setMotivo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void confirmarCancelacion();
              if (e.key === 'Escape') setPidiendoMotivo(false);
            }}
          />
          <span className="csd__acc">
            <button type="button" className="btn btn--sm" disabled={enviando} onClick={() => void confirmarCancelacion()}>
              Cancelar Match Day
            </button>
            <button type="button" className="btn btn--g btn--sm" disabled={enviando} onClick={() => setPidiendoMotivo(false)}>
              Volver
            </button>
          </span>
        </span>
      )}

      {marca === 'cancelado' && !pidiendoMotivo && motivo && <span className="csd__nota">Motivo: {motivo}</span>}

      {error && (
        <span role="alert" className="csd__err">
          {error}
        </span>
      )}
    </span>
  );
}
