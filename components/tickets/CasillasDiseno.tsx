/**
 * Las dos casillas del ticket automático de Match Day (0030): "Pendiente" (tildada desde el
 * inicio, informativa) y "Completado" (solo el Diseñador la cambia, cuando subió el diseño a
 * Dropbox). La base valida el cargo (`diseno_partido_marcar`); acá solo se deshabilita para el
 * resto. Después de cambiar: `router.refresh()` para que calendario, globito y tarjetas se
 * actualicen.
 *
 * Football First. Creado 2026-09-30.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import { marcarDiseno } from '@/lib/tickets/acciones';

export function CasillasDiseno({
  partidoId,
  jugadorId,
  jugadorNombre,
  completado,
  puedeMarcar,
  onCambio,
}: {
  partidoId: string;
  jugadorId: string;
  jugadorNombre: string;
  completado: boolean;
  /** Solo el Diseñador. */
  puedeMarcar: boolean;
  /** Para recargar el panel que las contiene (el partido). */
  onCambio?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(completado);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(nuevo: boolean) {
    setEnviando(true);
    setError(null);
    const r = await marcarDiseno(crearClienteNavegador(), partidoId, jugadorId, nuevo);
    if (!r.ok) {
      setEnviando(false);
      setError(r.mensaje);
      return;
    }
    setValor(nuevo);
    router.refresh();
    try {
      await onCambio?.();
    } catch {
      // Si la recarga falla, la marca ya se guardó.
    }
    setEnviando(false);
  }

  return (
    <span className="csds">
      <label className="csd">
        <input type="checkbox" checked disabled readOnly />
        Pendiente
      </label>
      <label className="csd">
        <input
          type="checkbox"
          checked={valor}
          disabled={!puedeMarcar || enviando}
          aria-label={`Completado — ${jugadorNombre}`}
          onChange={(e) => void cambiar(e.target.checked)}
        />
        Completado
      </label>
      {error && (
        <span role="alert" className="csd__err">
          {error}
        </span>
      )}
    </span>
  );
}
