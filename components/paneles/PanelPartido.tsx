/**
 * Cuerpo del panel de detalle de partido: marcado de `abrirPanelPartido()` de la demo, sobre
 * el bundle de `/api/paneles/partido` (`plegarDetallePartido` + hitos que caen en el partido).
 *
 * Diferencias con la demo (datos reales):
 *  - Sin sigla de zona en la hora de la sede (regla de zonas — arquitectura-fase1.html §3).
 *  - "Local"/"Visitante" solo si se sabe de qué lado juega el/los representado(s); en un
 *    derby entre dos representados no se muestra (no hay "un" lado nuestro).
 *  - Sin "· país" en la competencia (la vista no lo expone).
 *
 * `'use client'` porque cada "jugador a cubrir" abre el panel de ese jugador.
 *
 * Football First (Fase 1). Creado 2026-09-06.
 */
'use client';

import { Ico } from '@/components/comunes/Ico';
import { Escudo } from '@/components/comunes/Escudo';
import { CaraJugador } from '@/components/comunes/CaraJugador';
import { BotonesDropbox } from '@/components/jugadores/BotonesDropbox';
import { CrearTicket } from '@/components/tickets/CrearTicket';
import { BotonCopiar } from '@/components/tickets/BotonCopiar';
import { CasillasDiseno } from '@/components/tickets/CasillasDiseno';
import { SenalUltimoMomento } from '@/components/tickets/SenalUltimoMomento';
import { PastillaSemaforo } from '@/components/tickets/PastillaSemaforo';
import { textoCopiarPartido } from '@/lib/tickets/copiar';
import { estadoVisual } from '@/lib/tickets/semaforo';
import { fechaCortaUy } from '@/lib/tickets/vencimiento';
import { PastillaEstado } from '@/components/tickets/PastillaEstado';
import { AlertaTicket } from '@/components/tickets/AlertaTicket';
import { debeActuar, puedeCrear } from '@/lib/tickets/permisos';
import { alertaDe } from '@/lib/tickets/estados';
import { esUrgenteHoy } from '@/lib/tickets/pantalla';
import { SIN_LINKS } from '@/lib/jugadores/links-dropbox';
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';
import { usePanel } from '@/lib/paneles/use-panel';
import {
  etiquetaDiaUy,
  horaCortaEnSede,
  horaCortaEnUruguay,
  marcadorCambioDeDia,
} from '@/lib/fechas/zonas';
import { mostrar } from '@/lib/formato/valores';
import type { DetallePartidoBundle } from '@/lib/paneles/cargar-detalle-partido';

