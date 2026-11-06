/**
 * Sección "Suspendidos" al pie de la página Jugadores (0049): quiénes están suspendidos, desde
 * cuándo, por qué y quién lo hizo, con "Reactivar" para Administrador y Community Manager. Al
 * reactivar vuelve con los servicios (Match Day / Contenido) que tenía. Si no hay suspendidos,
 * no se muestra nada.
 *
 * Football First. Creado 2026-11-06.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import { Ico } from '@/components/comunes/Ico';
import { crearClienteNavegador } from '@/lib/supabase/cliente-navegador';
import { puedeSuspender, reactivarJugador } from '@/lib/jugadores/estado-jugador';
import { fechaCortaUy } from '@/lib/tickets/vencimiento';
import type { JugadorSuspendido } from '@/lib/repositorios/tipos';

/** "Match Day y Contenido" / "Contenido" / "sin servicios": lo que recupera al reactivar. */
function servicios(j: JugadorSuspendido): string {
  const s = [j.matchDay && 'Match Day', j.contenido && 'Contenido'].filter(Boolean);
  return s.length ? s.join(' y ') : 'sin servicios';
}

function FilaSuspendido({ jugador: j, puedeReactivar }: { jugador: JugadorSuspendido; puedeReactivar: boolean }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reactivar() {
    if (!window.confirm(`¿Reactivar a ${j.nombre}? Vuelve al plantel con ${servicios(j)}.`)) return;
    setEnviando(true);
    setError(null);
    const r = await reactivarJugador(crearClienteNavegador(), j.id);
    if (!r.ok) {
      setEnviando(false);
      setError(r.mensaje);
      return;
    }
    router.refresh();
  }

  // Día de Uruguay (no el UTC del timestamp: una suspensión a las 22 h de UY ya es "mañana" en UTC).
  const diaUy = j.suspendidoEn ? DateTime.fromISO(j.suspendidoEn).setZone(ZONA_AGENCIA).toISODate() : null;
  const cuando = diaUy ? `Desde el ${fechaCortaUy(diaUy)}` : null;
  return (
    <li className="susp__f">
      <div className="susp__t">
        <b>{j.nombre}</b>
        <span className="meta">
          {[cuando, j.suspendidoPorNombre && `por ${j.suspendidoPorNombre}`, `servicio: ${servicios(j)}`]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <span className="meta">{j.motivo ? `Motivo: ${j.motivo}` : 'Sin motivo registrado.'}</span>
        {error && (
          <span className="aviso" role="alert">
            <Ico nombre="alerta" clase="ico ico--sm" />
            <span>{error}</span>
          </span>
        )}
      </div>
      {puedeReactivar && (
        <button type="button" className="btn btn--g btn--sm" disabled={enviando} onClick={reactivar}>
          {enviando ? 'Reactivando…' : 'Reactivar'}
        </button>
      )}
    </li>
  );
}

export function SeccionSuspendidos({ jugadores, cargo }: { jugadores: JugadorSuspendido[]; cargo: string | null }) {
  if (!jugadores.length) return null;
  return (
    <section className="susp" aria-labelledby="susp-titulo">
      <h2 id="susp-titulo" className="d3">
        Suspendidos <span className="meta">({jugadores.length})</span>
      </h2>
      <p className="meta">No aparecen en el plantel, los partidos ni el calendario. Sus datos se conservan.</p>
      <ul className="susp__l">
        {jugadores.map((j) => (
          <FilaSuspendido key={j.id} jugador={j} puedeReactivar={puedeSuspender(cargo)} />
        ))}
      </ul>
    </section>
  );
}
