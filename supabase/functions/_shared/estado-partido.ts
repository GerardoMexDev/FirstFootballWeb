/**
 * Traduce el código corto de estado de fixture de API-Football al enum `estado_partido`
 * de la base (migración 0001). Referencia: docs de API-Football, sección "Fixture Status".
 */
export type EstadoPartido = 'programado' | 'en_juego' | 'finalizado' | 'suspendido' | 'sin_datos';

const PROGRAMADO = new Set(['TBD', 'NS']);
const EN_JUEGO = new Set(['1H', '2H', 'ET', 'BT', 'P', 'HT', 'LIVE']);
const FINALIZADO = new Set(['FT', 'AET', 'PEN']);
const SUSPENDIDO = new Set(['SUSP', 'ABD', 'PST', 'INT']);

export function mapearEstado(codigoCorto: string): EstadoPartido {
  if (PROGRAMADO.has(codigoCorto)) return 'programado';
  if (EN_JUEGO.has(codigoCorto)) return 'en_juego';
  if (FINALIZADO.has(codigoCorto)) return 'finalizado';
  if (SUSPENDIDO.has(codigoCorto)) return 'suspendido';
  // CANC/AWD/WO u otro código no contemplado: no se inventa el estado, se marca sin datos.
  return 'sin_datos';
}