export function PanelPartido({
  bundle,
  onActualizar,
}: {
  bundle: DetallePartidoBundle;
  /** Recarga silenciosa del panel (tras tildar Completado, el semáforo se actualiza). */
  onActualizar?: () => Promise<void>;
}) {
  const { abrir } = usePanel();
  const { detalle: d, hitos } = bundle;

  const horaUy = d.inicioUtc ? horaCortaEnUruguay(d.inicioUtc) : null;
  const horaSede =
    d.inicioUtc && d.zonaHorariaEvento ? horaCortaEnSede(d.inicioUtc, d.zonaHorariaEvento) : null;
  // La hora local se muestra siempre que se conozca la zona de la sede; el aviso de
  // "trabajen con la hora de Uruguay" solo cuando realmente difiere.
  const hayDiferencia = horaSede !== null && horaSede !== horaUy;
  // "+1" / "-1" si en Uruguay el partido cae en otro día que en su sede (día del grupo).
  const cambioDia = marcadorCambioDeDia(d.diaLocalSede, d.diaUy);

  return (
    <>
      <div className={`compe ${d.esInternacional ? 'compe--int' : ''}`} style={{ marginBottom: 14 }}>
        <span className="compe__c">{mostrar(d.competenciaCodigo)}</span>
        <span className="compe__n">{mostrar(d.competenciaNombre)}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 15 }}>
        <Escudo nombre={d.local.nombre ?? '?'} url={d.local.escudoUrl} clase="crest crest--lg" />
        <h2 className="d2" style={{ flex: 1 }}>
          {mostrar(d.local.nombre)}
          <br />
          vs {mostrar(d.visitante.nombre)}
        </h2>
        <Escudo nombre={d.visitante.nombre ?? '?'} url={d.visitante.escudoUrl} clase="crest crest--lg" />
      </div>

      {(d.ronda || d.representadoEsLocal !== null || d.tentativo) && (
        <div className="linea" style={{ marginBottom: 32 }}>
          {/* La ronda solo la trae API-Football; si no está, no se muestra (ver TarjetaPartido). */}
          {d.ronda && (
            <span>
              <Ico nombre="trofeo" clase="ico ico--sm" />
              <b>{d.ronda}</b>
            </span>
          )}
          {d.representadoEsLocal !== null && (
            <span>
              <Ico nombre="calendario" clase="ico ico--sm" />
              {d.representadoEsLocal ? 'Local' : 'Visitante'}
            </span>
          )}
          {d.tentativo && (
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
              <Ico nombre="alerta" clase="ico ico--sm" />
              Fecha tentativa
            </span>
          )}
        </div>
      )}

      <div className="bloque">
        <span className="label">Horario</span>
        {horaUy ? (
          <>
            <div className="datos">
              <div className="dato dato--a">
                <b>
                  {horaUy}
                  {cambioDia && <sup className="hora__d">{cambioDia}</sup>}
                </b>
                <span>{cambioDia === '+1' ? 'Hora Uruguay (día siguiente)' : 'Hora Uruguay'}</span>
              </div>
              {horaSede !== null && (
                <div className="dato">
                  <b>{horaSede}</b>
                  <span>{hayDiferencia ? 'Hora local' : 'Hora local · igual que Uruguay'}</span>
                </div>
              )}
            </div>
            {hayDiferencia && (
              <div className="aviso" style={{ marginTop: 12 }}>
                <Ico nombre="alerta" clase="ico ico--sm" />
                <span>
                  {cambioDia === '+1'
                    ? 'En la sede el partido se juega un día antes que en Uruguay (acá cae pasada la medianoche). El equipo trabaja con la hora de Uruguay.'
                    : cambioDia === '-1'
                      ? 'En la sede el partido se juega un día después que en Uruguay. El equipo trabaja con la hora de Uruguay.'
                      : 'Hay diferencia horaria con la sede. El equipo trabaja con la hora de Uruguay.'}
                </span>
              </div>
            )}
          </>
        ) : (
          <EstadoSinDatos>Sin horario confirmado todavía.</EstadoSinDatos>
        )}
      </div>

      <div className="bloque">
        <span className="label">Sede</span>
        <div className="linea">
          <span>
            <Ico nombre="pin" clase="ico ico--sm" />
            <b>{mostrar(d.estadio)}</b>
          </span>
          <span>
            <Ico nombre="globo" clase="ico ico--sm" />
            {mostrar(d.ciudad)}
          </span>
          {(d.diaLocalSede ?? d.diaUy) && (
            <span>
              <Ico nombre="calendario" clase="ico ico--sm" />
              {etiquetaDiaUy((d.diaLocalSede ?? d.diaUy)!)}
            </span>
          )}
        </div>
      </div>

      {hitos.length > 0 && (
        <div className="bloque">
          <span className="label">Hitos en este partido</span>
          <div className="filas">
            {hitos.map((h, i) => (
              <div className="filaht filaht--ya" key={`${h.jugadorId}-${h.metrica}-${i}`}>
                <div className="filaht__n">{h.objetivo}</div>
                <div className="filaht__t">
                  <b>{h.jugadorApodo ?? h.jugadorNombre}</b>
                  <span>{h.frase}</span>
                </div>
                <div className="filaht__d">faltan {h.falta}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bloque">
        <div className="bcp__fila">
          <span className="label">{d.jugadores.length > 1 ? 'Jugadores a cubrir' : 'Jugador a cubrir'}</span>
          {/* Datos clave para pegar en Photoshop (0030). Solo el Diseñador (Gerardo, 2026-09-30). */}
          {bundle.usuario?.cargo === 'Diseñador' && (
            <BotonCopiar
              texto={textoCopiarPartido({
                local: d.local.nombre,
                visitante: d.visitante.nombre,
                inicioUtc: d.inicioUtc,
                zona: d.zonaHorariaEvento,
                estadio: d.estadio,
                ciudad: d.ciudad,
              })}
            />
          )}
        </div>
        <div className="lst">
          {bundle.ticketsError && (
            <div className="aviso" style={{ margin: '0 16px 12px' }}>
              <Ico nombre="alerta" clase="ico ico--sm" />
              <span>No pudimos cargar los tickets de este partido. Recargá para crear uno.</span>
            </div>
          )}
          {d.jugadores.map((j) => (
            <div key={j.jugadorId}>
              <button className="pm" type="button" onClick={() => abrir('jugador', j.jugadorId)}>
                <CaraJugador nombre={j.nombre} fotoUrl={j.fotoUrl} clase="" />
                <b>{j.nombre}</b>
                <span>
                  {[j.clubNombre, j.conSeleccion ? 'con la selección' : null].filter(Boolean).join(' · ')}
                  <Ico nombre="chevron" clase="ico ico--sm" />
                </span>
              </button>
              <BotonesDropbox
                links={bundle.linksDropbox?.[j.jugadorId] ?? SIN_LINKS}
                nombreJugador={j.nombre}
                style={{ padding: '10px 16px 6px' }}
              />
              {(() => {
                // Ticket automático de Match Day de este jugador (0030): semáforo + casillas.
                const md = bundle.matchDay.find((m) => m.jugadorId === j.jugadorId);
                const estado = md ? estadoVisual(md, bundle.hoyUy) : null;
                if (!md || !estado) return null;
                return (
                  <div className="mdj">
                    <PastillaSemaforo estado={estado} detalle={md.fechaLimite && (estado === 'pendiente' || estado === 'vencido') ? `vence el ${fechaCortaUy(md.fechaLimite)}` : undefined} />
                    <CasillasDiseno
                      partidoId={d.partidoId}
                      jugadorId={j.jugadorId}
                      jugadorNombre={j.nombre}
                      marca={md.estado === 'publicado' ? 'completado' : md.estado === 'cancelado' ? 'cancelado' : 'pendiente'}
                      motivoCancelacion={md.motivoCancelacion}
                      puedeMarcar={bundle.usuario?.cargo === 'Diseñador'}
                      puedeCancelar={['Administrador', 'Community Manager', 'Diseñador'].includes(bundle.usuario?.cargo ?? '')}
                      onCambio={onActualizar}
                    />
                    {md.ultimoMomento && <SenalUltimoMomento />}
                    {md.estado === 'publicado' && md.completadoPorNombre && <small className="mdj__q">Completado por {md.completadoPorNombre}</small>}
                    {md.estado === 'cancelado' && md.completadoPorNombre && <small className="mdj__q">Cancelado por {md.completadoPorNombre}</small>}
                  </div>
                );
              })()}
              <div className="tkp">
                {(bundle.tickets ?? [])
                  .filter((t) => t.jugadorId === j.jugadorId)
                  .map((t) => {
                    // Lucecita si el ticket espera algo de quien mira (mismo criterio que la barra).
                    const alerta =
                      bundle.usuario && debeActuar(bundle.usuario.cargo, bundle.usuario.id, t, esUrgenteHoy(bundle.hoyUy)) ? alertaDe(t, bundle.hoyUy) : undefined;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className="tkp__t"
                        aria-label={`Ver ticket de ${j.nombre}${alerta ? ` — ${alerta}` : ''}`}
                        onClick={() => abrir('ticket', t.id)}
                      >
                        <PastillaEstado estado={t.estado} />
                        {alerta && <AlertaTicket texto={alerta} />}
                        <span>Ver ticket</span>
                      </button>
                    );
                  })}
                {bundle.usuario &&
                  !bundle.ticketsError &&
                  puedeCrear(bundle.usuario.cargo) &&
                  !(bundle.tickets ?? []).some((t) => t.jugadorId === j.jugadorId) && (
                    <CrearTicket partidoId={d.partidoId} jugadorId={j.jugadorId} jugadorNombre={j.nombre} />
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
