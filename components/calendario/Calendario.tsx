/**
 * Vista `calendario` conectada a `agenda_anual`: franja de densidad anual (12 meses) +
 * grilla del mes con los eventos por día + leyenda. Client Component porque la navegación
 * de mes es estado local (el server ya trajo TODOS los eventos de la ventana de proyección,
 * así que moverse entre meses/años no vuelve a pedir nada).
 *
 * Marcado y clases 1:1 con la demo (`renderAnio()` / `renderCal()`). Los `.ev` no son
 * clicables todavía (paneles, sesión aparte) — por eso son `<div>`, mismo criterio que
 * `TarjetaPartido`.
 *
 * Football First (Fase 1). Creado 2026-09-05.
 */
'use client';

import { useMemo, useState } from 'react';
import { horaCortaEnUruguay } from '@/lib/fechas/zonas';
import {
  agruparPorDia,
  celdasDelMes,
  partidosPorMes,
  MESES,
  MESES_CORTOS,
  type EventoCalendario,
} from '@/lib/calendario/eventos';

/** Texto de cada chip de evento: una etiqueta corta (arriba, en negrita) + el título. */
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
    case 'convocatoria':
      return { etiqueta: 'Convocatoria', texto: e.titulo };
    default:
      return { etiqueta: 'Hito', texto: e.titulo };
  }
}

export function Calendario({ eventos, hoyUy }: { eventos: EventoCalendario[]; hoyUy: string }) {
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
          return (
            <div
              key={c.fecha}
              className={`celda ${evs.length ? 'celda--con' : ''} ${c.delMes ? '' : 'celda--fuera'} ${
                c.esHoy ? 'celda--hoy' : ''
              }`}
            >
              <div className="celda__n">{c.dia}</div>
              {evs.map((e, j) => {
                const { etiqueta, texto } = chipEvento(e);
                return (
                  <div
                    key={`${e.fuente}-${e.refId ?? j}`}
                    className={`ev ${e.tentativo ? 'ev--tent' : ''} ${e.esInternacional ? 'ev--int' : ''}`}
                  >
                    <b>{etiqueta}</b>
                    {texto}
                  </div>
                );
              })}
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
