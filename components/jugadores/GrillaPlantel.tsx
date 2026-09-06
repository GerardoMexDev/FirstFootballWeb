/**
 * Grilla del plantel (vista `jugadores`) — `renderPlantel()` de la demo sobre datos reales.
 * Marcado y clases 1:1 con la demo (`.plantel` / `.jug` / `.jug__*`).
 *
 * Client Component: cada `.jug` es un `<button>` (la demo estiliza `.jug` como botón — ver
 * avances.md §10, "CSS de la demo = button, no <a>") que abre el panel lateral del jugador
 * (`?panel=jugador&id=…`). La ruta `/jugadores/[id]` sigue existiendo como enlace directo.
 *
 * Diferencia con la demo: `.jug__pos` mostraba "posición · liga". No hay una "liga principal"
 * por jugador en el modelo (un club juega varias competencias), así que se muestra
 * "posición · país del club".
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
'use client';

import { useState } from 'react';
import { Escudo } from '@/components/comunes/Escudo';
import { usePanel } from '@/lib/paneles/use-panel';
import type { JugadorPlantel } from '@/lib/repositorios/tipos';

/** Número para las celdas de stats: un guion si no hay dato (nunca "0" inventado, nunca texto largo). */
function numero(valor: number | null): string {
  return valor === null || valor === undefined ? '—' : String(valor);
}

/** "Mediocampista · Chile", saltándose las partes que falten. */
function posicionYPais(jugador: JugadorPlantel): string {
  return [jugador.posicion, jugador.clubPais].filter(Boolean).join(' · ');
}

function TarjetaJugador({
  jugador,
  hitoFrase,
  onAbrir,
}: {
  jugador: JugadorPlantel;
  hitoFrase?: string;
  onAbrir: () => void;
}) {
  const [fotoFallo, setFotoFallo] = useState(false);
  const pill = jugador.clubPais ?? jugador.nacionalidad;

  return (
    <button className="jug" type="button" onClick={onAbrir}>
      <div className="jug__fb" />
      {jugador.fotoUrl && !fotoFallo && (
        // Foto local de /public (no Storage todavía): si falla la carga se oculta y queda
        // el fondo `.jug__fb`, igual que el `onerror="this.remove()"` de la demo.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="jug__foto" src={jugador.fotoUrl} alt="" onError={() => setFotoFallo(true)} />
      )}
      <div className="jug__grad" />
      {jugador.dorsal !== null && <div className="jug__n">{jugador.dorsal}</div>}

      {hitoFrase ? (
        <div className="jug__hito">{hitoFrase}</div>
      ) : (
        pill && <div className="jug__pais">{pill}</div>
      )}

      <div className="jug__txt">
        <b>{jugador.nombre}</b>
        <span className="jug__club">
          <Escudo nombre={jugador.clubNombre ?? '?'} url={jugador.clubEscudoUrl} clase="crest crest--sm" />
          {jugador.clubNombre ?? 'Sin club'}
        </span>
        <span className="jug__pos">{posicionYPais(jugador)}</span>
      </div>

      <div className="jug__stats">
        <div>
          <b>{numero(jugador.carreraPartidos)}</b>
          <span>Partidos</span>
        </div>
        <div>
          <b>{numero(jugador.carreraAsistencias)}</b>
          <span>Asist.</span>
        </div>
        <div>
          <b>{numero(jugador.carreraGoles)}</b>
          <span>Goles</span>
        </div>
      </div>
    </button>
  );
}

export function GrillaPlantel({
  jugadores,
  hitoFrasePorJugador,
}: {
  jugadores: JugadorPlantel[];
  /** id de jugador → frase del hito más próximo (para la pill). Vacío si no tiene ninguno cerca. */
  hitoFrasePorJugador: Record<string, string>;
}) {
  const { abrir } = usePanel();

  return (
    <div className="plantel" id="plantel">
      {jugadores.map((jugador) => (
        <TarjetaJugador
          key={jugador.id}
          jugador={jugador}
          hitoFrase={hitoFrasePorJugador[jugador.id]}
          onAbrir={() => abrir('jugador', jugador.id)}
        />
      ))}
    </div>
  );
}
