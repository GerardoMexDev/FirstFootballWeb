/**
 * Componente único para el caso "la fuente no trae el dato" (contexto.md §3 y §10).
 * Emite el marcado `.sinDato` de la demo. Nunca se reemplaza por un 0.
 */
import { Ico } from '@/components/comunes/Ico';

export function EstadoSinDatos({
  children = 'Sin datos.',
  icono = 'alerta',
}: {
  children?: React.ReactNode;
  icono?: 'alerta' | 'base';
}) {
  return (
    <div className="sinDato">
      <Ico nombre={icono} />
      <span>{children}</span>
    </div>
  );
}
