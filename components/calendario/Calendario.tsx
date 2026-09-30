/**
 * Vista `calendario` conectada a `agenda_anual`: franja de densidad anual (12 meses) +
 * grilla del mes con los eventos por día + leyenda. Los partidos se ubican por el día en su
 * sede (punto I); cumpleaños y aniversarios, por su fecha civil. Client Component porque la
 * navegación de mes es estado local (el server ya trajo TODOS los eventos de la ventana de
 * proyección, así que moverse entre meses/años no vuelve a pedir nada).
 *
 * Marcado y clases 1:1 con la demo (`renderAnio()` / `renderCal()`). Los `.ev` de partido,
 * cumpleaños y aniversario de selección/debut abren el panel del jugador (`<button>`); el
 * aniversario de fundación de club queda como `<div>` no interactivo — `ref_id` en
 * `agenda_anual` apunta al club, no a un jugador, y todavía no hay panel de club.
 *
 * Football First (Fase 1). Creado 2026-09-05. Paneles: 2026-09-06. Feedback agencia (aniversarios
 * clickeables): 2026-09-17.
 */
'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePanel } from '@/lib/paneles/use-panel';
import { META_VISUAL } from '@/lib/tickets/semaforo';
import type { EstadoVisual } from '@/lib/tickets/tipos';
import type { FiltroCalendario } from '@/lib/calendario/eventos';
import { horaCortaEnUruguay } from '@/lib/fechas/zonas';
import { META_ESTADO, type ResumenPartido } from '@/lib/tickets/estados';
import type { ResumenTicket } from '@/lib/tickets/tipos';
import {
  agruparPorDia,
  celdasDelMes,
  partidosPorMes,
  MESES,
  MESES_CORTOS,
  type EventoCalendario,
} from '@/lib/calendario/eventos';

/** Texto de cada chip de evento: una etiqueta corta (arriba, en negrita) + el título. */
/** Chips de filtro del calendario unificado (2026-09-30). */
const FILTROS: { f: FiltroCalendario; etiqueta: string }[] = [
  { f: 'todos', etiqueta: 'Todos' },
  { f: 'matchday', etiqueta: 'Match Day' },
  { f: 'contenido', etiqueta: 'Contenido' },
  { f: 'seleccion', etiqueta: 'Selección' },
];

function chipEvento(e: EventoCalendario): { etiqueta: string; texto: string } {
  switch (e.fuente) {
    case 'partido':
      return { etiqueta: e.cuandoUtc ? `${horaCortaEnUruguay(e.cuandoUtc)} UY` : '—', texto: e.titulo };
    case 'cumpleanos':
      return { etiqueta: 'Cumpleaños', texto: e.titulo };
    case 'aniversario_club':
      return { etiqueta: 'Aniversario', texto: e.titulo };
    case 'aniversario_seleccion':
      return { etiqueta: 'Selección', texto: e.titulo };
    case 'aniversario_debut':
      return { etiqueta: 'Debut profesional', texto: e.titulo };
    case 'convocatoria':
      return { etiqueta: 'Convocatoria', texto: e.titulo };
    default:
      return { etiqueta: 'Hito', texto: e.titulo };
  }
}

