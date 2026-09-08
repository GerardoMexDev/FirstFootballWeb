/**
 * Tiras de KPI de la vista `partidos`: `renderKpis()` de la demo, sobre datos reales.
 *
 * "Jugadores con partido próximo" difiere de la demo: la demo mostraba el tamaño total del
 * plantel (6, fijo). Acá solo se cuenta lo que sale de `proximos_partidos` — el repositorio
 * de jugadores completo (más allá de quién tiene partido) todavía no está conectado acá.
 */
import { diasDesdeHoyUy } from '@/lib/fechas/zonas';
import { esHoy, diaDePartido } from '@/lib/partidos/utilidades';
import type { PartidoProximo } from '@/lib/repositorios/tipos';

export function TarjetasKpi({ partidos, cantidadHitos }: { partidos: PartidoProximo[]; cantidadHitos: number }) {
  // Se cuenta por el día de la sede (mismo criterio que la lista y el calendario, punto I).
  const conDia = partidos
    .map((p) => ({ p, dia: diaDePartido(p) }))
    .filter((x): x is { p: PartidoProximo; dia: string } => x.dia !== null);

  const hoy = conDia.filter((x) => esHoy(x.p)).length;
  const estaSemana = conDia.filter((x) => diasDesdeHoyUy(x.dia) < 7).length;
  const internacionales30 = conDia.filter(
    (x) => x.p.esInternacional && diasDesdeHoyUy(x.dia) < 30,
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
      <div className="kpi kpi--a">
        <b>{cantidadHitos}</b>
        <span>Hitos por alcanzar</span>
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
