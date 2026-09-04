/**
 * Tiras de KPI de la vista `partidos`: `renderKpis()` de la demo, sobre datos reales.
 *
 * La demo mostraba 5 tarjetas; acá van 4 — "Hitos por alcanzar" depende de `lib/motor-hitos`
 * (todavía sin conectar) y no se fabrica un cero en su lugar (contexto.md §10: cero
 * invenciones). Se agrega en la sesión del motor de hitos.
 *
 * "Jugadores con partido próximo" también difiere de la demo: la demo mostraba el tamaño
 * total del plantel (6, fijo). Acá solo se cuenta lo que sale de `proximos_partidos` — el
 * repositorio de jugadores todavía no está conectado, así que no hay forma de saber el
 * plantel completo desde esta vista sin fabricar el número.
 */
import { diasDesdeHoyUy } from '@/lib/fechas/zonas';
import { esHoyUy } from '@/lib/partidos/utilidades';
import type { PartidoProximo } from '@/lib/repositorios/tipos';

export function TarjetasKpi({ partidos }: { partidos: PartidoProximo[] }) {
  const conFecha = partidos.filter((p) => p.diaUy !== null);

  const hoy = conFecha.filter(esHoyUy).length;
  const estaSemana = conFecha.filter((p) => diasDesdeHoyUy(p.diaUy!) < 7).length;
  const internacionales30 = conFecha.filter(
    (p) => p.esInternacional && diasDesdeHoyUy(p.diaUy!) < 30,
  ).length;

  const jugadores = new Set(partidos.map((p) => p.jugadorId));
  const ligas = new Set(partidos.map((p) => p.competenciaId).filter((id): id is string => id !== null));

  return (
    <div className="kpis" id="kpis">
      <div className="kpi kpi--a">
        <b>{hoy}</b>
        <span>Partidos hoy</span>
      </div>
      <div className="kpi">
        <b>{estaSemana}</b>
        <span>Esta semana</span>
      </div>
      <div className="kpi">
        <b>{internacionales30}</b>
        <span>Internacionales, 30 días</span>
      </div>
      <div className="kpi">
        <b>{jugadores.size}</b>
        <span>
          Jugadores con partido próximo
          {ligas.size ? ` en ${ligas.size} liga${ligas.size !== 1 ? 's' : ''}` : ''}
        </span>
      </div>
    </div>
  );
}
