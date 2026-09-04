/**
 * Escudo de un club: `.crest` de la demo. Si hay `url` (vendrá de la sync o de ESPN/
 * TheSportsDB — Fase 1 puede no tenerla todavía) se muestra la imagen; si no, o si falla
 * la carga, caen las iniciales con el mismo color hasheado por nombre que usaba la demo
 * (`crest()`) — nunca un ícono genérico ni un espacio en blanco.
 */
'use client';

import { useState } from 'react';
import { iniciales } from '@/lib/formato/valores';

/** Mismo hash de la demo: suma de códigos de carácter mod 360, para un tono de fondo estable. */
function tonoDesdeNombre(nombre: string): number {
  let acumulado = 0;
  for (const caracter of nombre) acumulado += caracter.charCodeAt(0);
  return acumulado % 360;
}

export function Escudo({
  nombre,
  url,
  clase = 'crest',
}: {
  nombre: string;
  url?: string | null;
  clase?: string;
}) {
  const [fallo, setFallo] = useState(false);

  if (url && !fallo) {
    return (
      // Escudos de Storage/fuentes externas: no son parte del set de imágenes que optimiza
      // next/image (dominio variable, tamaño chico, con fallback a iniciales si falla).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={clase}
        src={url}
        alt=""
        style={{ objectFit: 'cover' }} // la demo nunca mostró un <img> acá; .crest no trae object-fit
        onError={() => setFallo(true)}
      />
    );
  }

  return (
    <span className={clase} style={{ '--h': tonoDesdeNombre(nombre) } as React.CSSProperties} aria-hidden="true">
      {iniciales(nombre)}
    </span>
  );
}
