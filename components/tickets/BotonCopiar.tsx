/**
 * Botón "Copiar datos del partido" (0030): copia al portapapeles el texto de `textoCopiarPartido`
 * (equipos, fecha, hora local y de Uruguay, estadio) para pegarlo en Photoshop. Avisa "Copiado"
 * (o "No se pudo copiar" si el navegador no deja) en una región `role="status"`.
 *
 * Football First. Creado 2026-09-30.
 */
'use client';

import { useState } from 'react';
import { Ico } from '@/components/comunes/Ico';

export function BotonCopiar({ texto }: { texto: string }) {
  const [aviso, setAviso] = useState('');

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso('Copiado');
    } catch {
      setAviso('No se pudo copiar');
    }
    setTimeout(() => setAviso(''), 2000);
  }

  return (
    <span className="bcp">
      <button type="button" className="btn btn--g btn--sm bcp__b" aria-label="Copiar datos del partido" title="Copiar datos del partido" onClick={copiar}>
        <Ico nombre="copiar" clase="ico ico--sm" />
        Copiar
      </button>
      <span role="status" aria-live="polite" className="bcp__a">
        {aviso}
      </span>
    </span>
  );
}
