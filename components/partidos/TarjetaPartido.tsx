/**
 * Tarjeta de un partido: `.match` de la demo (`cardPartido()`). Adaptaciones frente a la
 * demo (datos reales, no mock):
 * - Sin sigla de zona (CEST/BRT/…): la hora en la sede se muestra sola, con la etiqueta
 *   "hora local" (regla de zonas horarias — ver arquitectura-fase1.html §3).
 * - La hora local se muestra SIEMPRE que se conozca la zona de la sede (la agencia la
 *   necesita para los pósters). Cuando coincide con la de Uruguay (Brasil/Chile, mismo
 *   UTC−3 sin DST) se aclara "misma hora que Uruguay" para que no parezca un error.
 * - Sin "· país" en la competencia: la vista `proximos_partidos` no expone el país de la
 *   competencia (no se le agregó esa columna); si hace falta, es un cambio de vista, no de acá.
 * - Con `onAbrir`, la tarjeta abre el panel de detalle del partido (clic, Enter o Espacio),
 *   con `role="button"` y foco — igual que `.match` en la demo. Sin `onAbrir` (por si se
 *   reusa en otro contexto) queda como bloque no interactivo.
 */
import { Ico } from '@/components/comunes/Ico';
import { Escudo } from '@/components/comunes/Escudo';
import { CaraJugador } from '@/components/comunes/CaraJugador';
import { horaCortaEnUruguay, horaCortaEnSede } from '@/lib/fechas/zonas';
import { mostrar } from '@/lib/formato/valores';
import { esHoyUy, claseTarjeta } from '@/lib/partidos/utilidades';
import type { PartidoProximo } from '@/lib/repositorios/tipos';

export function TarjetaPartido({
  partido: p,
  tieneHito = false,
  onAbrir,
}: {
  partido: PartidoProximo;
  tieneHito?: boolean;
  onAbrir?: () => void;
}) {
  const hoy = esHoyUy(p);
  const tieneHorario = p.inicioUtc !== null;
  const tieneSede = tieneHorario && p.zonaHorariaEvento !== null;
  const horaUy = tieneHorario ? horaCortaEnUruguay(p.inicioUtc!) : null;
  const horaSede = tieneSede ? horaCortaEnSede(p.inicioUtc!, p.zonaHorariaEvento!) : null;
  const mismaHora = horaSede !== null && horaSede === horaUy;

  return (
    <article
      className={`match ${claseTarjeta(p)} ${hoy ? 'match--hoy' : ''} ${p.tentativo ? 'match--tent' : ''} ${p.esInternacional ? 'match--int' : ''}`}
      data-id={p.partidoId}
      {...(onAbrir && {
        role: 'button',
        tabIndex: 0,
        style: { cursor: 'pointer' },
        onClick: onAbrir,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAbrir();
          }
        },
      })}
    >
      <div className="hora">
        <b>{horaUy ?? '—'}</b>
        <div className={`uy ${p.tentativo ? 'tent' : ''}`}>
          {p.tentativo ? (
            <>
              <Ico nombre="alerta" clase="ico ico--sm" />
              Tentativa
            </>
          ) : tieneHorario ? (
            'Hora Uruguay'
          ) : (
            'Sin horario confirmado'
          )}
        </div>
        {tieneSede && (
          <div className="loc">
            <Ico nombre="pin" clase="ico ico--sm" />
            {mismaHora ? (
              <span>misma hora que Uruguay</span>
            ) : (
              <>
                <b>{horaSede}</b> hora local
              </>
            )}
          </div>
        )}
      </div>

      <div className="mid">
        <div className={`compe ${p.esInternacional ? 'compe--int' : ''}`}>
          <span className="compe__c">{mostrar(p.competenciaCodigo)}</span>
          <span className="compe__n">{mostrar(p.competenciaNombre)}</span>
        </div>
        <div className="duelo">
          <Escudo nombre={p.clubNombre ?? '?'} url={p.clubEscudoUrl} />
          {mostrar(p.clubNombre)}
          <span className="vs">vs</span>
          <Escudo nombre={p.rivalNombre ?? '?'} url={p.rivalEscudoUrl} />
          {mostrar(p.rivalNombre)}
        </div>
        <div className="linea">
          <span>
            <Ico nombre="trofeo" clase="ico ico--sm" />
            <b>{mostrar(p.ronda)}</b>
          </span>
          <span>
            <Ico nombre="pin" clase="ico ico--sm" />
            {p.estadio || p.ciudad ? `${mostrar(p.estadio)}, ${mostrar(p.ciudad)}` : 'Sin datos'}
          </span>
        </div>
        <div className="caras">
          <div className="caras__pila">
            <CaraJugador nombre={p.jugadorNombre} fotoUrl={p.jugadorFotoUrl} />
          </div>
          <small>
            {p.jugadorApodo || p.jugadorNombre}
            {p.conSeleccion ? ' · con la selección' : ''}
          </small>
          {tieneHito && (
            <span className="tag tag--hito">
              <Ico nombre="medalla" clase="ico ico--sm" />
              Hito
            </span>
          )}
        </div>
      </div>

      <div className="der">
        <Ico nombre="chevron" />
      </div>
    </article>
  );
}
