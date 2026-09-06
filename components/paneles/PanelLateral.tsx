/**
 * Panel lateral de detalle (`.panel` + `.velo` de la demo). Una sola instancia, vive en el
 * shell (`app/(app)/layout.tsx`). Se abre/cierra por la URL (`?panel=jugador|partido&id=…`,
 * ver `usePanel`); acá se traduce ese estado a las clases `.on`, se traen los datos del
 * endpoint correspondiente y se maneja la accesibilidad del diálogo.
 *
 * Comportamiento igual que `mostrarPanel`/`cerrarPanel` de la demo:
 *  - al abrir: se guarda el foco previo y se lleva el foco al botón "Cerrar".
 *  - Escape, clic en el velo o en la X → cierra.
 *  - Tab queda atrapado dentro del panel mientras está abierto.
 *  - al cerrar: el foco vuelve a donde estaba.
 * Durante la animación de salida se deja el contenido anterior visible (el panel está
 * `aria-hidden` así que no se anuncia); la próxima apertura lo reemplaza.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';
import { PanelJugador } from '@/components/paneles/PanelJugador';
import { PanelPartido } from '@/components/paneles/PanelPartido';
import { PanelPerfil, type PerfilBundle } from '@/components/paneles/PanelPerfil';
import { usePanel } from '@/lib/paneles/use-panel';
import type { FichaJugadorBundle } from '@/lib/jugadores/cargar-ficha';
import type { DetallePartidoBundle } from '@/lib/paneles/cargar-detalle-partido';

type PestanaPerfil = 'datos' | 'clave' | 'avisos';

type Contenido =
  | { fase: 'cargando' }
  | { fase: 'error'; mensaje: string }
  | { fase: 'jugador'; datos: FichaJugadorBundle }
  | { fase: 'partido'; datos: DetallePartidoBundle }
  | { fase: 'perfil'; datos: PerfilBundle };

const FOCOS = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function PanelLateral() {
  const { tipo, id, cerrar } = usePanel();
  // perfil no necesita id (el id, si viene, es la pestaña inicial); jugador/partido sí.
  const abierto = tipo === 'perfil' || (tipo !== null && id !== null);

  const [contenido, setContenido] = useState<Contenido | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);

  // Traer los datos al abrir / cambiar de entidad. Mientras no está abierto no se toca el
  // contenido (así queda visible durante la animación de salida).
  useEffect(() => {
    if (!abierto || !tipo) return;
    let vivo = true;
    setContenido({ fase: 'cargando' });

    const url = tipo === 'perfil' ? '/api/paneles/perfil' : `/api/paneles/${tipo}?id=${encodeURIComponent(id!)}`;
    fetch(url)
      .then(async (respuesta) => {
        if (!vivo) return;
        if (respuesta.status === 404) {
          setContenido({ fase: 'error', mensaje: `No encontramos ese ${tipo}.` });
          return;
        }
        if (!respuesta.ok) {
          setContenido({ fase: 'error', mensaje: 'No pudimos cargar el detalle. Probá de nuevo.' });
          return;
        }
        const datos = await respuesta.json();
        if (!vivo) return;
        if (tipo === 'jugador') setContenido({ fase: 'jugador', datos });
        else if (tipo === 'partido') setContenido({ fase: 'partido', datos });
        else setContenido({ fase: 'perfil', datos });
      })
      .catch(() => {
        if (vivo) setContenido({ fase: 'error', mensaje: 'No pudimos cargar el detalle. Probá de nuevo.' });
      });

    return () => {
      vivo = false;
    };
  }, [abierto, tipo, id]);

  // Foco: al abrir, guardar el actual y llevar al botón Cerrar; al cerrar, restaurar.
  useEffect(() => {
    if (abierto) {
      focoPrevio.current = document.activeElement as HTMLElement | null;
      const t = window.setTimeout(() => cerrarRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    const previo = focoPrevio.current;
    if (previo && document.contains(previo)) previo.focus();
  }, [abierto]);

  const alTeclado = useCallback(
    (evento: React.KeyboardEvent<HTMLElement>) => {
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        cerrar();
        return;
      }
      if (evento.key !== 'Tab' || !panelRef.current) return;
      const focos = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCOS)).filter(
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
    },
    [cerrar],
  );

  const titulo =
    tipo === 'jugador'
      ? 'Ficha del jugador'
      : tipo === 'partido'
        ? 'Detalle del partido'
        : tipo === 'perfil'
          ? 'Mi cuenta'
          : 'Detalle';

  return (
    <>
      <div className={`velo ${abierto ? 'on' : ''}`} onClick={cerrar} />
      <aside
        ref={panelRef}
        className={`panel ${abierto ? 'on' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-t"
        aria-hidden={!abierto}
        onKeyDown={alTeclado}
      >
        <div className="panel__top">
          <span className="label" id="panel-t">
            {titulo}
          </span>
          <button ref={cerrarRef} className="panel__x" type="button" aria-label="Cerrar" onClick={cerrar}>
            <svg className="ico" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="panel__b">
          {contenido?.fase === 'cargando' && <div className="sinDato">Cargando el detalle…</div>}
          {contenido?.fase === 'error' && <EstadoSinDatos>{contenido.mensaje}</EstadoSinDatos>}
          {contenido?.fase === 'jugador' && <PanelJugador bundle={contenido.datos} />}
          {contenido?.fase === 'partido' && <PanelPartido bundle={contenido.datos} />}
          {contenido?.fase === 'perfil' && (
            <PanelPerfil
              bundle={contenido.datos}
              pestanaInicial={
                id === 'clave' || id === 'avisos' || id === 'datos' ? (id as PestanaPerfil) : 'datos'
              }
            />
          )}
        </div>
      </aside>
    </>
  );
}
