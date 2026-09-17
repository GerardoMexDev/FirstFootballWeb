/**
 * Rótulo del bloque de temporada de la ficha de jugador. Puro y testeable — no llama a `now()`
 * (recibe el año calendario ya resuelto por quien llama, mismo criterio que `datos-contenido.ts`).
 *
 * Reglas (acordadas con Gerardo 2026-09-16, Sesión 9, sobre las migraciones 0018/0020/0021):
 *   - Liga MX (`clubPais === 'México'`) con temporada real conocida: "Apertura"/"Clausura" +
 *     año, derivado del MES real de arranque de la temporada (jul-dic = Apertura, ene-jun =
 *     Clausura) — SportMonks no da ese nombre como texto (el `name` de la temporada es solo
 *     "2026/2027", el año "académico", no el torneo).
 *   - Resto con temporada real que cruza el año calendario (Bélgica/Arabia, SportMonks la
 *     modela como una sola temporada larga): "Temporada AAAA-AAAA".
 *   - Cualquier otro caso (Brasil/Chile ~año calendario, o sin temporada real conocida —
 *     copas/API-Football): "Este año (AAAA)".
 */
import type { TemporadaActual } from '@/lib/repositorios/tipos';

export function etiquetaBloqueTemporada(
  temporada: TemporadaActual | null,
  clubPais: string | null,
  anioCalendario: string,
): string {
  if (!temporada || temporada.temporadaAnioDesde === null || temporada.temporadaAnioHasta === null) {
    return `Este año (${anioCalendario})`;
  }
  const { temporadaAnioDesde: desde, temporadaAnioHasta: hasta, temporadaInicio } = temporada;

  if (clubPais === 'México' && temporadaInicio) {
    const mes = new Date(temporadaInicio).getUTCMonth() + 1; // instante UTC, no fecha civil — 1-12
    const torneo = mes >= 7 ? 'Apertura' : 'Clausura';
    return `${torneo} ${desde}`;
  }

  return desde !== hasta ? `Temporada ${desde}-${hasta}` : `Este año (${desde})`;
}
