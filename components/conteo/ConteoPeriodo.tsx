/**
 * Recuadro "Diseños del período" arriba del Calendario (pedido de la agencia 2026-10-08): cuántos
 * diseños completó el Diseñador en el período actual (6 → 5), Match Day + pedidos, con link al
 * detalle. Solo lo renderiza la página para Administrador y Diseñador. Estilos `.cnt` en app.css.
 *
 * Football First. Creado 2026-10-08.
 */
import Link from 'next/link';
import type { Periodo } from '@/lib/conteo/periodos';
import type { TotalesConteo } from '@/lib/conteo/conteo-disenos';

export function ConteoPeriodo({ periodo, totales }: { periodo: Periodo; totales: TotalesConteo | null }) {
  return (
    <section className="cnt" aria-label="Diseños del período">
      <div className="cnt__h">
        <b>Diseños del período</b>
        <span>{periodo.etiqueta}</span>
      </div>
      {totales ? (
        <dl className="cnt__n">
          <div>
            <dt>Match Day</dt>
            <dd>{totales.matchday}</dd>
          </div>
          <div>
            <dt>Pedidos</dt>
            <dd>{totales.pedidos}</dd>
          </div>
          <div className="cnt__tot">
            <dt>Total</dt>
            <dd>{totales.total}</dd>
          </div>
        </dl>
      ) : (
        <p className="cnt__err">No pudimos cargar el conteo. Recargá la página.</p>
      )}
      <Link className="btn btn--g btn--sm cnt__ver" href={`/conteo/${periodo.clave}`}>
        Ver detalle
      </Link>
    </section>
  );
}
