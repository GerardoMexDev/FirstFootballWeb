/**
 * Cara de un jugador: `.cara` de la demo (`av()`). Sin `foto_url` (Fase 1: todavía no hay
 * fotos subidas, ver §4 estrategia de imágenes en arquitectura-fase1.html) o si la imagen
 * falla, muestra las iniciales — nunca un ícono genérico ni un espacio en blanco.
 */
'use client';

import { useState } from 'react';
import { iniciales } from '@/lib/formato/valores';

export function CaraJugador({
  nombre,
  fotoUrl,
  clase = 'cara',
}: {
  nombre: string;
  fotoUrl?: string | null;
  clase?: string;
}) {
  const [fallo, setFallo] = useState(false);

  if (fotoUrl && !fallo) {
    // Fotos de Storage: dominio variable, tamaño chico, con fallback a iniciales si falla.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={clase} src={fotoUrl} alt="" onError={() => setFallo(true)} />;
  }

  // `.ph` (placeholder) se agregó en styles/app.css — la demo solo la usaba en .pm/.res,
  // no en .cara, así que ahí faltaba centrar el texto.
  return (
    <span className={`${clase} ph`} aria-hidden="true">
      {iniciales(nombre)}
    </span>
  );
}
