/**
 * Buscador global ⌘K: `.busca` de la demo. Renderiza el botón de la barra superior y el
 * modal. Se abre con ⌘/Ctrl+K o clic en el botón; la data (plantel + próximos partidos) se
 * precarga la primera vez que se abre y se filtra en el cliente al tipear (`lib/buscador`).
 *
 * Un resultado abre el panel lateral correspondiente (`?panel=jugador|partido&id=…`, misma
 * URL que usa `usePanel` — acá se arma directo para no depender de `useSearchParams`).
 *
 * Accesibilidad como el resto de los overlays: foco al input al abrir, Escape y clic en el
 * fondo cierran, Tab queda dentro del modal, y al cerrar el foco vuelve al botón.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Ico } from '@/components/comunes/Ico';
import { Escudo } from '@/components/comunes/Escudo';
import { CaraJugador } from '@/components/comunes/CaraJugador';
import { buscar } from '@/lib/buscador/indexar';
import { rutaPanel } from '@/lib/paneles/use-panel';
import { etiquetaDiaUy, horaCortaEnUruguay } from '@/lib/fechas/zonas';
import { mostrar } from '@/lib/formato/valores';
import type { JugadorPlantel, PartidoProximo } from '@/lib/repositorios/tipos';

const FOCOS = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

interface Datos {
  jugadores: JugadorPlantel[];
  partidos: PartidoProximo[];
}

export function Buscador() {
  const router = useRouter();
  const pathname = usePathname();

  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(false);

  const botonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const cajaRef = useRef<HTMLDivElement>(null);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setConsulta('');
    botonRef.current?.focus();
  }, []);

  // ⌘K / Ctrl+K global
  useEffect(() => {
    function alTeclado(evento: KeyboardEvent) {
      if ((evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault();
        setAbierto((v) => !v);
      }
    }
    document.addEventListener('keydown', alTeclado);
    return () => document.removeEventListener('keydown', alTeclado);
  }, []);

  // Al abrir: foco al input + precargar la data una sola vez.
  useEffect(() => {
    if (!abierto) return;
    inputRef.current?.focus();
    if (datos || cargando) return;
    setCargando(true);
    fetch('/api/buscador')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Datos) => setDatos(d))
      .catch(() => setDatos({ jugadores: [], partidos: [] }))
      .finally(() => setCargando(false));
  }, [abierto, datos, cargando]);

  const resultados = datos
    ? buscar(consulta, datos.jugadores, datos.partidos)
    : { jugadores: [], partidos: [], vacia: true };
  const sinResultados = !cargando && resultados.jugadores.length === 0 && resultados.partidos.length === 0;

  function irA(tipo: 'jugador' | 'partido', id: string) {
    cerrar();
    router.push(rutaPanel(pathname, tipo, id), { scroll: false });
  }

  function alTecladoModal(evento: React.KeyboardEvent) {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      cerrar();
      return;
    }
    if (evento.key !== 'Tab' || !cajaRef.current) return;
    const focos = Array.from(cajaRef.current.querySelectorAll<HTMLElement>(FOCOS)).filter(
      (el) => el.offsetParent !== null,
    );
    if (focos.length === 0) return;
    const primero = focos[0];
    const ultimo = focos[focos.length - 1];
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  return (
    <>
      <button ref={botonRef} className="buscabtn" type="button" aria-label="Buscar" onClick={() => setAbierto(true)}>
        <svg className="ico" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.6-3.6" />
        </svg>
        <span>Buscar</span>
        <kbd>⌘K</kbd>
      </button>

      {abierto && (
        <div
          ref={modalRef}
          className="busca on"
          role="dialog"
          aria-modal="true"
          aria-label="Buscar"
          onKeyDown={alTecladoModal}
          onClick={(evento) => {
            if (evento.target === modalRef.current) cerrar();
          }}
        >
          <div className="busca__c" ref={cajaRef}>
            <div className="busca__i">
              <svg className="ico" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.6-3.6" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar jugador, club, rival, competencia o país…"
                autoComplete="off"
                value={consulta}
                onChange={(evento) => setConsulta(evento.target.value)}
              />
              <kbd>ESC</kbd>
            </div>

            <div className="busca__r">
              {cargando && <div className="busca__v">Buscando…</div>}

              {sinResultados && (
                <div className="busca__v">
                  {resultados.vacia ? 'No hay próximos partidos.' : 'Nada coincide con esa búsqueda.'}
                </div>
              )}

              {resultados.jugadores.length > 0 && (
                <>
                  <div className="busca__g">Jugadores ({resultados.jugadores.length})</div>
                  {resultados.jugadores.map((j) => (
                    <button className="res" type="button" key={j.id} onClick={() => irA('jugador', j.id)}>
                      <CaraJugador nombre={j.nombre} fotoUrl={j.fotoUrl} clase="" />
                      <div>
                        <b>{j.nombre}</b>
                        <span>{[j.clubNombre, j.clubPais].filter(Boolean).join(' · ') || mostrar(j.posicion)}</span>
                      </div>
                      <Ico nombre="chevron" clase="ico ico--sm" />
                    </button>
                  ))}
                </>
              )}

              {resultados.partidos.length > 0 && (
                <>
                  <div className="busca__g">
                    {resultados.vacia ? 'Próximos partidos' : `Partidos (${resultados.partidos.length})`}
                  </div>
                  {resultados.partidos.map((p) => (
                    <button className="res" type="button" key={p.partidoId} onClick={() => irA('partido', p.partidoId)}>
                      <Escudo nombre={p.clubNombre ?? '?'} url={p.clubEscudoUrl} clase="crest" />
                      <div>
                        <b>
                          {mostrar(p.clubNombre)} vs {mostrar(p.rivalNombre)}
                        </b>
                        <span>
                          {[
                            p.competenciaNombre,
                            p.diaUy ? etiquetaDiaUy(p.diaUy) : null,
                            p.inicioUtc ? `${horaCortaEnUruguay(p.inicioUtc)} UY` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                      <Ico nombre="chevron" clase="ico ico--sm" />
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
