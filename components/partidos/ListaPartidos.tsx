/**
 * Lista de partidos agrupada por día, en zona de Uruguay: `renderPartidos()` de la demo.
 * `partidos` ya viene filtrado (por `SeccionPartidos`) y ordenado por `inicioUtc` desde el
 * repositorio — acá solo se agrupa y se pinta.
 */
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';
import { TarjetaPartido } from '@/components/partidos/TarjetaPartido';
import { diasDesdeHoyUy, etiquetaDiaUy } from '@/lib/fechas/zonas';
import { agruparPorDia } from '@/lib/partidos/utilidades';
import type { PartidoProximo } from '@/lib/repositorios/tipos';

export function ListaPartidos({
  partidos,
  partidosConHito = new Set<string>(),
  onAbrirPartido,
}: {
  partidos: PartidoProximo[];
  partidosConHito?: Set<string>;
  /** Abre el panel de detalle del partido. Si no se pasa, las tarjetas quedan no interactivas. */
  onAbrirPartido?: (partidoId: string) => void;
}) {
  if (!partidos.length) {
    return (
      <EstadoSinDatos style={{ justifyContent: 'center', padding: 56 }}>
        Sin resultados para este filtro.
      </EstadoSinDatos>
    );
  }

  return (
    <>
      {agruparPorDia(partidos).map(([diaUy, partidosDelDia]) => {
        const hoy = diaUy !== 'sin-fecha' && diasDesdeHoyUy(diaUy) === 0;
        return (
          <section key={diaUy} className={`grupo ${hoy ? 'grupo--hoy' : ''}`}>
            <div className="grupo__t">
              <h2 className="d3">{diaUy === 'sin-fecha' ? 'Sin fecha confirmada' : etiquetaDiaUy(diaUy)}</h2>
              <span>
                {partidosDelDia.length} partido{partidosDelDia.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="lista__g">
              {partidosDelDia.map((p) => (
                <TarjetaPartido
                  key={`${p.partidoId}-${p.jugadorId}`}
                  partido={p}
                  tieneHito={partidosConHito.has(p.partidoId)}
                  onAbrir={onAbrirPartido ? () => onAbrirPartido(p.partidoId) : undefined}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
