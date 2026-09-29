/**
 * Lista de partidos agrupada por día de la sede: `renderPartidos()` de la demo.
 * `partidos` ya viene filtrado (por `SeccionPartidos`) y ordenado por `inicioUtc` desde el
 * repositorio — acá solo se agrupa y se pinta. El día es el de la sede del partido
 * (`agruparPorDia` de `lib/partidos/utilidades`), no el de Uruguay (punto I).
 *
 * Desde 2026-09-28 cada día puede traer además las fechas de Contenido (cumpleaños,
 * aniversarios), debajo de sus partidos (`mezclarPorDia`, `lib/partidos/fechas-contenido`).
 */
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';
import { TarjetaPartido } from '@/components/partidos/TarjetaPartido';
import { TarjetaFecha } from '@/components/partidos/TarjetaFecha';
import { diasDesdeHoyUy, etiquetaDiaUy } from '@/lib/fechas/zonas';
import { mezclarPorDia, textoCantidades, type FechaContenido } from '@/lib/partidos/fechas-contenido';
import type { PartidoProximo } from '@/lib/repositorios/tipos';
import { SIN_LINKS, type LinksDropbox } from '@/lib/jugadores/links-dropbox';

export function ListaPartidos({
  partidos,
  partidosConHito = new Set<string>(),
  onAbrirPartido,
  linksDropbox,
  fechas = [],
  alertasTicket = {},
}: {
  partidos: PartidoProximo[];
  /** `{ partidoId: texto }` de la lucecita de ticket (`alertasPorPartido`). */
  alertasTicket?: Record<string, string>;
  /** Fechas de Contenido ya filtradas; van debajo de los partidos de su día. */
  fechas?: FechaContenido[];
  partidosConHito?: Set<string>;
  /** Carpetas de Dropbox por jugadorId. Si se pasa, cada tarjeta muestra sus botones. */
  linksDropbox?: Record<string, LinksDropbox>;
  /** Abre el panel de detalle del partido. Si no se pasa, las tarjetas quedan no interactivas. */
  onAbrirPartido?: (partidoId: string) => void;
}) {
  if (!partidos.length && !fechas.length) {
    return (
      <EstadoSinDatos style={{ justifyContent: 'center', padding: 56 }}>
        Sin resultados para este filtro.
      </EstadoSinDatos>
    );
  }

  return (
    <>
      {mezclarPorDia(partidos, fechas).map(({ dia, partidos: partidosDelDia, fechas: fechasDelDia }) => {
        const hoy = dia !== 'sin-fecha' && diasDesdeHoyUy(dia) === 0;
        return (
          <section key={dia} className={`grupo ${hoy ? 'grupo--hoy' : ''}`}>
            <div className="grupo__t">
              <h2 className="d3">{dia === 'sin-fecha' ? 'Sin fecha confirmada' : etiquetaDiaUy(dia)}</h2>
              <span>{textoCantidades(partidosDelDia.length, fechasDelDia.length)}</span>
            </div>
            <div className="lista__g">
              {partidosDelDia.map((p) => (
                <TarjetaPartido
                  key={`${p.partidoId}-${p.jugadorId}`}
                  partido={p}
                  tieneHito={partidosConHito.has(p.partidoId)}
                  onAbrir={onAbrirPartido ? () => onAbrirPartido(p.partidoId) : undefined}
                  linksDropbox={linksDropbox ? (linksDropbox[p.jugadorId] ?? SIN_LINKS) : undefined}
                  alertaTicket={alertasTicket[p.partidoId]}
                />
              ))}
              {fechasDelDia.map((f) => (
                <TarjetaFecha key={`${f.fuente}-${f.refId ?? f.titulo}`} fecha={f} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
