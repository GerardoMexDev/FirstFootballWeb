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
import { EstadoSinDatos } from '@/components/comunes/EstadoSinDatos';
import { usePanel } from '@/lib/paneles/use-panel';
import { etiquetaDiaUy, horaCortaEnSede, horaCortaEnUruguay } from '@/lib/fechas/zonas';
import { mostrar } from '@/lib/formato/valores';
import type { DetallePartidoBundle } from '@/lib/paneles/cargar-detalle-partido';

export function PanelPartido({ bundle }: { bundle: DetallePartidoBundle }) {
  const { abrir } = usePanel();
  const { detalle: d, hitos } = bundle;

  const horaUy = d.inicioUtc ? horaCortaEnUruguay(d.inicioUtc) : null;
  const horaSede =
    d.inicioUtc && d.zonaHorariaEvento ? horaCortaEnSede(d.inicioUtc, d.zonaHorariaEvento) : null;
  // La hora local se muestra siempre que se conozca la zona de la sede; el aviso de
  // "trabajen con la hora de Uruguay" solo cuando realmente difiere.
  const hayDiferencia = horaSede !== null && horaSede !== horaUy;

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

      <div className="linea" style={{ marginBottom: 32 }}>
        <span>
          <Ico nombre="trofeo" clase="ico ico--sm" />
          <b>{mostrar(d.ronda)}</b>
        </span>
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

      <div className="bloque">
        <span className="label">Horario</span>
        {horaUy ? (
          <>
            <div className="datos">
              <div className="dato dato--a">
                <b>{horaUy}</b>
                <span>Hora Uruguay</span>
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
                <span>Hay diferencia horaria con la sede. El equipo trabaja con la hora de Uruguay.</span>
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
          {d.diaUy && (
            <span>
              <Ico nombre="calendario" clase="ico ico--sm" />
              {etiquetaDiaUy(d.diaUy)}
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
        <span className="label">{d.jugadores.length > 1 ? 'Jugadores a cubrir' : 'Jugador a cubrir'}</span>
        <div className="lst">
          {d.jugadores.map((j) => (
            <button className="pm" type="button" key={j.jugadorId} onClick={() => abrir('jugador', j.jugadorId)}>
              <CaraJugador nombre={j.nombre} fotoUrl={j.fotoUrl} clase="" />
              <b>{j.nombre}</b>
              <span>
                {[j.clubNombre, j.conSeleccion ? 'con la selección' : null].filter(Boolean).join(' · ')}
                <Ico nombre="chevron" clase="ico ico--sm" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
