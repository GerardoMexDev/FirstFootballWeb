/**
 * País (nombre) → zona horaria IANA representativa.
 *
 * Se usa en `sync-partidos` para deducir la zona de la SEDE cuando el club local no la
 * tiene cargada (partido de visitante). Cadena de respaldo en la sync:
 *   1) zona del club local (seed) · 2) país de la competencia (esto) · 3) `GET /venues`.
 *
 * Acepta el nombre en español (como lo guarda `competencias.pais`) y en inglés (como lo
 * devuelve API-Football en `/venues`). Normaliza acentos y mayúsculas.
 *
 * Para países con varias zonas (EEUU, Brasil, México, Chile continental) se elige la del
 * área más poblada / la capital deportiva — suficiente para mostrar "hora local" en un
 * póster; el diseñador confirma igual. Los "países" que en realidad son continentes
 * (`Asia`, `Europa`, `Sudamérica`, `Norteamérica`) devuelven `null`: ahí la sync consulta
 * la sede puntual.
 *
 * Puro y sin dependencias — testeable con `node --test`.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */

/** Sin acentos, minúsculas, sin espacios de más ni separadores. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s._-]+/g, ' ')
    .trim();
}

// Clave: nombre de país normalizado. Varias entradas por país (es/en/variantes).
const ZONA_POR_PAIS: Record<string, string> = {
  // Cartera
  mexico: 'America/Mexico_City',
  brasil: 'America/Sao_Paulo',
  brazil: 'America/Sao_Paulo',
  chile: 'America/Santiago',
  belgica: 'Europe/Brussels',
  belgium: 'Europe/Brussels',
  'arabia saudita': 'Asia/Riyadh',
  'arabia saudi': 'Asia/Riyadh',
  'saudi arabia': 'Asia/Riyadh',
  uruguay: 'America/Montevideo',
  // Rivales frecuentes en continentales sudamericanas
  argentina: 'America/Argentina/Buenos_Aires',
  paraguay: 'America/Asuncion',
  colombia: 'America/Bogota',
  ecuador: 'America/Guayaquil',
  peru: 'America/Lima',
  bolivia: 'America/La_Paz',
  venezuela: 'America/Caracas',
  // Otros que pueden aparecer (Leagues Cup, Europa League)
  'estados unidos': 'America/New_York',
  usa: 'America/New_York',
  'united states': 'America/New_York',
  'estados unidos de america': 'America/New_York',
  espana: 'Europe/Madrid',
  spain: 'Europe/Madrid',
  portugal: 'Europe/Lisbon',
};

/**
 * @param pais nombre de país (es o en). `null`/vacío o un continente → `null`.
 * @returns nombre IANA de zona, o `null` si no se puede resolver.
 */
export function zonaDePais(pais: string | null | undefined): string | null {
  if (!pais) return null;
  return ZONA_POR_PAIS[normalizar(pais)] ?? null;
}
