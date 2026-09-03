/**
 * Íconos de línea de la demo (demo-fase1.html → objeto `P` + helper `ico()`).
 * Los paths se copian EXACTAMENTE de la demo. No agregar íconos nuevos sin acordarlo.
 * Uso: <Ico nombre="pin" />  ·  <Ico nombre="pin" clase="ico ico--sm" />
 */
import type { CSSProperties } from 'react';

/** Paths SVG por nombre, tal cual la demo. viewBox 0 0 24 24, stroke currentColor. */
export const PATHS: Record<string, string> = {
  flecha: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  atras: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l2.8 1.8"/>',
  pin: '<path d="M19 10.5c0 5-7 10.5-7 10.5S5 15.5 5 10.5a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10.3" r="2.6"/>',
  trofeo:
    '<path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4.6a2 2 0 0 0 0 4H7"/><path d="M17 6h2.4a2 2 0 0 1 0 4H17"/><path d="M10 14h4l.6 5H9.4Z"/><path d="M8 20h8"/>',
  medalla: '<circle cx="12" cy="14.5" r="5.2"/><path d="M8.5 9.8 6 3h4l2 3 2-3h4l-2.5 6.8"/>',
  alerta: '<path d="M12 4.5 2.8 20h18.4Z"/><path d="M12 10v4"/><path d="M12 17.2h.01"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>',
  cerrar: '<path d="M18 6 6 18M6 6l12 12"/>',
  fuego:
    '<path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.6.6-2.9 1.3-3.9.5 1 1.3 1.7 2.2 1.7 1 0 1.5-.9 1.5-2.3 0-1.7-.5-3.2 0-4.5Z"/>',
  torta:
    '<path d="M4 21h16"/><path d="M5 21v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6"/><path d="M12 10V7"/><path d="M9 13v-2M15 13v-2"/>',
  ig: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.2 6.8h.01"/>',
  globo: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5a13 13 0 0 1 0 17a13 13 0 0 1 0-17Z"/>',
  base:
    '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
};

export type NombreIcono = keyof typeof PATHS;

export function Ico({
  nombre,
  clase = 'ico',
  style,
}: {
  nombre: NombreIcono;
  clase?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={clase}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={style}
      // Paths estáticos de la demo, no entran datos de usuario -> uso seguro.
      dangerouslySetInnerHTML={{ __html: PATHS[nombre] ?? '' }}
    />
  );
}