export function Calendario({
  eventos,
  hoyUy,
  ticketsPorPartido = {},
  alertasPorPartido = {},
  ticketsPorDia = {},
  alertasPorTicket = {},
  filtro = 'todos',
  estadoPorPartido = {},
}: {
  /** Filtro activo (vive en la dirección, `?f=`; 2026-09-30). */
  filtro?: FiltroCalendario;
  /** Semáforo de diseño por partido de Match Day (0030): el peor estado entre sus jugadores. */
  estadoPorPartido?: Record<string, EstadoVisual>;
  eventos: EventoCalendario[];
  hoyUy: string;
  ticketsPorPartido?: Record<string, ResumenPartido>;
  /** `{ partidoId: texto }` de los tickets que esperan algo de quien mira (lucecita). */
  alertasPorPartido?: Record<string, string>;
  /** Tickets de fecha por día (Calendario general, 0028). */
  ticketsPorDia?: Record<string, ResumenTicket[]>;
  /** `{ ticketId: texto }` de la lucecita para esos tickets. */
  alertasPorTicket?: Record<string, string>;
}) {
  const { abrir } = usePanel();
  const router = useRouter();
  const pathname = usePathname();
  const [anio, setAnio] = useState(() => Number(hoyUy.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(hoyUy.slice(5, 7)) - 1); // 0-11

  const porDia = useMemo(() => agruparPorDia(eventos), [eventos]);
  const densidad = useMemo(() => partidosPorMes(eventos, anio), [eventos, anio]);
  const celdas = useMemo(() => celdasDelMes(anio, mes, hoyUy), [anio, mes, hoyUy]);
  const maxDensidad = Math.max(...densidad, 1);

  function moverMes(delta: number) {
    const total = anio * 12 + mes + delta;
    setAnio(Math.floor(total / 12));
    setMes(((total % 12) + 12) % 12);
  }

  return (
    <>
      <div className="barra" id="filtros-calendario">
        {FILTROS.map(({ f, etiqueta }) => (
          <button
            key={f}
            type="button"
            className={filtro === f ? 'chip on' : 'chip'}
            aria-pressed={filtro === f}
            onClick={() => router.replace(f === 'todos' ? pathname : `${pathname}?f=${f}`, { scroll: false })}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      <div className="anio">
        {MESES_CORTOS.map((m, i) => (
          <button
            key={m}
            type="button"
            className={`anio__m ${i === mes ? 'on' : ''}`}
            onClick={() => setMes(i)}
          >
            <span>{m}</span>
            <b>{densidad[i] || '–'}</b>
            <div className="anio__bar">
              <i style={{ width: `${(densidad[i] / maxDensidad) * 100}%` }} />
            </div>
          </button>
        ))}
      </div>

      <div className="cal__nav">
        <button className="btn btn--g btn--ico" type="button" aria-label="Mes anterior" onClick={() => moverMes(-1)}>
          <svg className="ico" viewBox="0 0 24 24">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
        <h3 className="d2">
          {MESES[mes]} {anio}
        </h3>
        <button className="btn btn--g btn--ico" type="button" aria-label="Mes siguiente" onClick={() => moverMes(1)}>
          <svg className="ico" viewBox="0 0 24 24">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="cal__dias">
        <div>Lunes</div>
        <div>Martes</div>
        <div>Miércoles</div>
        <div>Jueves</div>
        <div>Viernes</div>
        <div>Sábado</div>
        <div>Domingo</div>
      </div>

      <div className="cal__grid">
        {celdas.map((c) => {
          const evs = porDia.get(c.fecha) ?? [];
          const tks = ticketsPorDia[c.fecha] ?? [];
          return (
            <div
              key={c.fecha}
              className={`celda ${evs.length || tks.length ? 'celda--con' : ''} ${c.delMes ? '' : 'celda--fuera'} ${
                c.esHoy ? 'celda--hoy' : ''
              }`}
            >
              <div className="celda__n">{c.dia}</div>
              {evs.map((e, j) => {
                const { etiqueta, texto } = chipEvento(e);
                const clave = `${e.fuente}-${e.refId ?? j}`;
                const clase = `ev ${e.tentativo ? 'ev--tent' : ''} ${e.esInternacional ? 'ev--int' : ''}`;
                // Partidos de Contenido y de la selección (0031): no tienen panel → chip sin clic (abajo).
                if (e.fuente === 'partido' && e.refId && (e.grupo ?? 'matchday') === 'matchday') {
                  const refId = e.refId;
                  const tk = ticketsPorPartido[refId];
                  const sem = estadoPorPartido[refId];
                  return (
                    <button
                      key={clave}
                      type="button"
                      className={`${clase} ${tk ? `ev--t ev--t-${tk.estado}` : ''} ${sem ? `ev--sem-${sem}` : ''}`}
                      // 0030: siempre al partido (ahí están las casillas; el ticket manual se abre desde ahí).
                      onClick={() => abrir('partido', refId)}
                    >
                      {tk && (
                        <small className="ev__tk">
                          {/* Si el partido espera algo de quien mira: lucecita + texto de la alerta. */}
                          {alertasPorPartido[refId] ? (
                            <span className="tka__luz" aria-hidden="true" />
                          ) : (
                            <span aria-hidden="true">{META_ESTADO[tk.estado].simbolo}</span>
                          )}{' '}
                          <span className="ev__w">
                            {alertasPorPartido[refId] ?? META_ESTADO[tk.estado].corta}
                            {tk.ticketIds.length > 1 ? ` · ${tk.ticketIds.length}` : ''}
                          </span>
                        </small>
                      )}
                      <b>{etiqueta}</b>
                      {/* Símbolo además del color (WCAG 1.4.1), fuera del <b> que en celular se oculta. */}
                      {sem && <span className={`ev__sem ev__sem--${sem}`} aria-hidden="true">{META_VISUAL[sem].simbolo}</span>}
                      {texto}
                      {sem && <span className="solo-lector"> — diseño {META_VISUAL[sem].etiqueta.toLowerCase()}</span>}
                    </button>
                  );
                }
                if (
                  (e.fuente === 'cumpleanos' || e.fuente === 'aniversario_seleccion' || e.fuente === 'aniversario_debut') &&
                  e.refId
                ) {
                  const refId = e.refId;
                  const fuente = e.fuente;
                  return (
                    <button key={clave} type="button" className={clase} onClick={() => abrir('jugador', refId, fuente)}>
                      <b>{etiqueta}</b>
                      {texto}
                    </button>
                  );
                }
                return (
                  <div key={clave} className={clase}>
                    <b>{etiqueta}</b>
                    {texto}
                  </div>
                );
              })}
              {tks.map((t) => (
                <button
                  key={`tk-${t.id}`}
                  type="button"
                  className={`ev ev--t ev--t-${t.estado}`}
                  onClick={() => abrir('ticket', t.id)}
                >
                  <small className="ev__tk">
                    {alertasPorTicket[t.id] ? (
                      <span className="tka__luz" aria-hidden="true" />
                    ) : (
                      <span aria-hidden="true">{META_ESTADO[t.estado].simbolo}</span>
                    )}{' '}
                    <span className="ev__w">{alertasPorTicket[t.id] ?? META_ESTADO[t.estado].corta}</span>
                  </small>
                  {/* Como el resto de los chips: <b> = qué (en celular se oculta), texto = quién. */}
                  <b>{t.motivo}</b>
                  {t.jugadorNombre}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="leyenda">
        <span>
          <i /> Confirmado
        </span>
        <span>
          <i className="t" /> Fecha tentativa
        </span>
        <span>
          <i className="a" /> Competición internacional
        </span>
      </div>
    </>
  );
}
