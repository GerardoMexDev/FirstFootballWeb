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
import { CasillasConvocatoria, type DatosConvocatoria } from '@/components/partidos/CasillasConvocatoria';
import { TarjetaFecha } from '@/components/partidos/TarjetaFecha';
import { diasDesdeHoyUy, etiquetaDiaUy } from '@/lib/fechas/zonas';
import { mezclarPorDia, textoCantidades, type FechaContenido } from '@/lib/partidos/fechas-contenido';
import type { PartidoProximo } from '@/lib/repositorios/tipos';
import type { EstadoVisual, ResumenTicket } from '@/lib/tickets/tipos';
import { CasillasDiseno } from '@/components/tickets/CasillasDiseno';

/** Quién tilda Completado (Diseñador) y Cancelado (Admin, CM, Diseñador) — 0040. */
export type PermisosDiseno = { completar: boolean; cancelar: boolean };

/** Casillas Completado/Cancelado de la tarjeta (0040); nada si el partido no tiene ticket automático. */
function casillasDe(t: ResumenTicket | undefined, nombre: string, permisos: PermisosDiseno) {
  if (!t?.partidoId) return undefined;
  return (
    <CasillasDiseno
      key={`${t.id}:${t.estado}`}
      partidoId={t.partidoId}
      jugadorId={t.jugadorId}
      jugadorNombre={nombre}
      marca={t.estado === 'publicado' ? 'completado' : t.estado === 'cancelado' ? 'cancelado' : 'pendiente'}
      motivoCancelacion={t.motivoCancelacion}
      puedeMarcar={permisos.completar}
      puedeCancelar={permisos.cancelar}
      sinPendiente
    />
  );
}
import { SIN_LINKS, type LinksDropbox } from '@/lib/jugadores/links-dropbox';

export function ListaPartidos({
  partidos,
  partidosConHito = new Set<string>(),
  onAbrirPartido,
  linksDropbox,
  fechas = [],
  alertasTicket = {},
  estadosDiseno = {},
  ticketsMd = {},
  permisosDiseno = { completar: false, cancelar: false },
  convocatoria,
}: {
  partidos: PartidoProximo[];
  /** Convocatoria a la selección (0032): casillas en las tarjetas de Uruguay. */
  convocatoria?: DatosConvocatoria;
  /** `{ 'partidoId:jugadorId': texto }` de la lucecita de ticket (`alertasPorTarjeta`). */
  alertasTicket?: Record<string, string>;
  /** `{ '<partido>:<jugador>': estado }` del semáforo de diseño (0030). */
  estadosDiseno?: Record<string, EstadoVisual>;
  /** Ticket automático por `partido:jugador` (0040): señal "Último momento" y casillas en la tarjeta. */
  ticketsMd?: Record<string, ResumenTicket>;
  /** Quién tilda Completado (Diseñador) y Cancelado (Admin, CM, Diseñador) — 0040. */
  permisosDiseno?: PermisosDiseno;
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
                  // La selección (0031) no tiene panel ni carpetas de Dropbox.
                  convocatoria={
                    p.esSeleccion && convocatoria ? (
                      <CasillasConvocatoria
                        partidoId={p.partidoId}
                        convocables={convocatoria.convocables}
                        convocados={convocatoria.convocados[p.partidoId] ?? []}
                        puedeMarcar={convocatoria.puedeMarcar}
                      />
                    ) : undefined
                  }
                  onAbrir={onAbrirPartido && !p.esSeleccion ? () => onAbrirPartido(p.partidoId) : undefined}
                  linksDropbox={linksDropbox && !p.esSeleccion ? (linksDropbox[p.jugadorId] ?? SIN_LINKS) : undefined}
                  alertaTicket={alertasTicket[`${p.partidoId}:${p.jugadorId}`]}
                  estadoDiseno={estadosDiseno[`${p.partidoId}:${p.jugadorId}`]}
                  ultimoMomento={ticketsMd[`${p.partidoId}:${p.jugadorId}`]?.ultimoMomento ?? false}
                  casillasDiseno={casillasDe(ticketsMd[`${p.partidoId}:${p.jugadorId}`], p.jugadorApodo || p.jugadorNombre, permisosDiseno)}
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
