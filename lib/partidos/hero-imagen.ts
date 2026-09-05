/**
 * Elige la imagen de fondo del hero de la vista `partidos` según el tipo de competencia
 * del partido destacado. En `public/heroes/` hay 2 fotos por tipo:
 *   {liga|copa|continental|seleccion}-{1,2}.webp
 *
 * La elección es estable por partido (hash del id): no cambia entre renders ni recargas.
 * Si el tipo de competencia no se conoce (`null`), devuelve `null` y el hero se queda con
 * su degradé (`.hero__fb`) — nunca se fuerza una foto que no corresponde.
 *
 * La clase `.hero__bg` (que ya estiliza la demo: `grayscale(1) brightness(.46)`) se encarga
 * de oscurecer y desaturar la imagen, así el texto blanco encima siempre se lee y cualquier
 * estadio identificable queda genérico.
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
export type TipoCompetencia = 'liga' | 'copa' | 'continental' | 'seleccion';

const TIPOS: readonly TipoCompetencia[] = ['liga', 'copa', 'continental', 'seleccion'];
const FOTOS_POR_TIPO = 2;

/** Hash chico y estable de un string (djb2 xor). Solo para elegir variante, no es cripto. */
function hash(texto: string): number {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) {
    h = (Math.imul(h, 33) ^ texto.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * @param tipo tipo de competencia del partido (`PartidoProximo.competenciaTipo`)
 * @param partidoId id del partido, para elegir la variante de forma estable
 * @returns ruta pública de la foto, o `null` si no hay tipo conocido
 */
export function imagenHero(tipo: TipoCompetencia | null | undefined, partidoId: string): string | null {
  if (!tipo || !TIPOS.includes(tipo)) return null;
  const variante = (hash(partidoId) % FOTOS_POR_TIPO) + 1;
  return `/heroes/${tipo}-${variante}.webp`;
}
