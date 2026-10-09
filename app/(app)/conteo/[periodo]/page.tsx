/**
 * Detalle del conteo mensual de diseños (pedido de la agencia 2026-10-08, para el pago del
 * Diseñador): `/conteo/2026-10` = 6 oct – 5 nov 2026. Totales (Match Day, pedidos, por jugador),
 * la lista de cada diseño completado en el período y los links a los períodos anteriores — cada
 * período queda con su dirección fija para consultarlo después.
 *
 * Solo Administrador y Diseñador (la base también lo valida, 0044). Se calcula en vivo.
 *
 * Football First. Creado 2026-10-08.
 */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';
import { leerConteo, puedeVerConteo, totalizar, type DisenoContado } from '@/lib/conteo/conteo-disenos';
import { PRIMER_PERIODO, periodoDeClave, periodoDeDia, periodosHasta } from '@/lib/conteo/periodos';
import { ZONA_AGENCIA } from '@/lib/fechas/zonas';
import { sesionActual } from '@/lib/sesion/sesion-actual';
import { crearClienteServidor } from '@/lib/supabase/cliente-servidor';

export const metadata = { title: 'Conteo de diseños — Football First' };

/** "lun 12 oct" */
function diaCorto(iso: string): string {
  return DateTime.fromISO(iso).setLocale('es').toFormat('ccc d LLL');
}

export default async function PaginaConteo({ params }: { params: { periodo: string } }) {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');
  if (!puedeVerConteo(sesion.cargo)) redirect('/calendario');

  const hoyUy = DateTime.now().setZone(ZONA_AGENCIA).toISODate() ?? '';
  const actual = periodoDeDia(hoyUy);
  const periodo = periodoDeClave(params.periodo);
  if (!periodo || periodo.clave < PRIMER_PERIODO || periodo.clave > actual.clave) notFound();
  const esActual = periodo.clave === actual.clave;

  let disenos: DisenoContado[] | null = null;
  try {
    disenos = await leerConteo(crearClienteServidor(), periodo);
  } catch (e) {
    console.error('conteo de diseños:', e);
  }
  const totales = disenos ? totalizar(disenos) : null;
  const periodos = periodosHasta(hoyUy);

  return (
    <section className="vista on" id="v-conteo" tabIndex={-1}>
      <div className="head">
        <p className="cnt__volver">
          <Link href="/calendario">← Calendario</Link>
        </p>
        <h1 className="d1">Conteo de diseños</h1>
        <p className="sub">
          {periodo.etiqueta}
          {esActual ? ' · período en curso' : ' · período cerrado'}. Cuenta los diseños completados en
          el período: Match Day (casilla Completado) y pedidos fuera de Match Day. Los cancelados no
          cuentan.
        </p>
      </div>

      {!totales || !disenos ? (
        <EstadoSinDatos>No pudimos cargar el conteo. Recargá la página.</EstadoSinDatos>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi">
              <b>{totales.matchday}</b>
              <span>Match Day</span>
            </div>
            <div className="kpi">
              <b>{totales.pedidos}</b>
              <span>Pedidos fuera de Match Day</span>
            </div>
            <div className="kpi kpi--a">
              <b>{totales.total}</b>
              <span>Total de diseños</span>
            </div>
          </div>

          {disenos.length === 0 ? (
            <EstadoSinDatos>Todavía no hay diseños completados en este período.</EstadoSinDatos>
          ) : (
            <>
              <h2 className="d2 cnt__t">Por jugador</h2>
              <div className="cnt__tabla">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Jugador</th>
                      <th scope="col">Match Day</th>
                      <th scope="col">Pedidos</th>
                      <th scope="col">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totales.porJugador.map((j) => (
                      <tr key={j.jugadorNombre}>
                        <th scope="row">{j.jugadorNombre}</th>
                        <td>{j.matchday}</td>
                        <td>{j.pedidos}</td>
                        <td>
                          <b>{j.total}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2 className="d2 cnt__t">Diseños completados</h2>
              <div className="cnt__tabla">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Completado</th>
                      <th scope="col">Diseño</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disenos.map((d, i) => (
                      <tr key={`${d.titulo}-${i}`}>
                        <td className="cnt__dia">{diaCorto(d.completadoDia)}</td>
                        <td>{d.titulo}</td>
                        <td>
                          <span className={`cnt__tipo cnt__tipo--${d.tipo}`}>{d.tipo === 'matchday' ? 'Match Day' : 'Pedido'}</span>
                        </td>
                        <td>{d.completadoPorNombre ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <h2 className="d2 cnt__t">Períodos</h2>
      <ul className="cnt__per">
        {periodos.map((p) => (
          <li key={p.clave}>
            {p.clave === periodo.clave ? (
              <span aria-current="page">{p.etiqueta}</span>
            ) : (
              <Link href={`/conteo/${p.clave}`}>{p.etiqueta}</Link>
            )}
            {p.clave === actual.clave && <small> · en curso</small>}
          </li>
        ))}
      </ul>
    </section>
  );
}
