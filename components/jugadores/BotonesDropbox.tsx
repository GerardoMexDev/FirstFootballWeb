/**
 * Botones "Fotografías" / "Match Day" → carpetas de Dropbox del jugador (accesos del
 * diseñador). Se usan en la ficha del jugador, el panel del partido, la tarjeta de la lista
 * de partidos y el hero — el diseñador los quiere a mano sin ir hasta Jugadores.
 *
 * - Sin link cargado, el botón queda deshabilitado (no se inventa ni se oculta).
 * - Abren Dropbox en una pestaña nueva y NO disparan el clic/Enter del contenedor: en la
 *   tarjeta y el hero, que abren el panel del partido, el evento se corta acá.
 * - Los links llegan ya saneados (`linkSeguro`, solo https).
 *
 * Football First. Extraído de FichaJugador 2026-09-28.
 */
'use client';

import type { CSSProperties, SyntheticEvent } from 'react';
import type { LinksDropbox } from '@/lib/jugadores/links-dropbox';

/** Corta la propagación para que el contenedor clickeable no abra su panel. */
function frenar(evento: SyntheticEvent) {
  evento.stopPropagation();
}

function Boton({
  url,
  texto,
  clase,
  nombreJugador,
}: {
  url: string | null;
  texto: string;
  clase: string;
  nombreJugador?: string;
}) {
  const etiqueta = nombreJugador ? `${texto} de ${nombreJugador} en Dropbox (pestaña nueva)` : undefined;
  if (!url) {
    return (
      <button type="button" className={clase} disabled title="Sin carpeta cargada">
        {texto}
      </button>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={clase} aria-label={etiqueta}>
      {texto}
    </a>
  );
}

export function BotonesDropbox({
  links,
  nombreJugador,
  className = 'linea',
  style,
}: {
  links: LinksDropbox;
  /** Para el nombre accesible cuando hay varios jugadores en pantalla ("Fotografías de Nández…"). */
  nombreJugador?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    // Div sin rol: solo corta la propagación; los botones/links de adentro son los interactivos.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className={className} style={{ gap: 8, ...style }} onClick={frenar} onKeyDown={frenar}>
      <Boton url={links.fotografias} texto="Fotografías" clase="btn btn--g btn--sm" nombreJugador={nombreJugador} />
      <Boton url={links.matchday} texto="Match Day" clase="btn btn--a btn--sm" nombreJugador={nombreJugador} />
    </div>
  );
}
