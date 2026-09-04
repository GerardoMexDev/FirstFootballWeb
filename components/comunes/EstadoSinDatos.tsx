/**
 * Componente único para el caso "la fuente no trae el dato" (contexto.md §3 y §10).
 * Emite el marcado `.sinDato` de la demo. Nunca se reemplaza por un 0.
 */
import type { CSSProperties } from 'react';
import { Ico } from '@/components/comunes/Ico';

export function EstadoSinDatos({
  children = 'Sin datos.',
  icono = 'alerta',
  style,
}: {
  children?: React.ReactNode;
  icono?: 'alerta' | 'base';
  /** La demo ajusta este componente con estilos puntuales según dónde aparece (p.ej. centrado
   *  y con más padding cuando es el único contenido de la lista de partidos). */
  style?: CSSProperties;
}) {
  return (
    <div className="sinDato" style={style}>
      <Ico nombre={icono} />
      <span>{children}</span>
    </div>
  );
}
